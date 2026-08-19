import request from "supertest";
import app from "../src/app";
import { prisma } from "../src/lib/prisma";
import { BookingStatus, PaymentStatus } from "../generated/prisma/enums";
import { AppError } from "../src/utils/appError";
import {
  bearer,
  createAgent,
  createBooking,
  createPackage,
  createPayment,
  createUser,
  futureIso,
  loginAs,
} from "./factories";

// SSLCommerz refund + the Resend email senders are stubbed — no real gateway
// call, no real mail. The in-app `notify` util stays real (harmless DB rows
// cleaned up with their users).
const { sslcommerzRefund, emails } = vi.hoisted(() => ({
  sslcommerzRefund: vi.fn(),
  emails: {
    sendContactNotification: vi.fn(async () => {}),
    sendContactAutoReply: vi.fn(async () => {}),
    sendBookingEmail: vi.fn(async () => {}),
    sendRefundEmail: vi.fn(async () => {}),
  },
}));

vi.mock("../src/lib/sslcommerz", () => ({
  sslcommerzRefund,
  sslcommerzInit: vi.fn(),
  sslcommerzValidate: vi.fn(),
  generateTranId: vi.fn(() => `TRNX-${Date.now()}`),
  generateRefundTranId: vi.fn(() => `RFD-${Date.now()}`),
}));

vi.mock("../src/utils/email", () => emails);

const cancel = (id: string, token: string) =>
  request(app)
    .patch(`/api/bookings/${id}/status`)
    .set(bearer(token))
    .send({ status: BookingStatus.CANCELLED });

describe("booking", () => {
  it("computes totalPrice server-side (client input ignored)", async () => {
    const user = await createUser();
    const tourPackage = await createPackage({ price: 1000 });
    const { accessToken } = await loginAs(user);

    const res = await request(app)
      .post("/api/bookings")
      .set(bearer(accessToken))
      .send({ packageId: tourPackage.id, travelDate: futureIso(7), travelers: 3 });

    expect(res.status).toBe(201);
    expect(res.body.data.totalPrice).toBe(3000);
    expect(res.body.data.status).toBe(BookingStatus.PENDING);
  });

  it("rejects a duplicate pending booking for the same package+date with 409", async () => {
    const user = await createUser();
    const tourPackage = await createPackage();
    const { accessToken } = await loginAs(user);

    const payload = { packageId: tourPackage.id, travelDate: futureIso(7), travelers: 2 };
    const first = await request(app).post("/api/bookings").set(bearer(accessToken)).send(payload);
    expect(first.status).toBe(201);

    const dup = await request(app).post("/api/bookings").set(bearer(accessToken)).send(payload);
    expect(dup.status).toBe(409);
  });

  it("auto-cancels a stale pending booking and rebooks the same package+date", async () => {
    const user = await createUser();
    const tourPackage = await createPackage();
    const { accessToken } = await loginAs(user);

    const stale = await createBooking({
      userId: user.id,
      packageId: tourPackage.id,
      status: BookingStatus.PENDING,
      // the API normalizes travelDate to UTC midnight — the seeded row must
      // use the same normalized value or the stale-match lookup misses it
      travelDate: new Date(`${futureIso(7).slice(0, 10)}T00:00:00.000Z`),
    });
    await prisma.booking.update({
      where: { id: stale.id },
      data: { createdAt: new Date(Date.now() - 25 * 60 * 60 * 1000) },
    });

    const res = await request(app)
      .post("/api/bookings")
      .set(bearer(accessToken))
      .send({ packageId: tourPackage.id, travelDate: futureIso(7), travelers: 2 });

    expect(res.status).toBe(201);

    const old = await prisma.booking.findUnique({ where: { id: stale.id } });
    expect(old?.status).toBe(BookingStatus.CANCELLED);
  });

  it("enforces ownership on the detail route (403 for a foreign user)", async () => {
    const owner = await createUser();
    const stranger = await createUser();
    const booking = await createBooking({ userId: owner.id });

    const { accessToken } = await loginAs(stranger);
    const res = await request(app)
      .get(`/api/bookings/${booking.id}`)
      .set(bearer(accessToken));

    expect(res.status).toBe(403);
  });

  it("blocks an illegal state transition (PENDING → COMPLETED) with 400", async () => {
    const user = await createUser();
    const booking = await createBooking({ userId: user.id });
    const { accessToken } = await loginAs(user);

    const res = await request(app)
      .patch(`/api/bookings/${booking.id}/status`)
      .set(bearer(accessToken))
      .send({ status: BookingStatus.COMPLETED });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/cannot transition/i);
  });

  it("lets the package agent confirm a pending booking", async () => {
    const agent = await createAgent();
    const user = await createUser();
    const tourPackage = await createPackage({ agentId: agent.id });
    const booking = await createBooking({ userId: user.id, packageId: tourPackage.id });

    const { accessToken } = await loginAs(agent);
    const res = await request(app)
      .patch(`/api/bookings/${booking.id}/status`)
      .set(bearer(accessToken))
      .send({ status: BookingStatus.CONFIRMED });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe(BookingStatus.CONFIRMED);
  });

  it("blocks CONFIRMED → COMPLETED before the travel date", async () => {
    const agent = await createAgent();
    const user = await createUser();
    const tourPackage = await createPackage({ agentId: agent.id });
    const booking = await createBooking({
      userId: user.id,
      packageId: tourPackage.id,
      status: BookingStatus.CONFIRMED,
      travelDate: new Date(futureIso(10)),
    });

    const { accessToken } = await loginAs(agent);
    const res = await request(app)
      .patch(`/api/bookings/${booking.id}/status`)
      .set(bearer(accessToken))
      .send({ status: BookingStatus.COMPLETED });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/after the travel date/i);
  });

  it("refunds a settled payment on PAID → CANCELLED and flips it to REFUNDED", async () => {
    sslcommerzRefund.mockResolvedValueOnce({
      APIConnect: "DONE",
      status: "success",
      refund_ref_id: "refund-123",
    });

    const user = await createUser();
    const booking = await createBooking({ userId: user.id, status: BookingStatus.PAID });
    const payment = await createPayment(booking.id, { status: PaymentStatus.SUCCESS });

    const { accessToken } = await loginAs(user);
    const res = await cancel(booking.id, accessToken);

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe(BookingStatus.CANCELLED);
    expect(res.body.data.refund.status).toBe("SUCCESS");
    expect(sslcommerzRefund).toHaveBeenCalledTimes(1);

    const row = await prisma.payment.findUnique({ where: { id: payment.id } });
    expect(row?.status).toBe(PaymentStatus.REFUNDED);
    expect(row?.refundRefId).toBe("refund-123");
    expect(row?.refundCompletedAt).toBeTruthy();
  });

  it("keeps the payment SUCCESS (money-safe) when the gateway refund fails", async () => {
    sslcommerzRefund.mockRejectedValueOnce(
      new AppError(502, "SSLCommerz refund rejected: Invalid Request"),
    );

    const user = await createUser();
    const booking = await createBooking({ userId: user.id, status: BookingStatus.PAID });
    const payment = await createPayment(booking.id, { status: PaymentStatus.SUCCESS });

    const { accessToken } = await loginAs(user);
    const res = await cancel(booking.id, accessToken);

    expect(res.status).toBe(200);
    expect(res.body.data.refund.status).toBe("FAILED");

    const row = await prisma.payment.findUnique({ where: { id: payment.id } });
    expect(row?.status).toBe(PaymentStatus.SUCCESS);
    expect(row?.refundInitiatedAt).toBeTruthy();
    expect(row?.refundCompletedAt).toBeNull();
  });

  it("cancelling a booking with no settled payments carries no refund key", async () => {
    const user = await createUser();
    const booking = await createBooking({ userId: user.id, status: BookingStatus.PAID });

    const { accessToken } = await loginAs(user);
    const res = await cancel(booking.id, accessToken);

    expect(res.status).toBe(200);
    expect(res.body.data.refund).toBeUndefined();
  });

  it("rejects a repeat cancel with 400 (state machine)", async () => {
    const user = await createUser();
    const booking = await createBooking({ userId: user.id, status: BookingStatus.CANCELLED });

    const { accessToken } = await loginAs(user);
    const res = await cancel(booking.id, accessToken);

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/cannot transition/i);
  });
});