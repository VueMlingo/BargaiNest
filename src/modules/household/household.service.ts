import type { PrismaClient } from "@prisma/client";
import type { EmailSender } from "../../integrations/email/email-sender.js";
import { env } from "../../config/env.js";

export async function getPendingInvitesForEmail(prisma: PrismaClient, email: string) {
  return prisma.householdMember.findMany({
    where: { email: email.trim().toLowerCase(), status: "INVITED" },
    include: { household: { select: { id: true, name: true } } },
  });
}

export async function getHouseholdForUser(prisma: PrismaClient, userId: string) {
  return prisma.household.findFirst({
    where: {
      OR: [
        { ownerUserId: userId },
        { members: { some: { userId, status: "ACTIVE" } } },
      ],
    },
    include: { members: { orderBy: { invitedAt: "asc" } } },
  });
}

export async function createHousehold(prisma: PrismaClient, userId: string, name: string) {
  const existing = await getHouseholdForUser(prisma, userId);
  if (existing) {
    throw new Error("HOUSEHOLD_ALREADY_EXISTS");
  }

  return prisma.household.create({
    data: { name, ownerUserId: userId },
    include: { members: true },
  });
}

export async function updateHouseholdName(
  prisma: PrismaClient,
  ownerUserId: string,
  householdId: string,
  name: string,
) {
  const household = await prisma.household.findUnique({
    where: { id: householdId },
  });

  if (!household || household.ownerUserId !== ownerUserId) {
    throw new Error("HOUSEHOLD_NOT_FOUND_OR_NOT_OWNER");
  }

  return prisma.household.update({
    where: { id: householdId },
    data: { name: name.trim() },
    include: {
      members: {
        orderBy: { invitedAt: "asc" },
      },
    },
  });
}

export async function deleteHousehold(
  prisma: PrismaClient,
  ownerUserId: string,
  householdId: string,
): Promise<void> {
  const household = await prisma.household.findUnique({
    where: { id: householdId },
  });

  if (!household || household.ownerUserId !== ownerUserId) {
    throw new Error("HOUSEHOLD_NOT_FOUND_OR_NOT_OWNER");
  }

  await prisma.household.delete({
    where: { id: householdId },
  });
}

/**
 * Invites by email regardless of whether that person has a
 * BargaiNest account yet -- `userId` on the created member row is
 * only linked once someone with a matching, verified email logs in
 * and accepts (see acceptHouseholdInvite). Only the household's owner
 * can invite; membership itself doesn't grant that right, matching
 * the FSD's framing of household management as an owner-managed
 * capability, not a fully peer-to-peer one.
 */
export async function inviteHouseholdMember(
  prisma: PrismaClient,
  emailSender: EmailSender,
  ownerUserId: string,
  householdId: string,
  email: string,
) {
  const household = await prisma.household.findUnique({ where: { id: householdId } });
  if (!household || household.ownerUserId !== ownerUserId) {
    throw new Error("HOUSEHOLD_NOT_FOUND_OR_NOT_OWNER");
  }

  const normalizedEmail = email.trim().toLowerCase();

  const existingUser = await prisma.userIdentifier.findUnique({
    where: { type_value: { type: "EMAIL", value: normalizedEmail } },
    select: { userId: true },
  });

  const member = await prisma.householdMember.upsert({
    where: { householdId_email: { householdId, email: normalizedEmail } },
    update: { status: "INVITED", userId: existingUser?.userId ?? null, removedAt: null },
    create: {
      householdId,
      email: normalizedEmail,
      userId: existingUser?.userId ?? null,
      status: "INVITED",
    },
  });

  try {
    await emailSender.send({
      to: normalizedEmail,
      subject: `You've been invited to join a BargaiNest household`,
      text:
        `You've been invited to join "${household.name}" on BargaiNest. ` +
        (existingUser
          ? `Log in to your account and accept the invite from your Household settings.`
          : `Create a BargaiNest account with this email address to accept: ${env.PUBLIC_APP_URL}`),
    });
  } catch (error) {
    // The invitation is already persisted. Notification email is
    // best-effort and must not turn a successful invitation into
    // an HTTP 500 or cause the owner to submit the invitation again.
    console.error("Household invitation email failed", {
      householdId,
      memberId: member.id,
      email: normalizedEmail,
      error,
    });
  }

  return member;
}

export async function acceptHouseholdInvite(
  prisma: PrismaClient,
  userId: string,
  userEmail: string,
  householdId: string,
) {
  const member = await prisma.householdMember.findUnique({
    where: { householdId_email: { householdId, email: userEmail.trim().toLowerCase() } },
  });

  if (!member || member.status !== "INVITED") {
    throw new Error("INVITE_NOT_FOUND");
  }

  return prisma.householdMember.update({
    where: { id: member.id },
    data: { userId, status: "ACTIVE", joinedAt: new Date() },
  });
}

export async function removeHouseholdMember(
  prisma: PrismaClient,
  ownerUserId: string,
  householdId: string,
  memberId: string,
) {
  const household = await prisma.household.findUnique({ where: { id: householdId } });
  if (!household || household.ownerUserId !== ownerUserId) {
    throw new Error("HOUSEHOLD_NOT_FOUND_OR_NOT_OWNER");
  }

  await prisma.householdMember.update({
    where: { id: memberId },
    data: { status: "REMOVED", removedAt: new Date() },
  });
}
