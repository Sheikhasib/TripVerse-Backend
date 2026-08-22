import bcrypt from "bcryptjs";
import crypto from "crypto";
import { decode, JwtPayload, SignOptions } from "jsonwebtoken";
import config from "../../config";
import { prisma } from "../../lib/prisma";
import { googleClient } from "../../lib/googleAuth";
import { getRedis } from "../../lib/redis";
import { AppError } from "../../utils/appError";
import { jwtUtils } from "../../utils/jwt";
import {
  sendForgotPasswordOtpEmail,
  sendPasswordResetSuccessEmail,
  sendVerificationOtpEmail,
  sendWelcomeEmail,
} from "../../utils/authEmail";
import { runInBackground } from "../../utils/background";
import { Prisma } from "../../../generated/prisma/client";
import { Role } from "../../../generated/prisma/enums";
import {
  IAuth,
  IDemoLoginPayload,
  IForgotPasswordPayload,
  IGoogleLoginPayload,
  ILoginUser,
  IRefreshTokenPayload,
  IResendVerificationPayload,
  IResetPasswordPayload,
  IVerifyEmailPayload,
} from "./auth.interface";

const OTP_EXPIRATION_SECONDS = 5 * 60; // 5 minutes — matches the reference backend

// SHA-256 of a refresh JWT — the rotation ledger stores only this hash, never
// the token itself, so a DB leak can't mint usable refresh tokens.
const sha256 = (value: string) =>
  crypto.createHash("sha256").update(value).digest("hex");

// Refresh-token expiry read from the signed token's `exp` so the ledger row
// always matches JWT_REFRESH_EXPIRES_IN exactly.
const refreshTokenExpiresAt = (token: string) => {
  const payload = decode(token) as JwtPayload | null;
  return payload?.exp ? new Date(payload.exp * 1000) : new Date();
};

// Redis OTP store accessor — 503 when unconfigured (never a boot-time crash).
const getRedisClient = async () => {
  const client = await getRedis();
  if (!client) {
    throw new AppError(503, "Email verification is not configured.");
  }
  return client;
};

const buildTokenPayload = (user: {
  id: string;
  name: string;
  email: string;
  role: Role;
  tokenVersion: number;
}) => ({
  id: user.id,
  name: user.name,
  email: user.email,
  role: user.role,
  tokenVersion: user.tokenVersion,
});

const issueTokens = async (
  user: {
    id: string;
    name: string;
    email: string;
    role: Role;
    tokenVersion: number;
  },
  client: Prisma.TransactionClient | typeof prisma = prisma,
) => {
  const tokenPayload = buildTokenPayload(user);

  const accessToken = jwtUtils.createToken(
    tokenPayload,
    config.jwt_access_secret,
    { expiresIn: config.jwt_access_expires_in } as SignOptions,
  );
  const refreshToken = jwtUtils.createToken(
    tokenPayload,
    config.jwt_refresh_secret,
    { expiresIn: config.jwt_refresh_expires_in } as SignOptions,
  );

  // Rotation ledger — persist a row keyed by the refresh token's hash. The
  // JWT itself stays in the response exactly as before.
  await client.refreshToken.create({
    data: {
      userId: user.id,
      hash: sha256(refreshToken),
      expiresAt: refreshTokenExpiresAt(refreshToken),
    },
  });

  return { accessToken, refreshToken };
};

const sanitizeUser = <T extends { password: string | null }>(user: T) => {
  const { password, ...rest } = user;
  return rest;
};

// ── Register (staged in Redis, verified via OTP) ─────────────────────────
// Follows the reference backend: a credential signup does NOT create a DB row.
// It hashes the password, stages the payload in Redis, emails a 6-digit OTP,
// and the user row is only created on successful verification.
const registerUser = async (payload: IAuth) => {
  const { name, password, phone, role } = payload;
  const email = payload.email.trim().toLowerCase();

  // Only users/agents can self-register; admins are created via demo-login/seed
  if (role && role !== "USER" && role !== "AGENT") {
    throw new AppError(400, "Role must be either USER or AGENT");
  }

  const existingUser = await prisma.user.findUnique({
    where: { email },
  });
  if (existingUser) {
    throw new AppError(409, "User with this email already exists");
  }

  const client = await getRedisClient();

  // A registration is already staged for this email — 409 instead of silently
  // overwriting the pending OTP/data (an attacker must not be able to kill a
  // victim's in-flight registration). The pending flow continues via
  // resend-verification.
  const registrationDataKey = `tripverse:register-data:${email}`;
  const pendingRegistration = await client.get(registrationDataKey);
  if (pendingRegistration) {
    throw new AppError(
      409,
      "Registration is pending verification. Check your email or resend the OTP.",
    );
  }

  const hashedPassword = await bcrypt.hash(
    password,
    Number(config.bcrypt_salt_rounds),
  );

  // Registration OTP (the value the user types back into the API)
  const otpKey = `tripverse:register-otp:${email}`;
  const otpValue = crypto.randomInt(100000, 1000000).toString();

  await client.set(otpKey, otpValue, {
    expiration: {
      type: "EX",
      value: OTP_EXPIRATION_SECONDS,
    },
  });

  // Staged registration payload — password is already hashed here, exactly
  // like the reference, so a Redis leak never exposes a plaintext password.
  const redisUserDataPayload = {
    name,
    email,
    password: hashedPassword,
    phone,
    role: role || "USER",
  };

  await client.set(registrationDataKey, JSON.stringify(redisUserDataPayload), {
    expiration: {
      type: "EX",
      value: OTP_EXPIRATION_SECONDS,
    },
  });

  // OTP delivery is part of the request, not background work — serverless
  // runtimes may freeze fire-and-forget promises right after the response,
  // silently dropping the send (observed on Vercel). The helpers never throw
  // (all failures are logged internally), so awaiting is safe and adds only
  // the Resend HTTP round-trip.
  await sendVerificationOtpEmail({ email, name, otp: otpValue });
};

// ── Verify email (creates the user + auto-login) ─────────────────────────
// Follows the reference backend: OTP is read from Redis, deleted, then the
// staged payload is materialised as a real user row with emailVerified: true,
// and tokens are issued so the user is logged in immediately.
const verifyEmail = async (payload: IVerifyEmailPayload) => {
  const { otp } = payload;
  const email = payload.email.trim().toLowerCase();

  // Defensive — registration already 409s on an existing email, so a user row
  // here means the email was verified earlier through another flow.
  const isUserExists = await prisma.user.findUnique({ where: { email } });
  if (isUserExists) {
    throw new AppError(409, "Email is already verified");
  }

  const client = await getRedisClient();

  const otpKey = `tripverse:register-otp:${email}`;
  const redisOTP = await client.get(otpKey);

  if (!redisOTP || redisOTP !== otp) {
    throw new AppError(400, "Invalid or expired OTP.");
  }

  // OTP is single-use — delete it before the user row is created.
  await client.del(otpKey);

  const registrationDataKey = `tripverse:register-data:${email}`;
  const redisUserData = await client.get(registrationDataKey);

  if (!redisUserData) {
    throw new AppError(400, "Invalid or expired OTP.");
  }

  const userPayload = JSON.parse(redisUserData) as IAuth;

  const createdUser = await prisma.user.create({
    data: {
      name: userPayload.name,
      email: userPayload.email,
      password: userPayload.password,
      phone: userPayload.phone,
      role: userPayload.role || "USER",
      authProvider: "CREDENTIAL",
      status: "ACTIVE",
      emailVerified: true,
    },
    omit: { password: true },
  });

  // Staged payload consumed — nothing remains in Redis.
  await client.del(registrationDataKey);

  runInBackground([
    sendWelcomeEmail({ email: createdUser.email, name: createdUser.name }),
  ]);

  const tokens = await issueTokens(createdUser);

  return { ...tokens, user: createdUser };
};

// ── Resend verification OTP ──────────────────────────────────────────────
// Re-mints a fresh OTP for a still-staged registration. Uniform 200 — if the
// staging data is gone (never registered / already verified) this no-ops.
const resendVerification = async (payload: IResendVerificationPayload) => {
  const email = payload.email.trim().toLowerCase();

  const client = await getRedisClient();

  const registrationDataKey = `tripverse:register-data:${email}`;
  const redisUserData = await client.get(registrationDataKey);

  if (!redisUserData) {
    return;
  }

  const userPayload = JSON.parse(redisUserData) as IAuth;

  const otpKey = `tripverse:register-otp:${email}`;
  const otpValue = crypto.randomInt(100000, 1000000).toString();

  await client.set(otpKey, otpValue, {
    expiration: {
      type: "EX",
      value: OTP_EXPIRATION_SECONDS,
    },
  });

  await sendVerificationOtpEmail({ email, name: userPayload.name, otp: otpValue });
};

// ── Forgot password ──────────────────────────────────────────────────────
// Emails a reset OTP to verified CREDENTIAL accounts. Deliberately returns a
// uniform 200 whether or not the email exists / is eligible (no enumeration —
// the reference throws "User not found", but TripVerse never leaks existence).
const forgotPassword = async (payload: IForgotPasswordPayload) => {
  const email = payload.email.trim().toLowerCase();

  const isUserExists = await prisma.user.findUnique({ where: { email } });

  if (
    !isUserExists ||
    isUserExists.isDeleted ||
    isUserExists.status === "SUSPENDED" ||
    !isUserExists.emailVerified ||
    isUserExists.authProvider === "GOOGLE"
  ) {
    // Google-only accounts reset via Google; everyone else silently no-ops.
    return;
  }

  const client = await getRedisClient();

  const otp = crypto.randomInt(100000, 1000000).toString();
  const key = `tripverse:forgot-password-otp:${isUserExists.email}`;

  await client.set(key, otp, {
    expiration: {
      type: "EX",
      value: OTP_EXPIRATION_SECONDS,
    },
  });

  await sendForgotPasswordOtpEmail({
    email: isUserExists.email,
    name: isUserExists.name,
    otp,
  });
};

// ── Reset password ───────────────────────────────────────────────────────
// Validates the OTP against Redis, then replaces the hash and bumps
// tokenVersion so every existing session dies (TripVerse logout semantics).
const resetPassword = async (payload: IResetPasswordPayload) => {
  const { newPassword, otp } = payload;
  const email = payload.email.trim().toLowerCase();

  const isUserExists = await prisma.user.findUnique({ where: { email } });

  if (
    !isUserExists ||
    isUserExists.isDeleted ||
    isUserExists.status === "SUSPENDED" ||
    isUserExists.authProvider === "GOOGLE"
  ) {
    throw new AppError(400, "Invalid or expired OTP.");
  }

  const client = await getRedisClient();

  const key = `tripverse:forgot-password-otp:${isUserExists.email}`;
  const redisOTP = await client.get(key);

  if (!redisOTP || redisOTP !== otp) {
    throw new AppError(400, "Invalid or expired OTP.");
  }

  const hashedNewPassword = await bcrypt.hash(
    newPassword,
    Number(config.bcrypt_salt_rounds),
  );

  await prisma.user.update({
    where: { email: isUserExists.email },
    data: {
      password: hashedNewPassword,
      tokenVersion: { increment: 1 },
    },
  });

  // Single-use OTP — delete after a successful reset.
  await client.del(key);

  runInBackground([
    sendPasswordResetSuccessEmail({
      email: isUserExists.email,
      name: isUserExists.name,
    }),
  ]);
};

// ── Login ───────────────────────────────────────────────────────────────
const loginUser = async (payload: ILoginUser) => {
  const { email, password } = payload;

  const user = await prisma.user.findUnique({
    where: { email },
  });

  if (!user) {
    throw new AppError(401, "Invalid email or password");
  }
  if (user.isDeleted) {
    throw new AppError(403, "Account has been deleted");
  }
  if (user.status === "SUSPENDED") {
    throw new AppError(403, "Account is suspended");
  }
  if (user.authProvider === "GOOGLE") {
    throw new AppError(
      400,
      "This account uses Google login. Please log in with Google.",
    );
  }

  const isPasswordValid = await bcrypt.compare(password, user.password || "");
  if (!isPasswordValid) {
    throw new AppError(401, "Invalid email or password");
  }

  return await issueTokens(user);
};

// ── Google login (ID-token flow) ────────────────────────────────────────
const googleLogin = async (payload: IGoogleLoginPayload) => {
  const { idToken } = payload;

  if (!config.google_client_id) {
    throw new AppError(
      400,
      "Google login is not configured. Please contact support.",
    );
  }

  let ticket;
  try {
    ticket = await googleClient.verifyIdToken({
      idToken,
      audience: config.google_client_id,
    });
  } catch {
    throw new AppError(401, "Invalid Google token");
  }

  const googleData = ticket.getPayload();
  if (!googleData) {
    throw new AppError(400, "Invalid Google token payload");
  }

  const { email, name, sub, picture } = googleData;

  if (!email || !googleData.email_verified) {
    throw new AppError(400, "Google account email is not verified");
  }

  let user = await prisma.user.findUnique({ where: { googleId: sub } });

  // Existing user → link Google account if not already linked
  if (!user && email) {
    user = await prisma.user.findUnique({ where: { email } });
    if (user) {
      if (user.googleId && user.googleId !== sub) {
        throw new AppError(
          409,
          "Email is already linked to another Google account",
        );
      }
      user = await prisma.user.update({
        where: { id: user.id },
        data: { googleId: sub, emailVerified: true },
      });
    }
  }

  // Brand new user
  if (!user) {
    const localPart = email.split("@")[0] ?? email;
    const displayName = (name ?? "").trim() || localPart;
    user = await prisma.user.create({
      data: {
        email,
        name: displayName,
        password: null,
        authProvider: "GOOGLE",
        googleId: sub,
        emailVerified: true,
        role: "USER",
        avatarUrl: picture || null,
      },
    });
  }

  const tokens = await issueTokens(user!);
  const sanitizedUser = sanitizeUser(user!);

  return { ...tokens, user: sanitizedUser };
};

// ── Demo login (grading) ────────────────────────────────────────────────
const DEMO_PASSWORD = "demo123";

const demoLogin = async (payload: IDemoLoginPayload) => {
  const { role } = payload;

  const demoUser = await prisma.user.upsert({
    where: { email: `demo-${role.toLowerCase()}@tripverse.com` },
    // resurrect demo accounts that an admin suspended or soft-deleted
    update: { status: "ACTIVE", isDeleted: false },
    create: {
      name: `Demo ${role.charAt(0) + role.slice(1).toLowerCase()}`,
      email: `demo-${role.toLowerCase()}@tripverse.com`,
      password: await bcrypt.hash(DEMO_PASSWORD, Number(config.bcrypt_salt_rounds)),
      authProvider: "CREDENTIAL",
      role,
      status: "ACTIVE",
      emailVerified: true,
    },
    omit: { password: true },
  });

  return { ...(await issueTokens(demoUser)), user: demoUser };
};

// Reuse detected → kill the whole family: every outstanding token dies via
// revoke + tokenVersion bump. Same shape as logout.
const revokeFamily = async (userId: string) => {
  await prisma.$transaction([
    prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    }),
    prisma.user.update({
      where: { id: userId },
      data: { tokenVersion: { increment: 1 } },
    }),
  ]);
};

// ── Refresh ─────────────────────────────────────────────────────────────
const refreshToken = async (payload: IRefreshTokenPayload) => {
  const { refreshToken: providedRefreshToken } = payload;

  const verified = jwtUtils.verifyToken(
    providedRefreshToken,
    config.jwt_refresh_secret,
  );

  if (!verified.success) {
    throw new AppError(401, verified.error);
  }

  const { id, tokenVersion: tokenTokenVersion } =
    verified.data as JwtPayload & { tokenVersion: number };

  const user = await prisma.user.findUnique({ where: { id } });

  if (!user || user.isDeleted) {
    throw new AppError(403, "Account has been deleted");
  }
  if (user.status === "SUSPENDED") {
    throw new AppError(403, "Account is suspended");
  }

  // tokenVersion changed → tokens were revoked (logout / password change)
  if (user.tokenVersion !== tokenTokenVersion) {
    throw new AppError(401, "Token is no longer valid. Please login again.");
  }

  // Opportunistic housekeeping — keep the ledger from growing unbounded
  // without a cron: drop expired rows and rows revoked more than 7 days ago.
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  await prisma.refreshToken.deleteMany({
    where: {
      OR: [{ expiresAt: { lt: new Date() } }, { revokedAt: { lte: weekAgo } }],
    },
  });

  // Rotation ledger lookup by the presented token's hash.
  const row = await prisma.refreshToken.findUnique({
    where: { hash: sha256(providedRefreshToken) },
  });

  // Never issued (or already pruned) → reject.
  if (!row) {
    throw new AppError(401, "Invalid refresh token. Please login again.");
  }

  // A revoked row is the theft signature — someone replayed a rotated token.
  if (row.revokedAt) {
    await revokeFamily(user.id);
    throw new AppError(401, "Refresh token reuse detected. Please login again.");
  }

  // Naturally expired → reject without touching the family.
  if (row.expiresAt.getTime() <= Date.now()) {
    throw new AppError(401, "Refresh token has expired. Please login again.");
  }

  // Valid → rotate. The CAS on `revokedAt: null` makes rotation a
  // compare-and-swap: of two truly-concurrent presents of the same token only
  // one wins; the loser's updateMany returns count 0 → family nuke. The nuke
  // must run AFTER the transaction commits — throwing inside the interactive
  // tx would roll it back and silently undo the nuke.
  const outcome = await prisma.$transaction(async (tx) => {
    const rotated = await tx.refreshToken.updateMany({
      where: { id: row.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    if (rotated.count === 0) {
      return "LOST" as const;
    }

    const tokens = await issueTokens(user, tx);
    return { tokens } as const;
  });

  if (outcome === "LOST") {
    await revokeFamily(user.id);
    throw new AppError(401, "Refresh token reuse detected. Please login again.");
  }

  return outcome.tokens;
};

// ── Logout ──────────────────────────────────────────────────────────────
const logout = async (userId: string) => {
  // Revoke the ledger rows, then bump tokenVersion (kills everything).
  await revokeFamily(userId);
};

// ── Get me ──────────────────────────────────────────────────────────────
const getMeFromDB = async (userId: string) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    omit: { password: true },
  });

  if (!user || user.isDeleted) {
    throw new AppError(404, "User not found");
  }

  return user;
};

export const authService = {
  registerUser,
  verifyEmail,
  resendVerification,
  forgotPassword,
  resetPassword,
  loginUser,
  googleLogin,
  demoLogin,
  refreshToken,
  logout,
  getMeFromDB,
};