import { randomUUID } from "node:crypto";
import request from "supertest";
import app from "../src/app";
import { prisma } from "../src/lib/prisma";
import { Role, UserStatus } from "../generated/prisma/enums";
import { TEST_PASSWORD, bearer, createAdmin, createUser, loginAs } from "./factories";

// External services are stubbed: Redis (OTP store) → in-memory Map so the
// register/verify flows work without a Redis server, and the Nodemailer auth
// senders → no-ops (never real SMTP). Google's client is stubbed to always
// reject so /auth/google never makes a network call.
const { redisStore, fakeRedis, authEmail, googleClient } = vi.hoisted(() => {
  const store = new Map<string, string>();
  return {
    redisStore: store,
    fakeRedis: {
      get: async (key: string) => store.get(key) ?? null,
      set: async (key: string, value: string) => {
        store.set(key, value);
        return "OK";
      },
      del: async (key: string) => {
        store.delete(key);
        return 1;
      },
    },
    authEmail: {
      sendVerificationOtpEmail: vi.fn(async () => {}),
      sendForgotPasswordOtpEmail: vi.fn(async () => {}),
      sendPasswordResetSuccessEmail: vi.fn(async () => {}),
      sendWelcomeEmail: vi.fn(async () => {}),
    },
    googleClient: {
      verifyIdToken: vi.fn(async () => {
        throw new Error("invalid token");
      }),
    },
  };
});

vi.mock("../src/lib/redis", () => ({
  getRedis: async () => fakeRedis,
  redisClient: null,
}));

vi.mock("../src/utils/authEmail", () => authEmail);

vi.mock("../src/lib/googleAuth", () => ({ googleClient }));

describe("auth", () => {
  describe("login", () => {
    it("rejects a wrong password with 401", async () => {
      const user = await createUser();
      const res = await request(app)
        .post("/api/auth/login")
        .send({ email: user.email, password: "wrongpass" });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it("rejects a suspended user with 403", async () => {
      const user = await createUser({ status: UserStatus.SUSPENDED });
      const res = await request(app)
        .post("/api/auth/login")
        .send({ email: user.email, password: TEST_PASSWORD });

      expect(res.status).toBe(403);
      expect(res.body.message).toMatch(/suspended/i);
    });

    it("logs in successfully and returns tokens + httpOnly cookies", async () => {
      const user = await createUser();
      const res = await request(app)
        .post("/api/auth/login")
        .send({ email: user.email, password: TEST_PASSWORD });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.accessToken).toBeTruthy();
      expect(res.body.data.refreshToken).toBeTruthy();
      expect(
        (res.headers["set-cookie"] as unknown as string[]).some((c) =>
          c.includes("accessToken"),
        ),
      ).toBe(true);
    });
  });

  describe("register / verify-email", () => {
    it("returns 409 when the email already has an account", async () => {
      const user = await createUser();
      const res = await request(app)
        .post("/api/auth/register")
        .send({
          name: "Duplicate",
          email: user.email,
          password: TEST_PASSWORD,
        });

      expect(res.status).toBe(409);
      expect(res.body.message).toMatch(/already exists/i);
    });

    it("stages a registration, then verify-email creates the user and logs in", async () => {
      const email = `verify-${randomUUID()}@test.dev`;

      const staged = await request(app)
        .post("/api/auth/register")
        .send({ name: "New User", email, password: TEST_PASSWORD, role: Role.USER });
      expect(staged.status).toBe(201);

      // second register while pending → 409 (don't clobber the pending OTP)
      const again = await request(app)
        .post("/api/auth/register")
        .send({ name: "New User", email, password: TEST_PASSWORD });
      expect(again.status).toBe(409);

      // the OTP landed in the (stubbed) Redis store — verify with it
      const otp = redisStore.get(`tripverse:register-otp:${email}`);
      expect(otp).toBeTruthy();

      const verified = await request(app)
        .post("/api/auth/verify-email")
        .send({ email, otp });
      expect(verified.status).toBe(200);
      expect(verified.body.data.accessToken).toBeTruthy();

      const me = await request(app)
        .get("/api/auth/me")
        .set(bearer(verified.body.data.accessToken));
      expect(me.status).toBe(200);
      expect(me.body.data.email).toBe(email);

      // OTP is single-use — a replay must fail. The user now exists, so the
      // service short-circuits with 409 before it ever looks at the OTP again.
      const replay = await request(app)
        .post("/api/auth/verify-email")
        .send({ email, otp });
      expect(replay.status).toBe(409);
      expect(replay.body.message).toMatch(/already verified/i);
    });

    it("returns 400 for an invalid OTP", async () => {
      const email = `verify-${randomUUID()}@test.dev`;
      await request(app)
        .post("/api/auth/register")
        .send({ name: "New User", email, password: TEST_PASSWORD });
      expect(redisStore.get(`tripverse:register-otp:${email}`)).toBeTruthy();

      const res = await request(app)
        .post("/api/auth/verify-email")
        .send({ email, otp: "000000" });
      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/invalid or expired otp/i);
    });
  });

  describe("demo-login", () => {
    it("logs in as a demo agent and mints tokens", async () => {
      const res = await request(app)
        .post("/api/auth/demo-login")
        .send({ role: Role.AGENT });

      expect(res.status).toBe(200);
      expect(res.body.data.user.role).toBe(Role.AGENT);
      expect(res.body.data.accessToken).toBeTruthy();

      // the demo account is shared infrastructure — remove only the ledger
      // rows this test just minted for it, never the user row itself.
      const demo = await prisma.user.findUnique({
        where: { email: "demo-agent@tripverse.com" },
      });
      if (demo) {
        await prisma.refreshToken.deleteMany({
          where: { userId: demo.id },
        });
      }
    });
  });

  describe("refresh rotation", () => {
    it("rotates: old token is revoked, replay triggers reuse detection", async () => {
      const user = await createUser();
      const { refreshToken } = await loginAs(user);

      const rotated = await request(app)
        .post("/api/auth/refresh")
        .send({ refreshToken });
      expect(rotated.status).toBe(200);
      expect(rotated.body.data.refreshToken).not.toBe(refreshToken);

      // replaying the consumed token = theft signature → family nuke
      const replay = await request(app)
        .post("/api/auth/refresh")
        .send({ refreshToken });
      expect(replay.status).toBe(401);
      expect(replay.body.message).toMatch(/reuse detected/i);

      // the family nuke bumps tokenVersion → every access token dies too
      const me = await request(app)
        .get("/api/auth/me")
        .set(bearer(rotated.body.data.accessToken));
      expect(me.status).toBe(401);
    });

    it("rejects a refresh token whose tokenVersion is stale", async () => {
      const user = await createUser();
      const { refreshToken } = await loginAs(user);

      await prisma.user.update({
        where: { id: user.id },
        data: { tokenVersion: { increment: 1 } },
      });

      const res = await request(app)
        .post("/api/auth/refresh")
        .send({ refreshToken });
      expect(res.status).toBe(401);
      expect(res.body.message).toMatch(/no longer valid/i);
    });

    it("logout kills the refresh token and the access token", async () => {
      const user = await createUser();
      const { accessToken, refreshToken } = await loginAs(user);

      const logout = await request(app)
        .post("/api/auth/logout")
        .set(bearer(accessToken));
      expect(logout.status).toBe(200);

      const me = await request(app)
        .get("/api/auth/me")
        .set(bearer(accessToken));
      expect(me.status).toBe(401);

      const refresh = await request(app)
        .post("/api/auth/refresh")
        .send({ refreshToken });
      expect(refresh.status).toBe(401);
    });
  });

  describe("RBAC", () => {
    it("rejects a USER token on an ADMIN-only route with 403", async () => {
      const user = await createUser();
      const { accessToken } = await loginAs(user);

      const res = await request(app)
        .get("/api/users")
        .set(bearer(accessToken));
      expect(res.status).toBe(403);
    });

    it("lets an ADMIN token through the same route", async () => {
      const admin = await createAdmin();
      const { accessToken } = await loginAs(admin);

      const res = await request(app)
        .get("/api/users")
        .set(bearer(accessToken));
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.meta).toBeTruthy();
    });
  });

  describe("google", () => {
    it("never crashes when Google is unconfigured or the token is invalid", async () => {
      const res = await request(app)
        .post("/api/auth/google")
        .send({ idToken: "dummy-id-token" });
      expect([400, 401]).toContain(res.status);
    });
  });
});