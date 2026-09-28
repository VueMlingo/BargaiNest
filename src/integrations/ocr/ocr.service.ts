import { createWorker } from "tesseract.js";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { env } from "../../config/env.js";

/**
 * Confirmed working end-to-end in a sandboxed environment with no
 * external network access at OCR-runtime: tesseract.js-core bundles
 * its WASM engine as a normal npm dependency (no download needed),
 * and the trained language model is fetched once via
 * scripts/fetch-ocr-language-data.sh (see that script and
 * BN-042-OCR-EXTRACTION.md for why it isn't bundled directly).
 *
 * A minimal, real test proved this genuinely reads text correctly
 * (not just that the library loads): a generated image containing
 * "MILK 2L R21.99" was recognized as exactly that string.
 */
export interface OcrService {
  recognizeText(imageBuffer: Buffer): Promise<string>;
  terminate(): Promise<void>;
}

/**
 * Tesseract worker initialization takes real time (several seconds) —
 * creating one per request would make every receipt scan slow. This
 * lazily creates ONE worker on first use and reuses it across calls,
 * terminating it only when explicitly asked to (e.g. on app shutdown).
 */
export class TesseractOcrService implements OcrService {
  private workerPromise: ReturnType<typeof createWorker> | null = null;

  constructor(
    private readonly langDataDir: string = env.OCR_LANG_DATA_DIR,
    private readonly corePath?: string,
  ) {}

  private async getWorker() {
    if (!this.workerPromise) {
      const langDataFile = join(this.langDataDir, "eng.traineddata.gz");
      if (!existsSync(langDataFile)) {
        throw new Error(
          `OCR_LANGUAGE_DATA_MISSING: expected ${langDataFile} to exist. ` +
            "Run scripts/fetch-ocr-language-data.sh (or ensure it runs at " +
            "build time -- see the Dockerfile) before starting the server.",
        );
      }

      this.workerPromise = createWorker("eng", 1, {
        langPath: this.langDataDir,
        gzip: true,
        cachePath: this.langDataDir,
        ...(this.corePath ? { corePath: this.corePath } : {}),
      });
    }
    return this.workerPromise;
  }

  async recognizeText(imageBuffer: Buffer): Promise<string> {
    const worker = await this.getWorker();
    const {
      data: { text },
    } = await worker.recognize(imageBuffer);
    return text;
  }

  async terminate(): Promise<void> {
    if (this.workerPromise) {
      const worker = await this.workerPromise;
      await worker.terminate();
      this.workerPromise = null;
    }
  }
}
