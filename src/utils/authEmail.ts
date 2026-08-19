import config from "../config";
import { transporter } from "../lib/nodemailer";
import { emailLayout, escapeHtml } from "./email";

// Best-effort Nodemailer senders for the auth flows (Step 21) — mirrors the
// reference backend's transporter.sendMail calls, but reuses TripVerse's shared
// HTML layout and its best-effort convention: a missing SMTP config or a send
// failure is logged and swallowed, never thrown, so it can't fail the business
// write that triggered it. Call sites fire these as
// `void Promise.allSettled([sendX(...)])`.

const OTP_EXPIRATION_MINUTES = 5;

interface IAuthEmailDetails {
  email: string;
  name: string;
}

async function sendAuthMail(
  to: string,
  subject: string,
  content: string,
): Promise<void> {
  if (!transporter) {
    console.warn("[email] SMTP not configured; skipping auth email.");
    return;
  }

  try {
    await transporter.sendMail({
      from: config.smtp_user as string,
      to,
      subject,
      html: emailLayout(content),
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    console.warn(`[email] send failed (${subject}) to ${to}: ${detail}`);
  }
}

// Sent right after a credential registration stages an OTP in Redis.
export const sendVerificationOtpEmail = async (
  details: IAuthEmailDetails & { otp: string },
): Promise<void> => {
  const content = `
    <h2 style="margin-top: 0; font-size: 18px;">Verify your email</h2>
    <p style="font-size: 14px; line-height: 1.6; color: #374151;">
      Hi ${escapeHtml(details.name)},<br/>
      Use the code below to verify your TripVerse account. It expires in
      ${OTP_EXPIRATION_MINUTES} minutes.
    </p>
    <div style="margin: 16px 0; padding: 16px; background: #f9fafb; border-radius: 6px; text-align: center; font-size: 28px; font-weight: bold; letter-spacing: 8px; color: #0f766e;">
      ${escapeHtml(details.otp)}
    </div>
  `;

  await sendAuthMail(details.email, "Email Verification OTP", content);
};

// Sent by the forgot-password flow with the reset OTP.
export const sendForgotPasswordOtpEmail = async (
  details: IAuthEmailDetails & { otp: string },
): Promise<void> => {
  const content = `
    <h2 style="margin-top: 0; font-size: 18px;">Reset your password</h2>
    <p style="font-size: 14px; line-height: 1.6; color: #374151;">
      Hi ${escapeHtml(details.name)},<br/>
      Use the code below to set a new password. It expires in
      ${OTP_EXPIRATION_MINUTES} minutes.
    </p>
    <div style="margin: 16px 0; padding: 16px; background: #f9fafb; border-radius: 6px; text-align: center; font-size: 28px; font-weight: bold; letter-spacing: 8px; color: #0f766e;">
      ${escapeHtml(details.otp)}
    </div>
    <p style="font-size: 13px; line-height: 1.6; color: #6b7280;">
      If you didn't request a password reset, you can safely ignore this email.
    </p>
  `;

  await sendAuthMail(details.email, "Forgot Password Reset OTP", content);
};

// Sent after a successful email verification.
export const sendWelcomeEmail = async (
  details: IAuthEmailDetails,
): Promise<void> => {
  const content = `
    <h2 style="margin-top: 0; font-size: 18px;">Welcome to TripVerse!</h2>
    <p style="font-size: 14px; line-height: 1.6; color: #374151;">
      Hi ${escapeHtml(details.name)},<br/>
      Your email has been verified and your account is ready. Start exploring
      tour packages and planning your next adventure.
    </p>
  `;

  await sendAuthMail(details.email, "Welcome to TripVerse", content);
};

// Sent after a successful password reset.
export const sendPasswordResetSuccessEmail = async (
  details: IAuthEmailDetails,
): Promise<void> => {
  const content = `
    <h2 style="margin-top: 0; font-size: 18px;">Password reset</h2>
    <p style="font-size: 14px; line-height: 1.6; color: #374151;">
      Hi ${escapeHtml(details.name)},<br/>
      Your password has been reset successfully. If you didn't do this, please
      contact support immediately.
    </p>
  `;

  await sendAuthMail(details.email, "Password Reset", content);
};
