import { describe, expect, it } from "vitest";
import { nodemailerTransporterFactory } from "../src/integrations/email/nodemailer-transporter.js";

/**
 * Constructing a nodemailer transporter is synchronous and doesn't
 * open a network connection by itself (that only happens on
 * sendMail()/verify()) -- so this can confirm the real integration
 * wires together and exposes the expected shape, without needing a
 * real SMTP server, which doesn't exist in this sandbox. An actual
 * end-to-end send against a real SMTP provider still needs to be
 * confirmed in a real environment -- see BN-045's delivery doc.
 */
describe("nodemailerTransporterFactory", () => {
  it("constructs a real transporter exposing sendMail, without throwing or connecting", () => {
    const transporter = nodemailerTransporterFactory({
      host: "smtp.example.com",
      port: 587,
      secure: false,
    });

    expect(transporter).toBeDefined();
    expect(typeof transporter.sendMail).toBe("function");
  });

  it("accepts auth credentials without throwing", () => {
    const transporter = nodemailerTransporterFactory({
      host: "smtp.example.com",
      port: 465,
      secure: true,
      auth: { user: "someone", pass: "secret" },
    });

    expect(transporter).toBeDefined();
  });
});
