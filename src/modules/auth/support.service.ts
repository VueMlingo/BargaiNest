import type { PrismaClient } from "@prisma/client";
import type { EmailSender } from "../../integrations/email/email-sender.js";
import { env } from "../../config/env.js";

export interface SubmitSupportRequestInput {
  userId?: string | null;
  email: string;
  subject: string;
  message: string;
}

/**
 * There's no support ticketing system to route this into -- it's
 * persisted (so nothing is lost, and it's queryable later) and
 * emailed via the same EmailSender used for password reset/email
 * verification, to a fixed internal address. Today that means it
 * lands in server logs like every other email in this pilot (see
 * ConsoleEmailSender) -- the same honest gap already flagged for
 * BN-017/018, not a new one.
 *
 * BN-022: previously only the support team was notified -- the
 * submitter never received anything, despite the frontend's own
 * confirmation text ("We'll get back to you by email") promising
 * otherwise. Now sends a second, separate email to the submitter
 * confirming receipt, with a short reference number and a copy of
 * what they submitted, so they have something concrete to refer back
 * to (and to quote if they contact support again about the same
 * issue). Each of the two emails fails independently and best-effort
 * -- a failure sending one must not prevent the other, and neither
 * should turn a successful submission into an HTTP 500.
 */
export async function submitSupportRequest(
  prisma: PrismaClient,
  emailSender: EmailSender,
  input: SubmitSupportRequestInput,
) {
  const supportRequest = await prisma.supportRequest.create({
    data: {
      userId: input.userId ?? null,
      email: input.email.trim().toLowerCase(),
      subject: input.subject.trim(),
      message: input.message.trim(),
    },
  });

  const referenceNumber = supportRequest.id.slice(0, 8).toUpperCase();

  try {
    await emailSender.send({
      to: env.SUPPORT_INBOX_EMAIL,
      subject: `[Support] ${supportRequest.subject}`,
      text:
        `New support request (#${supportRequest.id}) from ${supportRequest.email}:\n\n` +
        `${supportRequest.message}\n\n` +
        (input.userId ? `Logged-in user ID: ${input.userId}\n` : "Submitted while logged out.\n"),
    });
  } catch (error) {
    // The support request is already persisted. Notification email is
    // best-effort and must not turn a successful support submission into
    // an HTTP 500 or cause the user to submit the request again.
    console.error("Support request notification email failed", {
      requestId: supportRequest.id,
      error,
    });
  }

  try {
    await emailSender.send({
      to: supportRequest.email,
      subject: `We've received your request: ${supportRequest.subject}`,
      text:
        `Hi,\n\n` +
        `Thanks for contacting BargaiNest support. We've received your request ` +
        `and will get back to you by email as soon as we can.\n\n` +
        `Reference number: ${referenceNumber}\n` +
        `Subject: ${supportRequest.subject}\n\n` +
        `Your message:\n${supportRequest.message}\n\n` +
        `If you need to follow up, please mention reference ${referenceNumber}.`,
    });
  } catch (error) {
    // Same best-effort principle as above, independently -- a failure
    // sending the internal notification must not prevent the
    // submitter's confirmation from being attempted, and vice versa.
    console.error("Support request confirmation email failed", {
      requestId: supportRequest.id,
      error,
    });
  }

  return supportRequest;
}

export async function listSupportRequestsForUser(prisma: PrismaClient, userId: string) {
  return prisma.supportRequest.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });
}

/*
 * ---------------------------------------------------------------------------
 * Staff-facing functions (BN-047)
 * ---------------------------------------------------------------------------
 *
 * No admin-role/RBAC concept exists anywhere in this app yet -- it's a
 * consumer-only pilot. Rather than build a full role system for one
 * feature, these are gated the same way the reward-expiry check's
 * internal trigger already is: a shared secret header, not a
 * per-staff-member login. A real production admin surface would need
 * actual staff accounts and permissions; this is the honest,
 * proportionate interim step for a pilot.
 */

export async function listAllSupportRequests(
  prisma: PrismaClient,
  status?: "OPEN" | "RESOLVED",
) {
  return prisma.supportRequest.findMany({
    ...(status ? { where: { status } } : {}),
    orderBy: { createdAt: "desc" },
  });
}

export async function resolveSupportRequest(prisma: PrismaClient, requestId: string) {
  return prisma.supportRequest.update({
    where: { id: requestId },
    data: { status: "RESOLVED", resolvedAt: new Date() },
  });
}

export async function replyToSupportRequest(
  prisma: PrismaClient,
  emailSender: EmailSender,
  requestId: string,
  replyMessage: string,
) {
  const supportRequest = await prisma.supportRequest.findUnique({
    where: { id: requestId },
  });

  if (!supportRequest) {
    throw new Error("SUPPORT_REQUEST_NOT_FOUND");
  }

  await emailSender.send({
    to: supportRequest.email,
    subject: `Re: ${supportRequest.subject}`,
    text: replyMessage,
  });

  return resolveSupportRequest(prisma, requestId);
}
