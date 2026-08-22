import { Resend } from "resend";
import config from "../config";
import { transporter } from "../lib/nodemailer";
import { renderTemplate } from "../templates";

// Best-effort senders for the auth flows (Step 21) — mirrors the reference
// backend's transporter.sendMail calls with EJS templates rendered from
// `src/templates/*.ejs`. Every failure (missing template, SMTP error) is
// caught and logged as a warn, never thrown, so it can't fail the business
// write that triggered it. Call sites fire these as
// `runInBackground([sendX(...)])` so the runtime stays alive until the send
// settles (see utils/background.ts).
//
// Delivery path is environment-aware: Vercel serverless blocks outbound SMTP
// ports (465/587), so production sends go straight to the Resend HTTP API;
// local/dev tries Gmail SMTP first and only falls back to Resend.

const OTP_EXPIRATION_MINUTES = 5;

interface IAuthEmailDetails {
  email: string;
  name: string;
}

let resend: Resend | null = null;

function getResend(): Resend | null {
  if (resend) return resend;
  if (!config.resend_api_key) return null;
  resend = new Resend(config.resend_api_key);
  return resend;
}

async function sendAuthMail(
  to: string,
  subject: string,
  build: () => Promise<string>,
): Promise<void> {
  let html: string;
  try {
    html = await build();
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    console.warn(`[email] failed to render "${subject}" template: ${detail}`);
    return;
  }

  // SMTP is only attempted where outbound SMTP is actually reachable —
  // Vercel serverless blackholes ports 465/587, so production skips it.
  if (transporter && !config.is_production) {
    try {
      await transporter.sendMail({
        from: config.smtp_user as string,
        to,
        subject,
        html,
      });
      return;
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      console.warn(`[email] SMTP failed for "${subject}" to ${to}: ${detail}`);
    }
  }

  const client = getResend();
  if (!client) {
    console.warn(
      `[email] no delivery path for "${subject}" to ${to}: ${
        config.is_production ? "Resend" : "SMTP/Resend"
      } not configured.`,
    );
    return;
  }

  try {
    const result = await client.emails.send({
      from: config.email_from || "TripVerse <onboarding@resend.dev>",
      to,
      subject,
      html,
    });
    // The Resend SDK resolves API errors as { error } instead of throwing.
    if (result.error) {
      console.warn(
        `[email] Resend rejected "${subject}" to ${to}: ${result.error.message}`,
      );
    }
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    console.warn(`[email] Resend failed for "${subject}" to ${to}: ${detail}`);
  }
}

// Sent right after a credential registration stages an OTP in Redis.
export const sendVerificationOtpEmail = async (
  details: IAuthEmailDetails & { otp: string },
): Promise<void> => {
  await sendAuthMail(details.email, "Email Verification OTP", () =>
    renderTemplate("registration-user-otp", {
      name: details.name,
      email: details.email,
      otp: details.otp,
      expirationMinutes: OTP_EXPIRATION_MINUTES,
    }),
  );
};

// Sent by the forgot-password flow with the reset OTP.
export const sendForgotPasswordOtpEmail = async (
  details: IAuthEmailDetails & { otp: string },
): Promise<void> => {
  await sendAuthMail(details.email, "Forgot Password Reset OTP", () =>
    renderTemplate("forgot-password", {
      name: details.name,
      otp: details.otp,
      expirationMinutes: OTP_EXPIRATION_MINUTES,
    }),
  );
};

// Sent after a successful email verification. The CTA links to the frontend
// (prod URL in production, dev URL otherwise); hidden when no URL is set.
export const sendWelcomeEmail = async (
  details: IAuthEmailDetails,
): Promise<void> => {
  await sendAuthMail(details.email, "Welcome to TripVerse", () =>
    renderTemplate("welcome-email", {
      name: details.name,
      frontendUrl: config.is_production
        ? config.frontend_url_prod
        : config.frontend_url_dev,
    }),
  );
};

// Sent after a successful password reset.
export const sendPasswordResetSuccessEmail = async (
  details: IAuthEmailDetails,
): Promise<void> => {
  await sendAuthMail(details.email, "Password Reset", () =>
    renderTemplate("reset-password-success", {
      name: details.name,
    }),
  );
};