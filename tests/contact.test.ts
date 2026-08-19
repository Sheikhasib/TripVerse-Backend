import request from "supertest";
import app from "../src/app";
import { prisma } from "../src/lib/prisma";
import { Role } from "../generated/prisma/enums";
import { bearer, createUser, loginAs } from "./factories";

// The Resend senders are stubbed — the submission itself is the contract, and
// we assert the senders were *called*, never that mail was delivered.
const { emails } = vi.hoisted(() => ({
  emails: {
    sendContactNotification: vi.fn(async () => {}),
    sendContactAutoReply: vi.fn(async () => {}),
  },
}));

vi.mock("../src/utils/email", () => ({
  ...emails,
  sendBookingEmail: vi.fn(async () => {}),
  sendRefundEmail: vi.fn(async () => {}),
}));

const messagePayload = {
  name: "Potential Customer",
  email: "customer@test.dev",
  subject: "Question about a package",
  message: "I would like to know more about the Cox's Bazar tour.",
};

describe("contact", () => {
  it("accepts a public submission and notifies the support inbox", async () => {
    const res = await request(app).post("/api/contact").send(messagePayload);
    expect(res.status).toBe(201);

    const saved = await prisma.contactMessage.findUnique({
      where: { id: res.body.data.id },
    });
    expect(saved?.email).toBe(messagePayload.email);
    expect(saved?.isResolved).toBe(false);

    expect(emails.sendContactNotification).toHaveBeenCalledTimes(1);
    expect(emails.sendContactAutoReply).toHaveBeenCalledTimes(1);
  });

  it("is ADMIN-only for listing (USER → 403)", async () => {
    const user = await createUser();
    const { accessToken } = await loginAs(user);

    const res = await request(app).get("/api/contact").set(bearer(accessToken));
    expect(res.status).toBe(403);
  });

  it("lets an ADMIN list and resolve messages", async () => {
    const admin = await createUser({ role: Role.ADMIN });
    const { accessToken } = await loginAs(admin);

    await request(app).post("/api/contact").send(messagePayload);

    const list = await request(app).get("/api/contact").set(bearer(accessToken));
    expect(list.status).toBe(200);
    expect(list.body.meta.total).toBeGreaterThanOrEqual(1);

    const messageId = list.body.data[0].id;
    const resolved = await request(app)
      .patch(`/api/contact/${messageId}`)
      .set(bearer(accessToken))
      .send({ isResolved: true });
    expect(resolved.status).toBe(200);
    expect(resolved.body.data.isResolved).toBe(true);
  });
});