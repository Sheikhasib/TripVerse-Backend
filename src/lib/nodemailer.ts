import nodemailer from "nodemailer";
import config from "../config";

// Nodemailer transporter for the auth emails (Step 21) — identical to the
// reference backend (Gmail app-password SMTP). Null when unconfigured so the
// app still boots; the auth email helpers then become best-effort no-ops.
export const transporter =
  config.smtp_user && config.smtp_password
    ? nodemailer.createTransport({
        service: "gmail",
        auth: {
          user: config.smtp_user,
          pass: config.smtp_password,
        },
      })
    : null;
