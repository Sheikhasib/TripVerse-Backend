import bcrypt from "bcryptjs";
import { JwtPayload, SignOptions } from "jsonwebtoken";
import config from "../../config";
import { prisma } from "../../lib/prisma";
import { googleClient } from "../../lib/googleAuth";
import { AppError } from "../../utils/appError";
import { jwtUtils } from "../../utils/jwt";
import { Role } from "../../../generated/prisma/enums";
import {
  IAuth,
  IDemoLoginPayload,
  IGoogleLoginPayload,
  ILoginUser,
  IRefreshTokenPayload,
} from "./auth.interface";

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

const issueTokens = (user: {
  id: string;
  name: string;
  email: string;
  role: Role;
  tokenVersion: number;
}) => {
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

  return { accessToken, refreshToken };
};

const sanitizeUser = <T extends { password: string | null }>(user: T) => {
  const { password, ...rest } = user;
  return rest;
};

// ── Register ────────────────────────────────────────────────────────────
const registerUser = async (payload: IAuth) => {
  const { name, email, password, phone, role } = payload;

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

  const hashedPassword = await bcrypt.hash(
    password,
    Number(config.bcrypt_salt_rounds),
  );

  const createdUser = await prisma.user.create({
    data: {
      name,
      email,
      password: hashedPassword,
      authProvider: "CREDENTIAL",
      role: role || "USER",
      phone,
    },
    omit: { password: true },
  });

  return createdUser;
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

  return issueTokens(user);
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

  const tokens = issueTokens(user!);
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

  return { ...issueTokens(demoUser), user: demoUser };
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

  return issueTokens(user);
};

// ── Logout ──────────────────────────────────────────────────────────────
const logout = async (userId: string) => {
  await prisma.user.update({
    where: { id: userId },
    data: { tokenVersion: { increment: 1 } },
  });
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
  loginUser,
  googleLogin,
  demoLogin,
  refreshToken,
  logout,
  getMeFromDB,
};