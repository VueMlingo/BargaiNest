import { describe, expect, it, vi } from "vitest";
import { recordAuditLog, listAuditLogForUser } from "../src/modules/audit/audit.service.js";

describe("recordAuditLog", () => {
  it("persists all provided fields", async () => {
    const create = vi.fn().mockResolvedValue({ id: "log-1" });
    const prisma = { auditLog: { create } } as any;

    await recordAuditLog(prisma, {
      userId: "user-1",
      action: "LOGIN_SUCCESS",
      entityType: "User",
      entityId: "user-1",
      metadata: { foo: "bar" },
      ipAddress: "1.2.3.4",
      userAgent: "test-agent",
    });

    expect(create).toHaveBeenCalledWith({
      data: {
        userId: "user-1",
        action: "LOGIN_SUCCESS",
        entityType: "User",
        entityId: "user-1",
        metadata: { foo: "bar" },
        ipAddress: "1.2.3.4",
        userAgent: "test-agent",
      },
    });
  });

  it("defaults optional fields to null rather than leaving them undefined", async () => {
    const create = vi.fn().mockResolvedValue({ id: "log-1" });
    const prisma = { auditLog: { create } } as any;

    await recordAuditLog(prisma, {
      action: "LOGIN_FAILURE",
      entityType: "User",
    });

    expect(create).toHaveBeenCalledWith({
      data: {
        userId: null,
        action: "LOGIN_FAILURE",
        entityType: "User",
        entityId: null,
        metadata: undefined,
        ipAddress: null,
        userAgent: null,
      },
    });
  });

  it("never throws, even when the database insert fails -- the real operation being audited must not break", async () => {
    const create = vi.fn().mockRejectedValue(new Error("db down"));
    const prisma = { auditLog: { create } } as any;

    await expect(
      recordAuditLog(prisma, { action: "LOGIN_SUCCESS", entityType: "User" }),
    ).resolves.toBeUndefined();
  });

  it("logs the failure via the provided logger rather than swallowing it silently", async () => {
    const create = vi.fn().mockRejectedValue(new Error("db down"));
    const prisma = { auditLog: { create } } as any;
    const warn = vi.fn();

    await recordAuditLog(prisma, { action: "LOGIN_SUCCESS", entityType: "User" }, { warn });

    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0]![1]).toContain("failed to record audit log entry");
  });

  it("works fine with no logger provided at all (logger is optional)", async () => {
    const create = vi.fn().mockRejectedValue(new Error("db down"));
    const prisma = { auditLog: { create } } as any;

    await expect(
      recordAuditLog(prisma, { action: "LOGIN_SUCCESS", entityType: "User" }),
    ).resolves.toBeUndefined();
  });
});

describe("listAuditLogForUser", () => {
  it("scopes to the given user only, newest first", async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const prisma = { auditLog: { findMany } } as any;

    await listAuditLogForUser(prisma, "user-1");

    expect(findMany).toHaveBeenCalledWith({
      where: { userId: "user-1" },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
  });

  it("respects a custom limit when provided", async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const prisma = { auditLog: { findMany } } as any;

    await listAuditLogForUser(prisma, "user-1", 10);

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 10 }),
    );
  });
});
