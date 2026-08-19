import config from "../src/config";
import { BookingStatus } from "../generated/prisma/enums";
import {
  sendBookingEmail,
  sendContactNotification,
  sendRefundEmail,
} from "../src/utils/email";

// The `resend` SDK is stubbed with a class whose `emails.send` we control, and
// config is pointed at it directly — so these tests exercise the real
// best-effort wrapper (sendWithLog) without ever touching the network.
const { send } = vi.hoisted(() => ({ send: vi.fn() }));

vi.mock("resend", () => ({
  Resend: class {
    emails = { send };
  },
}));

describe("email (best-effort semantics)", () => {
  beforeEach(() => {
    config.resend_api_key = "re_test_mocked";
    config.contact_receiver_email = "support@tripverse.test";
    send.mockReset();
  });

  it("a failed sender never throws — the caller's request survives", async () => {
    send.mockRejectedValueOnce(new Error("SMTP unavailable"));

    await expect(
      sendBookingEmail({
        email: "customer@test.dev",
        name: "Customer",
        packageTitle: "Cox's Bazar Tour",
        travelDate: new Date(),
        travelers: 2,
        totalPrice: 2000,
        status: BookingStatus.CONFIRMED,
      }),
    ).resolves.toBeUndefined();

    expect(send).toHaveBeenCalledTimes(1);
  });

  it("a successful send passes the expected subject and payload", async () => {
    send.mockResolvedValueOnce({ id: "email_1" });

    await sendRefundEmail({
      email: "customer@test.dev",
      name: "Customer",
      packageTitle: "Cox's Bazar Tour",
      travelDate: new Date(),
      amount: 2000,
      refundRefId: "refund-123",
    });

    expect(send).toHaveBeenCalledTimes(1);
    const call = send.mock.calls[0]?.[0] as { subject?: string; to: string[] };
    expect(call.subject).toMatch(/refund/i);
    expect(call.to).toEqual(["customer@test.dev"]);
  });

  it("contact notifications no-op cleanly when the receiver is missing", async () => {
    config.contact_receiver_email = undefined;

    await expect(
      sendContactNotification({
        name: "Sender",
        email: "sender@test.dev",
        subject: "Hi",
        message: "Hello from the contact form.",
      }),
    ).resolves.toBeUndefined();

    expect(send).not.toHaveBeenCalled();
  });
});