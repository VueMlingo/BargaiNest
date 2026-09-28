import { describe, expect, it, vi } from "vitest";
import { env } from "../src/config/env.js";
import {
  submitSupportRequest,
  listSupportRequestsForUser,
  listAllSupportRequests,
  resolveSupportRequest,
  replyToSupportRequest,
} from "../src/modules/auth/support.service.js";

function makeEmailSender() {
  const send = vi.fn().mockResolvedValue(undefined);
  return { send, sender: { send } };
}

describe("submitSupportRequest", () => {
  it("persists the request and emails the support inbox", async () => {
    const { send, sender } = makeEmailSender();
    const create = vi.fn().mockResolvedValue({
      id: "req-1",
      email: "user@example.com",
      subject: "Cant log in",
      message: "Help please",
    });
    const prisma = { supportRequest: { create } } as any;

    await submitSupportRequest(prisma, sender, {
      userId: "user-1",
      email: "User@Example.com",
      subject: "  Cant log in  ",
      message: "  Help please  ",
    });

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: "user-1",
          email: "user@example.com", // normalized
          subject: "Cant log in", // trimmed
          message: "Help please", // trimmed
        }),
      }),
    );

    // BN-022: two independent emails now go out -- the internal
    // support-team notification, and a confirmation back to whoever
    // submitted the request.
    expect(send).toHaveBeenCalledTimes(2);

    const toSupportTeam = send.mock.calls.find((call: any) => call[0].to === env.SUPPORT_INBOX_EMAIL);
    const toSubmitter = send.mock.calls.find((call: any) => call[0].to === "user@example.com");

    expect(toSupportTeam).toBeTruthy();
    expect(toSupportTeam![0].text).toContain("req-1");

    expect(toSubmitter).toBeTruthy();
    expect(toSubmitter![0].text).toContain("Help please");
    expect(toSubmitter![0].subject).toContain("Cant log in");
  });

  it("BN-022: includes a reference number in the submitter's confirmation email", async () => {
    const { send, sender } = makeEmailSender();
    const create = vi.fn().mockResolvedValue({
      id: "abcdef12-3456-7890-abcd-ef1234567890",
      email: "user@example.com",
      subject: "Billing question",
      message: "Why was I charged twice?",
    });
    const prisma = { supportRequest: { create } } as any;

    await submitSupportRequest(prisma, sender, {
      userId: null,
      email: "user@example.com",
      subject: "Billing question",
      message: "Why was I charged twice?",
    });

    const toSubmitter = send.mock.calls.find((call: any) => call[0].to === "user@example.com");
    // Reference number is derived from the id -- first 8 chars, uppercased.
    expect(toSubmitter![0].text).toContain("ABCDEF12");
  });

  it("BN-022: still emails the support team even if the submitter's confirmation email fails", async () => {
    const send = vi.fn()
      .mockResolvedValueOnce(undefined) // support-team email succeeds
      .mockRejectedValueOnce(new Error("SMTP down")); // confirmation email fails
    const sender = { send };
    const create = vi.fn().mockResolvedValue({
      id: "req-1",
      email: "user@example.com",
      subject: "Cant log in",
      message: "Help please",
    });
    const prisma = { supportRequest: { create } } as any;

    // Must not throw -- a failed confirmation email must not turn a
    // successful submission into an error.
    await expect(
      submitSupportRequest(prisma, sender, {
        userId: "user-1",
        email: "user@example.com",
        subject: "Cant log in",
        message: "Help please",
      }),
    ).resolves.toBeDefined();

    expect(send).toHaveBeenCalledTimes(2);
  });

  it("BN-022: still attempts the submitter's confirmation even if the support-team email fails", async () => {
    const send = vi.fn()
      .mockRejectedValueOnce(new Error("SMTP down")) // support-team email fails
      .mockResolvedValueOnce(undefined); // confirmation email succeeds
    const sender = { send };
    const create = vi.fn().mockResolvedValue({
      id: "req-1",
      email: "user@example.com",
      subject: "Cant log in",
      message: "Help please",
    });
    const prisma = { supportRequest: { create } } as any;

    await expect(
      submitSupportRequest(prisma, sender, {
        userId: "user-1",
        email: "user@example.com",
        subject: "Cant log in",
        message: "Help please",
      }),
    ).resolves.toBeDefined();

    expect(send).toHaveBeenCalledTimes(2);
  });

  it("works for a logged-out visitor (null userId)", async () => {
    const { sender } = makeEmailSender();
    const create = vi.fn().mockResolvedValue({
      id: "req-2",
      email: "visitor@example.com",
      subject: "s",
      message: "m",
    });
    const prisma = { supportRequest: { create } } as any;

    await submitSupportRequest(prisma, sender, {
      userId: null,
      email: "visitor@example.com",
      subject: "s",
      message: "m",
    });

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ userId: null }) }),
    );
  });
});

describe("listSupportRequestsForUser", () => {
  it("queries only the given user's requests, newest first", async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const prisma = { supportRequest: { findMany } } as any;

    await listSupportRequestsForUser(prisma, "user-1");

    expect(findMany).toHaveBeenCalledWith({
      where: { userId: "user-1" },
      orderBy: { createdAt: "desc" },
    });
  });
});

describe("listAllSupportRequests", () => {
  it("lists every request when no status filter is given", async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const prisma = { supportRequest: { findMany } } as any;

    await listAllSupportRequests(prisma);

    expect(findMany).toHaveBeenCalledWith({
      orderBy: { createdAt: "desc" },
    });
  });

  it("filters by status when one is given", async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const prisma = { supportRequest: { findMany } } as any;

    await listAllSupportRequests(prisma, "OPEN");

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { status: "OPEN" } }),
    );
  });
});

describe("resolveSupportRequest", () => {
  it("marks the request resolved with a resolvedAt timestamp", async () => {
    const update = vi.fn().mockResolvedValue({ id: "r1", status: "RESOLVED" });
    const prisma = { supportRequest: { update } } as any;

    await resolveSupportRequest(prisma, "r1");

    expect(update).toHaveBeenCalledWith({
      where: { id: "r1" },
      data: { status: "RESOLVED", resolvedAt: expect.any(Date) },
    });
  });
});

describe("replyToSupportRequest", () => {
  it("rejects when the support request doesn't exist", async () => {
    const { sender } = makeEmailSender();
    const prisma = { supportRequest: { findUnique: vi.fn().mockResolvedValue(null) } } as any;

    await expect(replyToSupportRequest(prisma, sender, "r1", "reply text")).rejects.toThrow(
      "SUPPORT_REQUEST_NOT_FOUND",
    );
  });

  it("emails the original requester and marks the request resolved", async () => {
    const { send, sender } = makeEmailSender();
    const update = vi.fn().mockResolvedValue({ id: "r1", status: "RESOLVED" });
    const prisma = {
      supportRequest: {
        findUnique: vi.fn().mockResolvedValue({ id: "r1", email: "user@example.com", subject: "Cant log in" }),
        update,
      },
    } as any;

    await replyToSupportRequest(prisma, sender, "r1", "Try resetting your password.");

    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "user@example.com",
        subject: "Re: Cant log in",
        text: "Try resetting your password.",
      }),
    );
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "r1" }, data: expect.objectContaining({ status: "RESOLVED" }) }),
    );
  });
});
