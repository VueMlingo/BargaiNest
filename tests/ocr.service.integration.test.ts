import { describe, expect, it, afterAll } from "vitest";
import { createCanvas } from "canvas";
import { TesseractOcrService } from "../src/integrations/ocr/ocr.service.js";
import path from "node:path";

/**
 * A genuine end-to-end test, not a mock: generates a real image
 * containing known text, runs it through the real Tesseract engine
 * (the same WASM core and trained language data the production
 * service uses), and asserts the recognized text is actually correct.
 * This is the test that would catch "the OCR pipeline doesn't
 * actually work" -- a test against a fake OCR service could never
 * catch that.
 *
 * Slow (~15-30s) because a real OCR engine is initializing and
 * running, not because anything is wrong -- this is expected.
 */
describe("TesseractOcrService (real OCR engine)", () => {
  const langDataDir = path.join(process.cwd(), "ocr-lang-data");
  let service: TesseractOcrService;

  afterAll(async () => {
    if (service) await service.terminate();
  });

  it(
    "BN-023 CRASH-SAFETY FIX: a missing language data directory is a clean, catchable rejection -- NOT a process crash",
    { timeout: 30_000 },
    async () => {
      const brokenService = new TesseractOcrService("/tmp/definitely-does-not-exist-ocr-data");
      const canvas = createCanvas(100, 50);
      const buffer = canvas.toBuffer("image/png");

      await expect(brokenService.recognizeText(buffer)).rejects.toThrow(
        "OCR_LANGUAGE_DATA_MISSING",
      );

      await expect(brokenService.recognizeText(buffer)).rejects.toThrow(
        /fetch-ocr-language-data\.sh/,
      );
    },
  );

  it(
    "correctly reads clear text from a generated image",
    { timeout: 60_000 },
    async () => {
      const canvas = createCanvas(400, 100);
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = "white";
      ctx.fillRect(0, 0, 400, 100);
      ctx.fillStyle = "black";
      ctx.font = "30px sans-serif";
      ctx.fillText("MILK 2L R21.99", 20, 50);
      const buffer = canvas.toBuffer("image/png");

      service = new TesseractOcrService(langDataDir);
      const text = await service.recognizeText(buffer);

      expect(text.trim()).toBe("MILK 2L R21.99");
    },
  );

  it(
    "reuses the same worker across multiple calls rather than reinitializing (performance)",
    { timeout: 60_000 },
    async () => {
      const canvas1 = createCanvas(300, 80);
      const ctx1 = canvas1.getContext("2d");
      ctx1.fillStyle = "white";
      ctx1.fillRect(0, 0, 300, 80);
      ctx1.fillStyle = "black";
      ctx1.font = "24px sans-serif";
      ctx1.fillText("BREAD R15.99", 15, 40);

      const canvas2 = createCanvas(300, 80);
      const ctx2 = canvas2.getContext("2d");
      ctx2.fillStyle = "white";
      ctx2.fillRect(0, 0, 300, 80);
      ctx2.fillStyle = "black";
      ctx2.font = "24px sans-serif";
      ctx2.fillText("SUGAR R34.99", 15, 40);

      const localService = new TesseractOcrService(langDataDir);

      const text1 = await localService.recognizeText(canvas1.toBuffer("image/png"));
      const text2 = await localService.recognizeText(canvas2.toBuffer("image/png"));

      expect(text1.trim()).toBe("BREAD R15.99");
      expect(text2.trim()).toBe("SUGAR R34.99");

      await localService.terminate();
    },
  );
});
