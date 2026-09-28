import nodemailer from "nodemailer";
import type { EmailTransporter } from "./email-sender.js";

/**
 * The one place nodemailer itself is actually imported and
 * constructed -- everything else in this module depends only on the
 * narrow `EmailTransporter` interface, so createEmailSender() can be
 * unit-tested with a fake transporter without ever touching this
 * file or a real SMTP connection.
 */
export function nodemailerTransporterFactory(config: {
  host: string;
  port: number;
  secure: boolean;
  auth?: { user: string; pass: string };
}): EmailTransporter {
  return nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    ...(config.auth ? { auth: config.auth } : {}),
  });
}
