import { describe, expect, it, vi } from "vitest";
import { createEmailSender, SmtpEmailSender, ConsoleEmailSender } from "../src/integrations/email/email-sender.js";

function makeFakeTransporterFactory() {
  const sendMail = vi.fn().mockResolvedValue({ messageId: "fake-id" });
  const factory = vi.fn().mockReturnValue({ sendMail });
  return { factory, sendMail };
}

describe("createEmailSender", () => {
  it("falls back to ConsoleEmailSender when SMTP_HOST is not configured", () => {
    const { factory } = makeFakeTransporterFactory();
    const sender = createEmailSender({}, factory);

    expect(sender).toBeInstanceOf(ConsoleEmailSender);
    expect(factory).not.toHaveBeenCalled(); // no transporter should even be constructed
  });

  it("creates a real SmtpEmailSender when SMTP_HOST is configured", () => {
    const { factory } = makeFakeTransporterFactory();
    const sender = createEmailSender({ SMTP_HOST: "smtp.example.com" }, factory);

    expect(sender).toBeInstanceOf(SmtpEmailSender);
    expect(factory).toHaveBeenCalledWith(
      expect.objectContaining({ host: "smtp.example.com", port: 587, secure: false }),
    );
  });

  it("passes through custom port and secure settings", () => {
    const { factory } = makeFakeTransporterFactory();
    createEmailSender(
      { SMTP_HOST: "smtp.example.com", SMTP_PORT: 465, SMTP_SECURE: true },
      factory,
    );

    expect(factory).toHaveBeenCalledWith(
      expect.objectContaining({ port: 465, secure: true }),
    );
  });

  it("includes auth only when both user and password are provided", () => {
    const { factory } = makeFakeTransporterFactory();

    createEmailSender({ SMTP_HOST: "smtp.example.com" }, factory);
    expect(factory.mock.calls[0]![0].auth).toBeUndefined();

    factory.mockClear();
    createEmailSender(
      { SMTP_HOST: "smtp.example.com", SMTP_USER: "user", SMTP_PASSWORD: "pass" },
      factory,
    );
    expect(factory.mock.calls[0]![0].auth).toEqual({ user: "user", pass: "pass" });
  });

  it("uses a sensible default from-address when none is configured", () => {
    const { factory, sendMail } = makeFakeTransporterFactory();
    const sender = createEmailSender({ SMTP_HOST: "smtp.example.com" }, factory);

    return sender.send({ to: "user@example.com", subject: "Test", text: "Hi" }).then(() => {
      expect(sendMail).toHaveBeenCalledWith(
        expect.objectContaining({ from: "bargainest@anthillsolutions.co.za" }),
      );
    });
  });

  it("uses the configured from-address when provided", async () => {
    const { factory, sendMail } = makeFakeTransporterFactory();
    const sender = createEmailSender(
      { SMTP_HOST: "smtp.example.com", SMTP_FROM_ADDRESS: "hello@bargainest.co.za" },
      factory,
    );

    await sender.send({ to: "user@example.com", subject: "Test", text: "Hi" });
    expect(sendMail).toHaveBeenCalledWith(
      expect.objectContaining({ from: "hello@bargainest.co.za" }),
    );
  });
});

describe("SmtpEmailSender", () => {
  it("sends with the correct fields mapped to the transporter", async () => {
    const sendMail = vi.fn().mockResolvedValue({});
    const sender = new SmtpEmailSender({ sendMail }, "from@example.com");

    await sender.send({ to: "to@example.com", subject: "Subject", text: "Body text" });

    expect(sendMail).toHaveBeenCalledWith({
      from: "from@example.com",
      to: "to@example.com",
      subject: "Subject",
      text: "Body text",
    });
  });

  it("includes html when provided, omits it when not", async () => {
    const sendMail = vi.fn().mockResolvedValue({});
    const sender = new SmtpEmailSender({ sendMail }, "from@example.com");

    await sender.send({ to: "to@example.com", subject: "S", text: "T", html: "<p>T</p>" });
    expect(sendMail.mock.calls[0]![0].html).toBe("<p>T</p>");

    sendMail.mockClear();
    await sender.send({ to: "to@example.com", subject: "S", text: "T" });
    expect("html" in sendMail.mock.calls[0]![0]).toBe(false);
  });

  it("propagates a send failure rather than silently swallowing it", async () => {
    const sendMail = vi.fn().mockRejectedValue(new Error("SMTP connection refused"));
    const sender = new SmtpEmailSender({ sendMail }, "from@example.com");

    await expect(
      sender.send({ to: "to@example.com", subject: "S", text: "T" }),
    ).rejects.toThrow("SMTP connection refused");
  });

  it("logs the failure via the provided logger before re-throwing", async () => {
    const sendMail = vi.fn().mockRejectedValue(new Error("boom"));
    const info = vi.fn();
    const sender = new SmtpEmailSender({ sendMail }, "from@example.com", { info });

    await expect(sender.send({ to: "to@example.com", subject: "S", text: "T" })).rejects.toThrow();
    expect(info).toHaveBeenCalledTimes(1);
  });
});
