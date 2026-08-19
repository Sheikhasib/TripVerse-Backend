import config from "../config";
import { transporter } from "../lib/nodemailer";
import { renderTemplate } from "../templates";

// Best-effort Nodemailer senders for the auth flows (Step 21) — mirrors the
// reference backend's transporter.sendMail calls with EJS templates rendered
// from `src/app/templates/*.ejs`. Missing SMTP config or a send failure is
// logged and swallowed, never thrown, so it can't fail the business write that
// triggered it. Call sites fire these as `void Promise.allSettled([sendX(...)])`.

const OTP_EXPIRATION_MINUTES = 5;

interface IAuthEmailDetails {
  email: string;
  name: string;
}

async function sendAuthMail(
  to: string,
  subject: string,
  html: string,
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
      html,
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
  const html = await renderTemplate("registration-user-otp", {
    name: details.name,
    email: details.email,
    otp: details.otp,
    expirationMinutes: OTP_EXPIRATION_MINUTES,
  });

  await sendAuthMail(details.email, "Email Verification OTP", html);
};

// Sent by the forgot-password flow with the reset OTP.
export const sendForgotPasswordOtpEmail = async (
  details: IAuthEmailDetails & { otp: string },
): Promise<void> => {
  const html = await renderTemplate("forgot-password", {
    name: details.name,
    otp: details.otp,
    expirationMinutes: OTP_EXPIRATION_MINUTES,
  });

  await sendAuthMail(details.email, "Forgot Password Reset OTP", html);
};

// Sent after a successful email verification.
export const sendWelcomeEmail = async (
  details: IAuthEmailDetails,
): Promise<void> => {
  const html = await renderTemplate("welcome-email", {
    name: details.name,
  });

  await sendAuthMail(details.email, "Welcome to TripVerse", html);
};

// Sent after a successful password reset.
export const sendPasswordResetSuccessEmail = async (
  details: IAuthEmailDetails,
): Promise<void> => {
  const html = await renderTemplate("reset-password-success", {
    name: details.name,
  });

  await sendAuthMail(details.email, "Password Reset", html);
};