import type { FastifyInstance } from "fastify";
import { z } from "zod";

import { requireAuth } from "../auth/auth.middleware.js";
import { TesseractOcrService } from "../../integrations/ocr/ocr.service.js";
import {
  createWalletVoucher,
  listWalletVouchersForUser,
  getWalletVoucherForUser,
  redeemWalletVoucher,
} from "./wallet-voucher.service.js";
import { parseVoucherText } from "./voucher-ocr-parser.service.js";

function getAuthenticatedUserId(request: { currentUserId?: string }): string {
  if (!request.currentUserId) {
    throw new Error("AUTHENTICATED_USER_ID_MISSING");
  }
  return request.currentUserId;
}

const extractVoucherSchema = z.object({
  imageBase64: z.string().min(1),
});

const createWalletVoucherSchema = z.object({
  retailerName: z.string().trim().min(1).max(191),
  barcode: z.string().trim().min(1).max(191),
  barcodeFormat: z.string().trim().min(1).max(50).nullable().optional(),
  voucherNumber: z.string().trim().min(1).max(191).nullable().optional(),
  value: z.coerce.number().positive(),
  currency: z.string().trim().length(3).optional(),
  validFrom: z.coerce.date().nullable().optional(),
  expiresAt: z.coerce.date().nullable().optional(),
  sourcePurchaseId: z.string().uuid().nullable().optional(),
});

export async function registerWalletVoucherRoutes(api: FastifyInstance): Promise<void> {
  await api.register(
    async (scope) => {
      scope.addHook("preHandler", requireAuth);

      /*
       * REG-004: OCR + parse only -- deliberately does NOT persist
       * anything. Reuses the exact same TesseractOcrService already
       * built for receipt scanning (no parallel OCR implementation),
       * pointed at whatever text is printed on the voucher, then runs
       * it through the voucher-specific field parser. The caller
       * (frontend) shows these as pre-filled, editable form fields --
       * the user reviews and corrects before ever calling the real
       * POST /wallet-vouchers below to actually save.
       */
      scope.post<{ Querystring: { debug?: string } }>(
        "/wallet-vouchers/extract",
        { bodyLimit: 15 * 1024 * 1024 },
        async (request, reply) => {
          const parsed = extractVoucherSchema.safeParse(request.body ?? {});
          const debugMode = request.query.debug === "true";

          if (!parsed.success) {
            return reply.code(400).send({
              error: "INVALID_REQUEST",
              message: "A base64-encoded voucher image is required.",
            });
          }

          let imageBuffer: Buffer;
          try {
            imageBuffer = Buffer.from(parsed.data.imageBase64, "base64");
          } catch {
            return reply.code(400).send({
              error: "INVALID_IMAGE",
              message: "The provided image data could not be decoded.",
            });
          }

          try {
            const ocrService = new TesseractOcrService();
            const rawText = await ocrService.recognizeText(imageBuffer);
            const fields = parseVoucherText(rawText);

            return reply.send({
              ...fields,
              ...(debugMode ? { debugRawOcrText: rawText } : {}),
            });
          } catch (error) {
            request.log.error(error, "voucher extraction failed");
            return reply.code(500).send({
              error: "VOUCHER_EXTRACTION_FAILED",
              message: "Unable to read this voucher right now. You can still enter the details manually.",
            });
          }
        },
      );

      scope.post("/wallet-vouchers", async (request, reply) => {
        const userId = getAuthenticatedUserId(request);
        const parsed = createWalletVoucherSchema.safeParse(request.body ?? {});

        if (!parsed.success) {
          return reply.code(400).send({
            error: "INVALID_REQUEST",
            message: "A retailer name, barcode, and positive value are required.",
          });
        }

        const voucher = await createWalletVoucher(scope.prisma, userId, {
          retailerName: parsed.data.retailerName,
          barcode: parsed.data.barcode,
          ...(parsed.data.barcodeFormat !== undefined ? { barcodeFormat: parsed.data.barcodeFormat } : {}),
          ...(parsed.data.voucherNumber !== undefined ? { voucherNumber: parsed.data.voucherNumber } : {}),
          value: parsed.data.value,
          ...(parsed.data.currency !== undefined ? { currency: parsed.data.currency } : {}),
          ...(parsed.data.validFrom !== undefined ? { validFrom: parsed.data.validFrom } : {}),
          ...(parsed.data.expiresAt !== undefined ? { expiresAt: parsed.data.expiresAt } : {}),
          ...(parsed.data.sourcePurchaseId !== undefined ? { sourcePurchaseId: parsed.data.sourcePurchaseId } : {}),
        });
        return reply.code(201).send(voucher);
      });

      scope.get("/wallet-vouchers", async (request) => {
        const userId = getAuthenticatedUserId(request);
        return listWalletVouchersForUser(scope.prisma, userId);
      });

      scope.get<{ Params: { voucherId: string } }>(
        "/wallet-vouchers/:voucherId",
        async (request, reply) => {
          const userId = getAuthenticatedUserId(request);
          const voucher = await getWalletVoucherForUser(scope.prisma, userId, request.params.voucherId);

          if (!voucher) {
            return reply.code(404).send({
              error: "WALLET_VOUCHER_NOT_FOUND",
              message: "Voucher was not found.",
            });
          }

          return voucher;
        },
      );

      scope.post<{ Params: { voucherId: string } }>(
        "/wallet-vouchers/:voucherId/redeem",
        async (request, reply) => {
          const userId = getAuthenticatedUserId(request);

          try {
            const voucher = await redeemWalletVoucher(scope.prisma, userId, request.params.voucherId);
            return reply.send(voucher);
          } catch (error) {
            if (error instanceof Error && error.message === "WALLET_VOUCHER_NOT_FOUND") {
              return reply.code(404).send({
                error: "WALLET_VOUCHER_NOT_FOUND",
                message: "Voucher was not found.",
              });
            }
            if (error instanceof Error && error.message === "WALLET_VOUCHER_ALREADY_REDEEMED") {
              return reply.code(409).send({
                error: "WALLET_VOUCHER_ALREADY_REDEEMED",
                message: "This voucher has already been redeemed.",
              });
            }
            if (error instanceof Error && error.message === "WALLET_VOUCHER_EXPIRED") {
              return reply.code(409).send({
                error: "WALLET_VOUCHER_EXPIRED",
                message: "This voucher has expired and can no longer be redeemed.",
              });
            }
            throw error;
          }
        },
      );
    },
    { prefix: "/me" },
  );
}
