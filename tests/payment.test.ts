import request from "supertest";
import app from "../src/app";
import { prisma } from "../src/lib/prisma";
import { BookingStatus, PaymentStatus } from "../generated/prisma/enums";
import {
  bearer,
  createBooking,
  createPayment,
  createUser,
  loginAs,
} from "./factories";

// The SSLCommerz gateway is mocked at the lib boundary — no real init/validate
// call ever happens. Email senders are stubbed too so nothing is actually sent.
const { sslcommerzInit, sslcommerzValidate, emails } = vi.hoisted(() => ({
  sslcommerzInit: vi.fn(),
  sslcommerzValidate: vi.fn(),
  emails: {
    sendContactNotification: vi.fn(async () => {}),
    sendContactAutoReply: vi.fn(async () => {}),
    sendBookingEmail: vi.fn(async () => {}),
    sendRefundEmail: vi.fn(async () => {}),
  },
}));

vi.mock("../src/lib/sslcommerz", () => ({
  sslcommerzRefund: vi.fn(),
  sslcommerzInit,
  sslcommerzValidate,
  generateTranId: vi.fn(
    () => `TRNX-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
  ),
  generateRefundTranId: vi.fn(() => `RFD-${Date.now()}`),
}));

vi.mock("../src/utils/email", () => emails);

const gatewayBody = {
  status: "VALID",
  val_id: "val-test-1",
  card_type: "VISA",
  bank_tran_id: "bank-test-1",
};

// What the gateway validator returns for a genuine, matching transaction.
const validatorFor = (tranId: string, overrides: Record<string, string> = {}) => ({
  status: "VALID",
  tran_id: tranId,
  amount: "2000.00",
  currency_type: "BDT",
  bank_tran_id: gatewayBody.bank_tran_id,
  ...overrides,
});

async function settledBooking() {
  const user = await createUser();
  const booking = await createBooking({ userId: user.id });
  const { accessToken } = await loginAs(user);

  const session = await request(app)
    .post("/api/payments/create")
    .set(bearer(accessToken))
    .send({ bookingId: booking.id });
  expect(session.status).toBe(201);

  return { user, booking, accessToken, session };
}

describe("payment", () => {
  beforeEach(() => {
    sslcommerzInit.mockReset();
    sslcommerzValidate.mockReset();
    sslcommerzInit.mockResolvedValue({
      status: "SUCCESS",
      GatewayPageURL: "https://sandbox.sslcommerz.com/gwprocess/v4/checkout.php?token=x",
      sessionkey: "sk-test",
    });
  });

  it("creates a gateway session for an owned pending booking", async () => {
    const { booking, accessToken, session } = await settledBooking();

    expect(session.body.data.paymentUrl).toContain("sandbox.sslcommerz.com");
    expect(session.body.data.paymentId).toBeTruthy();

    const payment = await prisma.payment.findUnique({
      where: { id: session.body.data.paymentId },
    });
    expect(payment?.status).toBe(PaymentStatus.INITIATED);
    expect(payment?.tranId).toBe(session.body.data.tranId);
    expect(payment?.bookingId).toBe(booking.id);
  });

  it("forbids paying for another user's booking (403)", async () => {
    const owner = await createUser();
    const stranger = await createUser();
    const booking = await createBooking({ userId: owner.id });

    const { accessToken } = await loginAs(stranger);
    const res = await request(app)
      .post("/api/payments/create")
      .set(bearer(accessToken))
      .send({ bookingId: booking.id });

    expect(res.status).toBe(403);
  });

  it("forbids paying for a PAID booking (409)", async () => {
    const user = await createUser();
    const booking = await createBooking({ userId: user.id, status: BookingStatus.PAID });

    const { accessToken } = await loginAs(user);
    const res = await request(app)
      .post("/api/payments/create")
      .set(bearer(accessToken))
      .send({ bookingId: booking.id });

    expect(res.status).toBe(409);
    expect(res.body.message).toMatch(/already paid/i);
  });

  it("forbids paying for a CONFIRMED booking (409)", async () => {
    const user = await createUser();
    const booking = await createBooking({ userId: user.id, status: BookingStatus.CONFIRMED });

    const { accessToken } = await loginAs(user);
    const res = await request(app)
      .post("/api/payments/create")
      .set(bearer(accessToken))
      .send({ bookingId: booking.id });

    expect(res.status).toBe(409);
  });

  it("settles the booking only after the validator confirms the amount", async () => {
    const { booking, session } = await settledBooking();
    const tranId = session.body.data.tranId;
    sslcommerzValidate.mockResolvedValue(validatorFor(tranId));

    const confirm = await request(app)
      .post(`/api/payments/confirm?bookingId=${booking.id}&tranId=${tranId}&status=success`)
      .send(gatewayBody);

    // SSLCommerz callback target redirects the browser to the frontend
    expect(confirm.status).toBe(302);
    expect(confirm.headers.location).toContain("/payment/success");

    const payment = await prisma.payment.findUnique({ where: { tranId } });
    expect(payment?.status).toBe(PaymentStatus.SUCCESS);
    expect(payment?.paidAt).toBeTruthy();

    const after = await prisma.booking.findUnique({ where: { id: booking.id } });
    expect(after?.status).toBe(BookingStatus.PAID);
  });

  it("a double-fired IPN is idempotent — never double-settles", async () => {
    const { booking, session } = await settledBooking();
    const tranId = session.body.data.tranId;
    sslcommerzValidate.mockResolvedValue(validatorFor(tranId));

    const first = await request(app)
      .post(`/api/payments/ipn?bookingId=${booking.id}&tranId=${tranId}`)
      .send(gatewayBody);
    expect(first.status).toBe(200);

    const second = await request(app)
      .post(`/api/payments/ipn?bookingId=${booking.id}&tranId=${tranId}`)
      .send(gatewayBody);
    expect(second.status).toBe(200);

    const payments = await prisma.payment.findMany({ where: { tranId } });
    expect(payments).toHaveLength(1);
    expect(payments[0]?.status).toBe(PaymentStatus.SUCCESS);

    const bookingAfter = await prisma.booking.findUnique({ where: { id: booking.id } });
    expect(bookingAfter?.status).toBe(BookingStatus.PAID);
  });

  it("fails the payment when the validated amount does not match", async () => {
    // validator reports a different amount than the frozen booking total
    const { booking, session } = await settledBooking();
    const tranId = session.body.data.tranId;
    sslcommerzValidate.mockResolvedValue(validatorFor(tranId, { amount: "1.00" }));

    await request(app)
      .post(`/api/payments/confirm?bookingId=${booking.id}&tranId=${tranId}&status=success`)
      .send(gatewayBody);

    const payment = await prisma.payment.findUnique({ where: { tranId } });
    expect(payment?.status).toBe(PaymentStatus.FAILED);

    const bookingAfter = await prisma.booking.findUnique({ where: { id: booking.id } });
    expect(bookingAfter?.status).toBe(BookingStatus.PENDING);
  });

  it("rejects a val_id replayed from another paid booking with the same total", async () => {
    const paid = await settledBooking();
    const victim = await settledBooking();
    const paidTranId = paid.session.body.data.tranId;
    const victimTranId = victim.session.body.data.tranId;

    // the validator knows val-A as the genuine payment of the FIRST booking only
    sslcommerzValidate.mockImplementation(async ({ val_id }: { val_id: string }) =>
      validatorFor(val_id === "val-A" ? paidTranId : "someone-else"),
    );

    const real = await request(app)
      .post(`/api/payments/ipn?bookingId=${paid.booking.id}&tranId=${paidTranId}`)
      .send({ ...gatewayBody, val_id: "val-A" });
    expect(real.status).toBe(200);
    expect((await prisma.payment.findUnique({ where: { tranId: paidTranId } }))?.status).toBe(
      PaymentStatus.SUCCESS,
    );

    // attacker replays val-A against the second booking (same 2000.00 total)
    await request(app)
      .post(`/api/payments/confirm?bookingId=${victim.booking.id}&tranId=${victimTranId}&status=success`)
      .send({ ...gatewayBody, val_id: "val-A" });

    const payment = await prisma.payment.findUnique({ where: { tranId: victimTranId } });
    expect(payment?.status).toBe(PaymentStatus.FAILED);
    const bookingAfter = await prisma.booking.findUnique({ where: { id: victim.booking.id } });
    expect(bookingAfter?.status).toBe(BookingStatus.PENDING);
  });

  it("fails the payment when the validator currency is not BDT", async () => {
    const { booking, session } = await settledBooking();
    const tranId = session.body.data.tranId;
    sslcommerzValidate.mockResolvedValue(validatorFor(tranId, { currency_type: "USD" }));

    await request(app)
      .post(`/api/payments/ipn?bookingId=${booking.id}&tranId=${tranId}`)
      .send(gatewayBody);

    const payment = await prisma.payment.findUnique({ where: { tranId } });
    expect(payment?.status).toBe(PaymentStatus.FAILED);
  });

  it("marks a cancel callback payment as CANCELLED", async () => {
    const { booking, session } = await settledBooking();
    const tranId = session.body.data.tranId;

    const res = await request(app)
      .post(`/api/payments/confirm?bookingId=${booking.id}&tranId=${tranId}&status=cancel`)
      .send({ status: "CANCELLED", fail_status: "CANCELLED" });

    expect(res.status).toBe(302);

    const payment = await prisma.payment.findUnique({ where: { tranId } });
    expect(payment?.status).toBe(PaymentStatus.CANCELLED);
  });

  it("marks a fail callback (no val_id) payment as FAILED", async () => {
    const { booking, session } = await settledBooking();
    const tranId = session.body.data.tranId;

    const res = await request(app)
      .post(`/api/payments/confirm?bookingId=${booking.id}&tranId=${tranId}&status=fail`)
      .send({ status: "FAILED" });

    expect(res.status).toBe(302);

    const payment = await prisma.payment.findUnique({ where: { tranId } });
    expect(payment?.status).toBe(PaymentStatus.FAILED);
  });

  it("ignores a callback for a session we never created", async () => {
    sslcommerzValidate.mockResolvedValue({
      status: "VALID",
      amount: "2000.00",
    });

    const user = await createUser();
    const booking = await createBooking({ userId: user.id });

    const res = await request(app)
      .post(`/api/payments/confirm?bookingId=${booking.id}&tranId=never-minted&status=success`)
      .send(gatewayBody);

    expect(res.status).toBe(302);

    const bookingAfter = await prisma.booking.findUnique({ where: { id: booking.id } });
    expect(bookingAfter?.status).toBe(BookingStatus.PENDING);
  });

  it("keeps an existing success payment untouched when a payment row already exists", async () => {
    // A settled payment short-circuits processGatewayResult — even an IPN with
    // mismatched data cannot flip it.
    const user = await createUser();
    const booking = await createBooking({ userId: user.id, status: BookingStatus.PAID });
    await createPayment(booking.id, {
      tranId: "already-settled",
      status: PaymentStatus.SUCCESS,
    });

    await request(app)
      .post(`/api/payments/ipn?bookingId=${booking.id}&tranId=already-settled`)
      .send({ status: "FAILED" });

    const payment = await prisma.payment.findUnique({ where: { tranId: "already-settled" } });
    expect(payment?.status).toBe(PaymentStatus.SUCCESS);
  });
});