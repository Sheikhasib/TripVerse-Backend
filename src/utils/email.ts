import { Resend } from "resend";
import { BookingStatus } from "../../generated/prisma/enums";
import config from "../config";

export interface IContactEmailDetails {
  name: string;
  email: string;
  subject: string;
  message: string;
  createdAt?: Date;
}

// Lazily initialised so the module is importable even when RESEND_API_KEY
// is not configured (e.g. local dev / demo without email).
let resend: Resend | null = null;

function getResend(): Resend | null {
  if (resend) return resend;
  if (!config.resend_api_key) return null;
  resend = new Resend(config.resend_api_key);
  return resend;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

const emailLayout = (content: string) => `
  <div style="font-family: Arial, Helvetica, sans-serif; max-width: 560px; margin: 0 auto; color: #1a1a1a;">
    <div style="background: #0f766e; padding: 24px; border-radius: 8px 8px 0 0;">
      <span style="color: #ffffff; font-size: 18px; font-weight: bold;">TripVerse</span>
    </div>
    <div style="border: 1px solid #e5e7eb; border-top: none; padding: 32px; border-radius: 0 0 8px 8px;">
      ${content}
    </div>
    <p style="font-size: 12px; color: #6b7280; margin-top: 16px; text-align: center;">
      You are receiving this email because of activity on TripVerse.
    </p>
  </div>
`;

// Notifies the support inbox about a new contact form submission.
export const sendContactNotification = async (
  details: IContactEmailDetails,
): Promise<void> => {
  const client = getResend();
  if (!client || !config.contact_receiver_email) {
    console.warn("[email] Resend not configured; skipping contact notification.");
    return;
  }

  const from = config.email_from || "TripVerse <onboarding@resend.dev>";
  const createdAt = details.createdAt?.toISOString() ?? "just now";

  const content = `
    <h2 style="margin-top: 0; font-size: 18px;">New contact message</h2>
    <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
      <tr>
        <td style="padding: 8px 0; color: #6b7280; width: 120px;">Name</td>
        <td style="padding: 8px 0;"><strong>${escapeHtml(details.name)}</strong></td>
      </tr>
      <tr>
        <td style="padding: 8px 0; color: #6b7280;">Email</td>
        <td style="padding: 8px 0;">${escapeHtml(details.email)}</td>
      </tr>
      <tr>
        <td style="padding: 8px 0; color: #6b7280;">Subject</td>
        <td style="padding: 8px 0;"><strong>${escapeHtml(details.subject)}</strong></td>
      </tr>
      <tr>
        <td style="padding: 8px 0; color: #6b7280;">Received</td>
        <td style="padding: 8px 0;">${escapeHtml(createdAt)}</td>
      </tr>
    </table>
    <div style="margin-top: 16px; padding: 16px; background: #f9fafb; border-radius: 6px; white-space: pre-wrap;">
      ${escapeHtml(details.message)}
    </div>
  `;

  await client.emails.send({
    from,
    to: [config.contact_receiver_email],
    subject: `New contact message: ${details.subject}`,
    html: emailLayout(content),
  });
};

// Sends a confirmation reply to the person who submitted the form.
export const sendContactAutoReply = async (
  details: IContactEmailDetails,
): Promise<void> => {
  const client = getResend();
  if (!client || !details.email) {
    console.warn("[email] Resend not configured; skipping contact auto-reply.");
    return;
  }

  const from = config.email_from || "TripVerse <onboarding@resend.dev>";
  const receiverEmail = config.contact_receiver_email;

  const content = `
    <h2 style="margin-top: 0; font-size: 18px;">Thanks for reaching out, ${escapeHtml(details.name)}!</h2>
    <p style="font-size: 14px; line-height: 1.6; color: #374151;">
      We&apos;ve received your message about
      <strong>&ldquo;${escapeHtml(details.subject)}&rdquo;</strong> and our support
      team will get back to you within one business day.
    </p>
  `;

  await client.emails.send({
    from,
    to: [details.email],
    replyTo: receiverEmail,
    subject: "We received your message - TripVerse",
    html: emailLayout(content),
  });
};

// ── Booking emails ─────────────────────────────────────────────────────────
export interface IBookingEmailDetails {
  email: string;
  name: string;
  packageTitle: string;
  travelDate: Date;
  travelers: number;
  totalPrice: number;
  status: BookingStatus;
}

// Informs the customer about a booking create/confirm/cancel.
// Best-effort like the contact emails — a failure must never fail the request.
export const sendBookingEmail = async (
  details: IBookingEmailDetails,
): Promise<void> => {
  const client = getResend();
  if (!client || !details.email) {
    console.warn("[email] Resend not configured; skipping booking email.");
    return;
  }

  const from = config.email_from || "TripVerse <onboarding@resend.dev>";
  const travelDate = details.travelDate.toISOString().slice(0, 10);

  const statusCopy: Record<
    BookingStatus,
    { subject: string; heading: string; body: string }
  > = {
    [BookingStatus.PENDING]: {
      subject: "Booking received - TripVerse",
      heading: "Booking received",
      body: "We've received your booking request. The agent will confirm it shortly.",
    },
    [BookingStatus.PAID]: {
      subject: "Payment received - TripVerse",
      heading: "Payment received",
      body: "Your payment has been received, and the agent will confirm your booking shortly.",
    },
    [BookingStatus.CONFIRMED]: {
      subject: "Booking confirmed - TripVerse",
      heading: "Booking confirmed",
      body: "Great news — your booking has been confirmed. We look forward to hosting you!",
    },
    [BookingStatus.CANCELLED]: {
      subject: "Booking cancelled - TripVerse",
      heading: "Booking cancelled",
      body: "Your booking has been cancelled. If this wasn't expected, please contact support.",
    },
    [BookingStatus.COMPLETED]: {
      subject: "Trip completed - TripVerse",
      heading: "Trip completed",
      body: "Your trip has been marked as completed. Thank you for travelling with TripVerse!",
    },
  };

  const copy = statusCopy[details.status];

  const content = `
    <h2 style="margin-top: 0; font-size: 18px;">${copy.heading}</h2>
    <p style="font-size: 14px; line-height: 1.6; color: #374151;">
      Hi ${escapeHtml(details.name)},<br/>
      ${copy.body}
    </p>
    <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
      <tr>
        <td style="padding: 8px 0; color: #6b7280; width: 120px;">Package</td>
        <td style="padding: 8px 0;"><strong>${escapeHtml(details.packageTitle)}</strong></td>
      </tr>
      <tr>
        <td style="padding: 8px 0; color: #6b7280;">Travel date</td>
        <td style="padding: 8px 0;">${escapeHtml(travelDate)}</td>
      </tr>
      <tr>
        <td style="padding: 8px 0; color: #6b7280;">Travelers</td>
        <td style="padding: 8px 0;">${escapeHtml(String(details.travelers))}</td>
      </tr>
      <tr>
        <td style="padding: 8px 0; color: #6b7280;">Total</td>
        <td style="padding: 8px 0;"><strong>$${escapeHtml(details.totalPrice.toFixed(2))}</strong></td>
      </tr>
    </table>
  `;

  await client.emails.send({
    from,
    to: [details.email],
    subject: copy.subject,
    html: emailLayout(content),
  });
};