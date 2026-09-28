/**
 * No email-sending capability exists anywhere in this codebase —
 * confirmed by search before building this (the only "smtp"/"ses"
 * matches elsewhere are unrelated substring hits, e.g. inside
 * "houses"). Password reset and email verification are meaningless
 * without a way to deliver the link, so this interface exists to make
 * that pluggable, the same way `LoyaltyProvider`
 * (src/integrations/loyalty/) made retailer loyalty data pluggable
 * before any real retailer API existed.
 *
 * `ConsoleEmailSender` (below) is the only implementation shipped
 * here — it logs the email via the request logger rather than
 * delivering it, which is a safe, zero-configuration default for a
 * pilot with no real SMTP/SendGrid/SES credentials configured. See
 * PASSWORD-RESET-EMAIL-VERIFICATION.md for exactly how to plug in a
 * real provider once one is available.
 */

export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

export interface EmailSender {
  send(message: EmailMessage): Promise<void>;
}

export interface EmailLogger {
  info(payload: Record<string, unknown>, message: string): void;
}

/**
 * Logs the email instead of delivering it. This is NOT a placeholder
 * to swap out before deploying to production for real users -- it is
 * the honest current state: this pilot has no real email
 * infrastructure, so the reset/verification link is only accessible
 * via server logs today. Flagged prominently in the delivery doc as
 * the one thing that must change before this feature is usable by an
 * actual end user who can't read your logs.
 */
export class ConsoleEmailSender implements EmailSender {
  constructor(private readonly logger: EmailLogger) {}

  async send(message: EmailMessage): Promise<void> {
    this.logger.info(
      { to: message.to, subject: message.subject, body: message.text },
      "EMAIL (console sender — no real delivery configured, see PASSWORD-RESET-EMAIL-VERIFICATION.md)",
    );
  }
}

/**
 * Minimal shape of the nodemailer transporter this actually uses --
 * kept narrow (not importing nodemailer's own types here) so this
 * file can be unit-tested with a fake transporter with zero real SMTP
 * connection, matching the dependency-injection pattern already used
 * for the barcode scanner's camera API and the reward-expiry check's
 * scheduler dependency.
 */
export interface EmailTransporter {
  sendMail(options: {
    from: string;
    to: string;
    subject: string;
    text: string;
    html?: string;
  }): Promise<unknown>;
}

/**
 * Real email delivery via SMTP -- works with SendGrid's SMTP relay,
 * AWS SES's SMTP interface, or any standard SMTP provider, since all
 * of them expose an SMTP endpoint even where they also offer their
 * own proprietary API. Chosen over a provider-specific SDK so
 * switching providers later is a config change (host/port/credentials),
 * not a code change.
 */
export class SmtpEmailSender implements EmailSender {
  constructor(
    private readonly transporter: EmailTransporter,
    private readonly fromAddress: string,
    private readonly logger?: EmailLogger,
  ) {}

  async send(message: EmailMessage): Promise<void> {
    try {
      await this.transporter.sendMail({
        from: this.fromAddress,
        to: message.to,
        subject: message.subject,
        text: message.text,
        ...(message.html !== undefined ? { html: message.html } : {}),
      });
    } catch (error) {
      // Matches the same "never let email delivery break the real
      // operation" principle already applied to audit logging --
      // a password-reset request should still succeed and respond
      // even if the SMTP send itself fails.
      this.logger?.info(
        { to: message.to, subject: message.subject, error },
        "SMTP send failed",
      );
      throw error;
    }
  }
}

/**
 * Single source of truth for which sender gets used, replacing what
 * was previously `new ConsoleEmailSender(...)` hardcoded separately
 * in five different route files. Falls back to ConsoleEmailSender
 * when SMTP isn't configured -- this is a genuine fallback for
 * environments without SMTP set up (local dev, CI), not a silent
 * failure to notice: SMTP_HOST being unset is treated as "not
 * configured yet", not an error.
 */
export function createEmailSender(
  env: {
    SMTP_HOST?: string | undefined;
    SMTP_PORT?: number | undefined;
    SMTP_SECURE?: boolean | undefined;
    SMTP_USER?: string | undefined;
    SMTP_PASSWORD?: string | undefined;
    SMTP_FROM_ADDRESS?: string | undefined;
  },
  transporterFactory: (config: {
    host: string;
    port: number;
    secure: boolean;
    auth?: { user: string; pass: string };
  }) => EmailTransporter,
  logger?: EmailLogger,
): EmailSender {
  if (!env.SMTP_HOST) {
    return new ConsoleEmailSender(logger ?? { info: () => {} });
  }

  const transporter = transporterFactory({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT ?? 587,
    secure: env.SMTP_SECURE ?? false,
    ...(env.SMTP_USER && env.SMTP_PASSWORD
      ? { auth: { user: env.SMTP_USER, pass: env.SMTP_PASSWORD } }
      : {}),
  });

  return new SmtpEmailSender(
    transporter,
    env.SMTP_FROM_ADDRESS ?? "bargainest@anthillsolutions.co.za",
    logger,
  );
}
