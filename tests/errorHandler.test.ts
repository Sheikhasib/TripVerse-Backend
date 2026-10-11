import request from "supertest";
import app from "../src/app";
import config from "../src/config";
import globalErrorHandler from "../src/middleware/globalErrorHandler";

const run = (err: unknown) => {
  const res = {
    statusCode: 0,
    body: undefined as any,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: unknown) {
      this.body = payload;
      return this;
    },
  };
  globalErrorHandler(err, {} as never, res as never, (() => {}) as never);
  return res;
};

describe("global error handler", () => {
  it("returns 400 (not 500) for malformed JSON", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .set("Content-Type", "application/json")
      .send('{"email": "a@b.c", ');

    expect(res.status).toBe(400);
    expect(res.body.message).toBe("Malformed JSON in request body.");
  });

  it("returns 413 for an oversized body", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .set("Content-Type", "application/json")
      .send(JSON.stringify({ email: "a@b.c", password: "x".repeat(200_000) }));

    expect(res.status).toBe(413);
  });

  describe("5xx messages", () => {
    const original = config.is_production;
    afterEach(() => {
      config.is_production = original;
    });

    it("hides internal messages in production", () => {
      config.is_production = true;
      const res = run(new Error("connect ECONNREFUSED 10.0.0.5:5432 password=hunter2"));

      expect(res.statusCode).toBe(500);
      expect(res.body.message).toBe("Internal Server Error");
      expect(JSON.stringify(res.body)).not.toContain("hunter2");
    });

    it("keeps the detailed message outside production", () => {
      config.is_production = false;
      const res = run(new Error("something specific broke"));

      expect(res.statusCode).toBe(500);
      expect(res.body.message).toBe("something specific broke");
    });
  });
});
