import request from "supertest";
import app from "../src/app";
import { prisma } from "../src/lib/prisma";
import {
  BookingStatus,
  PaymentStatus,
  RefundReasonCategory,
  RefundRequestStatus,
} from "../generated/prisma/enums";
import { AppError } from "../src/utils/appError";
import { refundService } from "../src/modules/refund/refund.service";
import {
  bearer,
  createAdmin,
  createAgent,
  createBooking,
  createPackage,
  createPayment,
  createUser,
  futureIso,
  loginAs,
} from "./factories";

// SSLCommerz refund + every Resend sender are stubbed — no real gateway call,
// no real mail. The in-app `notify` util stays real (rows cleaned with users).
const { sslcommerzRefund, emails } = vi.hoisted(() => ({
  sslcommerzRefund: vi.fn(),
  emails: {
    sendContactNotification: vi.fn(async () => {}),
    sendContactAutoReply: vi.fn(async () => {}),
    sendBookingEmail: vi.fn(async () => {}),
    sendRefundEmail: vi.fn(async () => {}),
    sendRefundReceivedEmail: vi.fn(async () => {}),
    sendRefundDecisionEmail: vi.fn(async () => {}),
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

// call-count assertions are per-test — gateway calls from earlier tests in the
// file must not leak into them
beforeEach(() => {
  sslcommerzRefund.mockClear();
});

const FAR_DATE = () => new Date(futureIso(40)); // ≥30 days → 90% tier

const apply = (token: string, body: object) =>
  request(app).post("/api/refunds").set(bearer(token)).send(body);

const decide = (id: string, token: string, body: object) =>
  request(app)
    .patch(`/api/refunds/${id}/decision`)
    .set(bearer(token))
    .send(body);

const applicationBody = (
  bookingId: string,
  overrides: Partial<{ category: RefundReasonCategory; evidenceUrl: string }> = {},
) => ({
  bookingId,
  category: overrides.category ?? RefundReasonCategory.CHANGE_OF_PLANS,
  reason: "My travel plans changed because of an unexpected work conflict.",
  ...(overrides.evidenceUrl ? { evidenceUrl: overrides.evidenceUrl } : {}),
});

describe("refund", () => {
  it("suggests policy percentages per tier and category (pure engine)", () => {
    const { suggestRefundPercentage } = refundService;
    expect(suggestRefundPercentage(RefundReasonCategory.CHANGE_OF_PLANS, 45)).toBe(90);
    expect(suggestRefundPercentage(RefundReasonCategory.CHANGE_OF_PLANS, 30)).toBe(90);
    expect(suggestRefundPercentage(RefundReasonCategory.CHANGE_OF_PLANS, 29)).toBe(50);
    expect(suggestRefundPercentage(RefundReasonCategory.CHANGE_OF_PLANS, 15)).toBe(50);
    expect(suggestRefundPercentage(RefundReasonCategory.CHANGE_OF_PLANS, 14)).toBe(25);
    expect(suggestRefundPercentage(RefundReasonCategory.CHANGE_OF_PLANS, 7)).toBe(25);
    expect(suggestRefundPercentage(RefundReasonCategory.CHANGE_OF_PLANS, 6)).toBe(0);
    expect(suggestRefundPercentage(RefundReasonCategory.CHANGE_OF_PLANS, -3)).toBe(0);
    // docs-backed categories suggest the enhanced rate regardless of timing
    expect(suggestRefundPercentage(RefundReasonCategory.MEDICAL_EMERGENCY, 2)).toBe(100);
    expect(suggestRefundPercentage(RefundReasonCategory.FORCE_MAJEURE, 60)).toBe(100);
  });

  it("creates an application with an immutable policy snapshot", async () => {
    const user = await createUser();
    const tourPackage = await createPackage({ price: 2000 });
    const booking = await createBooking({
      userId: user.id,
      packageId: tourPackage.id,
      totalPrice: 2000,
      status: BookingStatus.PAID,
      travelDate: FAR_DATE(),
    });
    const { accessToken } = await loginAs(user);

    const res = await apply(accessToken, applicationBody(booking.id));

    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe(RefundRequestStatus.PENDING);
    expect(res.body.data.suggestedPercentage).toBe(90);
    expect(res.body.data.daysBeforeTravel).toBeGreaterThanOrEqual(30);
    expect(res.body.data.booking.status).toBe(BookingStatus.PAID);
    expect(res.body.data.refundAmount).toBeNull();
  });

  it("rejects an application without evidence for a docs-backed category", async () => {
    const user = await createUser();
    const booking = await createBooking({
      userId: user.id,
      status: BookingStatus.PAID,
      travelDate: FAR_DATE(),
    });
    const { accessToken } = await loginAs(user);

    const res = await apply(
      accessToken,
      applicationBody(booking.id, { category: RefundReasonCategory.MEDICAL_EMERGENCY }),
    );

    expect(res.status).toBe(400);
  });

  it("rejects applications on unpaid bookings and on someone else's booking", async () => {
    const owner = await createUser();
    const stranger = await createUser();
    const ownerToken = (await loginAs(owner)).accessToken;
    const strangerToken = (await loginAs(stranger)).accessToken;

    // unpaid own booking → policy guard
    const pending = await createBooking({
      userId: owner.id,
      status: BookingStatus.PENDING,
      travelDate: FAR_DATE(),
    });
    const unpaid = await apply(ownerToken, applicationBody(pending.id));
    expect(unpaid.status).toBe(400);

    // someone else's paid booking → indistinguishable from missing (404)
    const ownedByOwner = await createBooking({
      userId: owner.id,
      status: BookingStatus.PAID,
      travelDate: FAR_DATE(),
    });
    const res = await apply(strangerToken, applicationBody(ownedByOwner.id));
    expect(res.status).toBe(404);
  });

  it("blocks a second live application for the same booking", async () => {
    const user = await createUser();
    const booking = await createBooking({
      userId: user.id,
      status: BookingStatus.PAID,
      travelDate: FAR_DATE(),
    });
    const { accessToken } = await loginAs(user);

    const first = await apply(accessToken, applicationBody(booking.id));
    expect(first.status).toBe(201);

    const second = await apply(accessToken, applicationBody(booking.id));
    expect(second.status).toBe(409);
  });

  it("allows exactly one re-application after a rejection, then stops", async () => {
    const user = await createUser();
    const admin = await createAdmin();
    const booking = await createBooking({
      userId: user.id,
      status: BookingStatus.PAID,
      travelDate: FAR_DATE(),
    });
    const userToken = (await loginAs(user)).accessToken;
    const adminToken = (await loginAs(admin)).accessToken;

    const first = await apply(userToken, applicationBody(booking.id));
    const rejected = await decide(first.body.data.id, adminToken, {
      action: "REJECT",
      reviewNote: "Evidence does not verify the stated facts.",
    });
    expect(rejected.status).toBe(200);
    expect(rejected.body.data.refundRequest.status).toBe(RefundRequestStatus.REJECTED);

    // booking untouched by a rejection
    const freshBooking = await prisma.booking.findUnique({
      where: { id: booking.id },
    });
    expect(freshBooking?.status).toBe(BookingStatus.PAID);

    const reapplied = await apply(userToken, applicationBody(booking.id));
    expect(reapplied.status).toBe(201);

    const rejectedAgain = await decide(reapplied.body.data.id, adminToken, {
      action: "REJECT",
      reviewNote: "Still unverifiable.",
    });
    expect(rejectedAgain.status).toBe(200);

    const third = await apply(userToken, applicationBody(booking.id));
    expect(third.status).toBe(409);
  });

  it("requires an admin note on rejection and forbids non-admin decisions", async () => {
    const user = await createUser();
    const agent = await createAgent();
    const admin = await createAdmin();
    const booking = await createBooking({
      userId: user.id,
      status: BookingStatus.PAID,
      travelDate: FAR_DATE(),
    });
    const userToken = (await loginAs(user)).accessToken;
    const agentToken = (await loginAs(agent)).accessToken;
    const adminToken = (await loginAs(admin)).accessToken;

    const created = await apply(userToken, applicationBody(booking.id));
    const id = created.body.data.id;

    // route-level RBAC fires before validation for a non-admin
    const byAgent = await decide(id, agentToken, {
      action: "REJECT",
      reviewNote: "not allowed",
    });
    expect(byAgent.status).toBe(403);

    // admin without a note → Zod 400
    const noNote = await decide(id, adminToken, { action: "REJECT" });
    expect(noNote.status).toBe(400);
  });

  it("approves with a capped partial payout against a single settled payment", async () => {
    sslcommerzRefund.mockResolvedValueOnce({
      APIConnect: "DONE",
      status: "success",
      refund_ref_id: "rref-1",
    });

    const user = await createUser();
    const admin = await createAdmin();
    const tourPackage = await createPackage({ price: 1000 });
    const booking = await createBooking({
      userId: user.id,
      packageId: tourPackage.id,
      travelers: 2,
      totalPrice: 2000,
      status: BookingStatus.PAID,
      travelDate: FAR_DATE(),
    });
    const payment = await createPayment(booking.id, {
      amount: 2000,
      status: PaymentStatus.SUCCESS,
    });
    const userToken = (await loginAs(user)).accessToken;
    const adminToken = (await loginAs(admin)).accessToken;

    const created = await apply(userToken, applicationBody(booking.id));
    const res = await decide(created.body.data.id, adminToken, { action: "APPROVE" });

    expect(res.status).toBe(200);
    expect(res.body.data.payout.status).toBe("SUCCESS");
    expect(res.body.data.payout.refundedTotal).toBe(1800); // 90% of 2000
    expect(res.body.data.refundRequest.status).toBe(RefundRequestStatus.REFUNDED);
    expect(res.body.data.refundRequest.approvedPercentage).toBe(90);
    expect(res.body.data.refundRequest.refundAmount).toBe(1800);

    expect(sslcommerzRefund).toHaveBeenCalledTimes(1);
    expect(sslcommerzRefund).toHaveBeenCalledWith(
      expect.objectContaining({ refund_amount: 1800 }),
    );

    const paymentRow = await prisma.payment.findUnique({
      where: { id: payment.id },
    });
    expect(paymentRow?.status).toBe(PaymentStatus.REFUNDED);
    expect(paymentRow?.refundRefId).toBe("rref-1");

    const bookingRow = await prisma.booking.findUnique({
      where: { id: booking.id },
    });
    expect(bookingRow?.status).toBe(BookingStatus.CANCELLED);
  });

  it("allocates the approved total across several settled payments (partial last)", async () => {
    sslcommerzRefund.mockResolvedValue({
      APIConnect: "DONE",
      status: "success",
      refund_ref_id: "rref-multi",
    });

    const user = await createUser();
    const admin = await createAdmin();
    const booking = await createBooking({
      userId: user.id,
      totalPrice: 2000,
      status: BookingStatus.PAID,
      travelDate: FAR_DATE(),
    });
    const first = await createPayment(booking.id, {
      amount: 1200,
      status: PaymentStatus.SUCCESS,
    });
    const second = await createPayment(booking.id, {
      amount: 800,
      status: PaymentStatus.SUCCESS,
    });
    const userToken = (await loginAs(user)).accessToken;
    const adminToken = (await loginAs(admin)).accessToken;

    const created = await apply(userToken, applicationBody(booking.id));
    // 50% of 2000 = 1000 → slices into the first payment only
    const res = await decide(created.body.data.id, adminToken, {
      action: "APPROVE",
      approvedPercentage: 50,
    });

    expect(res.status).toBe(200);
    expect(res.body.data.payout.status).toBe("SUCCESS");
    expect(res.body.data.payout.refundedTotal).toBe(1000);
    expect(sslcommerzRefund).toHaveBeenCalledTimes(1);
    expect(sslcommerzRefund).toHaveBeenCalledWith(
      expect.objectContaining({ refund_amount: 1000 }),
    );

    expect((await prisma.payment.findUnique({ where: { id: first.id } }))?.status).toBe(
      PaymentStatus.REFUNDED,
    );
    expect((await prisma.payment.findUnique({ where: { id: second.id } }))?.status).toBe(
      PaymentStatus.SUCCESS,
    );
  });

  it("never grants CHANGE_OF_PLANS above the submitted tier, even if asked", async () => {
    sslcommerzRefund.mockResolvedValueOnce({
      APIConnect: "DONE",
      status: "success",
      refund_ref_id: "rref-cap",
    });

    const user = await createUser();
    const admin = await createAdmin();
    const booking = await createBooking({
      userId: user.id,
      totalPrice: 2000,
      status: BookingStatus.PAID,
      travelDate: FAR_DATE(), // suggested 90
    });
    await createPayment(booking.id, { amount: 2000, status: PaymentStatus.SUCCESS });
    const userToken = (await loginAs(user)).accessToken;
    const adminToken = (await loginAs(admin)).accessToken;

    const created = await apply(userToken, applicationBody(booking.id));
    const res = await decide(created.body.data.id, adminToken, {
      action: "APPROVE",
      approvedPercentage: 100, // must clamp to 90
    });

    expect(res.status).toBe(200);
    expect(res.body.data.refundRequest.approvedPercentage).toBe(90);
    expect(res.body.data.refundRequest.refundAmount).toBe(1800);
  });

  it("keeps the request APPROVED (money owed) when the gateway payout fails", async () => {
    sslcommerzRefund.mockRejectedValueOnce(
      new AppError(502, "SSLCommerz refund rejected: Insufficient Balance"),
    );

    const user = await createUser();
    const admin = await createAdmin();
    const booking = await createBooking({
      userId: user.id,
      totalPrice: 2000,
      status: BookingStatus.PAID,
      travelDate: FAR_DATE(),
    });
    const payment = await createPayment(booking.id, {
      amount: 2000,
      status: PaymentStatus.SUCCESS,
    });
    const userToken = (await loginAs(user)).accessToken;
    const adminToken = (await loginAs(admin)).accessToken;

    const created = await apply(userToken, applicationBody(booking.id));
    const res = await decide(created.body.data.id, adminToken, { action: "APPROVE" });

    expect(res.status).toBe(200);
    expect(res.body.data.payout.status).toBe("FAILED");
    expect(res.body.data.refundRequest.status).toBe(RefundRequestStatus.APPROVED);

    const bookingRow = await prisma.booking.findUnique({
      where: { id: booking.id },
    });
    expect(bookingRow?.status).toBe(BookingStatus.CANCELLED);

    const paymentRow = await prisma.payment.findUnique({
      where: { id: payment.id },
    });
    expect(paymentRow?.status).toBe(PaymentStatus.SUCCESS);
    expect(paymentRow?.refundInitiatedAt).toBeTruthy();
    expect(paymentRow?.refundCompletedAt).toBeNull();
  });

  it("rejects a repeated decision with 409 (CAS)", async () => {
    sslcommerzRefund.mockResolvedValue({
      APIConnect: "DONE",
      status: "success",
      refund_ref_id: "rref-dbl",
    });

    const user = await createUser();
    const admin = await createAdmin();
    const booking = await createBooking({
      userId: user.id,
      totalPrice: 2000,
      status: BookingStatus.PAID,
      travelDate: FAR_DATE(),
    });
    await createPayment(booking.id, { amount: 2000, status: PaymentStatus.SUCCESS });
    const userToken = (await loginAs(user)).accessToken;
    const adminToken = (await loginAs(admin)).accessToken;

    const created = await apply(userToken, applicationBody(booking.id));
    const first = await decide(created.body.data.id, adminToken, { action: "APPROVE" });
    expect(first.status).toBe(200);

    const again = await decide(created.body.data.id, adminToken, { action: "APPROVE" });
    expect(again.status).toBe(409);
    expect(again.body.message).toMatch(/already been decided/i);
    expect(sslcommerzRefund).toHaveBeenCalledTimes(1); // never double-pays
  });

  it("enforces access on detail and lists mine vs all", async () => {
    const user = await createUser();
    const stranger = await createUser();
    const admin = await createAdmin();
    const booking = await createBooking({
      userId: user.id,
      status: BookingStatus.PAID,
      travelDate: FAR_DATE(),
    });
    const refundRequest = await createRefundRequestViaApi(
      booking.id,
      (await loginAs(user)).accessToken,
    );
    const strangerToken = (await loginAs(stranger)).accessToken;
    const userToken = (await loginAs(user)).accessToken;
    const adminToken = (await loginAs(admin)).accessToken;

    const forbidden = await request(app)
      .get(`/api/refunds/${refundRequest.id}`)
      .set(bearer(strangerToken));
    expect(forbidden.status).toBe(403);

    const own = await request(app)
      .get(`/api/refunds/${refundRequest.id}`)
      .set(bearer(userToken));
    expect(own.status).toBe(200);

    const adminView = await request(app)
      .get(`/api/refunds/${refundRequest.id}`)
      .set(bearer(adminToken));
    expect(adminView.status).toBe(200);

    const mine = await request(app)
      .get("/api/refunds/mine")
      .set(bearer(userToken));
    expect(mine.status).toBe(200);
    expect(mine.body.data.some((r: { id: string }) => r.id === refundRequest.id)).toBe(true);

    const all = await request(app).get("/api/refunds").set(bearer(adminToken));
    expect(all.status).toBe(200);
    expect(all.body.meta.total).toBeGreaterThanOrEqual(1);
  });
});

// Applies through the real endpoint so validation + snapshot paths stay exercised.
async function createRefundRequestViaApi(bookingId: string, token: string) {
  const res = await apply(token, applicationBody(bookingId));
  if (res.status !== 201) {
    throw new Error(
      `createRefundRequestViaApi failed (${res.status}): ${JSON.stringify(res.body)}`,
    );
  }
  return res.body.data as { id: string };
}
