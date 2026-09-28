import { describe, expect, it, vi } from "vitest";
import {
  createHousehold,
  getHouseholdForUser,
  getPendingInvitesForEmail,
  inviteHouseholdMember,
  acceptHouseholdInvite,
  removeHouseholdMember,
} from "../src/modules/household/household.service.js";

function makeEmailSender() {
  const send = vi.fn().mockResolvedValue(undefined);
  return { send, sender: { send } };
}

describe("getPendingInvitesForEmail", () => {
  it("normalizes the email and only returns INVITED-status rows", async () => {
    const findMany = vi.fn().mockResolvedValue([{ id: "m1", household: { id: "h1", name: "The Smiths" } }]);
    const prisma = { householdMember: { findMany } } as any;

    const invites = await getPendingInvitesForEmail(prisma, "  Someone@Example.com ");

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { email: "someone@example.com", status: "INVITED" } }),
    );
    expect(invites).toHaveLength(1);
  });
});

describe("createHousehold", () => {
  it("creates a household with the caller as owner", async () => {
    const create = vi.fn().mockResolvedValue({ id: "h1", name: "My House", ownerUserId: "user-1", members: [] });
    const prisma = {
      household: { findFirst: vi.fn().mockResolvedValue(null), create },
    } as any;

    await createHousehold(prisma, "user-1", "My House");

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ data: { name: "My House", ownerUserId: "user-1" } }),
    );
  });

  it("rejects creating a second household for a user who already has one", async () => {
    const prisma = {
      household: {
        findFirst: vi.fn().mockResolvedValue({ id: "existing", ownerUserId: "user-1" }),
      },
    } as any;

    await expect(createHousehold(prisma, "user-1", "Another House")).rejects.toThrow(
      "HOUSEHOLD_ALREADY_EXISTS",
    );
  });
});

describe("getHouseholdForUser", () => {
  it("finds a household where the user is owner OR an active member", async () => {
    const findFirst = vi.fn().mockResolvedValue({ id: "h1" });
    const prisma = { household: { findFirst } } as any;

    await getHouseholdForUser(prisma, "user-2");

    const whereClause = findFirst.mock.calls[0]![0].where;
    expect(whereClause.OR).toEqual([
      { ownerUserId: "user-2" },
      { members: { some: { userId: "user-2", status: "ACTIVE" } } },
    ]);
  });
});

describe("inviteHouseholdMember", () => {
  it("rejects an invite from someone who isn't the household owner", async () => {
    const { sender } = makeEmailSender();
    const prisma = {
      household: { findUnique: vi.fn().mockResolvedValue({ id: "h1", ownerUserId: "owner-1" }) },
    } as any;

    await expect(
      inviteHouseholdMember(prisma, sender, "not-the-owner", "h1", "friend@example.com"),
    ).rejects.toThrow("HOUSEHOLD_NOT_FOUND_OR_NOT_OWNER");
  });

  it("links an existing user's account if their email is already registered", async () => {
    const { sender } = makeEmailSender();
    const upsert = vi.fn().mockResolvedValue({ id: "m1" });
    const prisma = {
      household: { findUnique: vi.fn().mockResolvedValue({ id: "h1", ownerUserId: "owner-1", name: "The Smiths" }) },
      userIdentifier: {
        findUnique: vi.fn().mockResolvedValue({ userId: "existing-user-42" }),
      },
      householdMember: { upsert },
    } as any;

    await inviteHouseholdMember(prisma, sender, "owner-1", "h1", "  Friend@Example.com  ");

    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { householdId_email: { householdId: "h1", email: "friend@example.com" } },
        create: expect.objectContaining({ userId: "existing-user-42", status: "INVITED" }),
      }),
    );
  });

  it("invites by email with no linked user yet when the address isn't registered", async () => {
    const { send, sender } = makeEmailSender();
    const upsert = vi.fn().mockResolvedValue({ id: "m1" });
    const prisma = {
      household: { findUnique: vi.fn().mockResolvedValue({ id: "h1", ownerUserId: "owner-1", name: "The Smiths" }) },
      userIdentifier: { findUnique: vi.fn().mockResolvedValue(null) },
      householdMember: { upsert },
    } as any;

    await inviteHouseholdMember(prisma, sender, "owner-1", "h1", "newperson@example.com");

    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({ create: expect.objectContaining({ userId: null }) }),
    );
    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0]![0].text).toContain("Create a BargaiNest account");
  });
});

describe("acceptHouseholdInvite", () => {
  it("rejects accepting when there's no matching invite for that email", async () => {
    const prisma = {
      householdMember: { findUnique: vi.fn().mockResolvedValue(null) },
    } as any;

    await expect(
      acceptHouseholdInvite(prisma, "user-2", "user2@example.com", "h1"),
    ).rejects.toThrow("INVITE_NOT_FOUND");
  });

  it("rejects accepting an invite that's already been accepted or removed", async () => {
    const prisma = {
      householdMember: {
        findUnique: vi.fn().mockResolvedValue({ id: "m1", status: "ACTIVE" }),
      },
    } as any;

    await expect(
      acceptHouseholdInvite(prisma, "user-2", "user2@example.com", "h1"),
    ).rejects.toThrow("INVITE_NOT_FOUND");
  });

  it("links the user and marks the membership ACTIVE for a valid pending invite", async () => {
    const update = vi.fn().mockResolvedValue({ id: "m1", status: "ACTIVE" });
    const prisma = {
      householdMember: {
        findUnique: vi.fn().mockResolvedValue({ id: "m1", status: "INVITED" }),
        update,
      },
    } as any;

    await acceptHouseholdInvite(prisma, "user-2", "user2@example.com", "h1");

    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "m1" },
        data: expect.objectContaining({ userId: "user-2", status: "ACTIVE" }),
      }),
    );
  });
});

describe("removeHouseholdMember", () => {
  it("rejects removal attempted by a non-owner", async () => {
    const prisma = {
      household: { findUnique: vi.fn().mockResolvedValue({ id: "h1", ownerUserId: "owner-1" }) },
    } as any;

    await expect(
      removeHouseholdMember(prisma, "not-the-owner", "h1", "m1"),
    ).rejects.toThrow("HOUSEHOLD_NOT_FOUND_OR_NOT_OWNER");
  });

  it("soft-removes the member (status REMOVED, not a hard delete)", async () => {
    const update = vi.fn().mockResolvedValue({});
    const prisma = {
      household: { findUnique: vi.fn().mockResolvedValue({ id: "h1", ownerUserId: "owner-1" }) },
      householdMember: { update },
    } as any;

    await removeHouseholdMember(prisma, "owner-1", "h1", "m1");

    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "m1" },
        data: expect.objectContaining({ status: "REMOVED" }),
      }),
    );
  });
});
