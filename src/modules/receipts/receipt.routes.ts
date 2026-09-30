import type { FastifyInstance } from "fastify";
import { z } from "zod";

import { requireAuth } from "../auth/auth.middleware.js";
import { TesseractOcrService } from "../../integrations/ocr/ocr.service.js";
import { parseReceiptText } from "./receipt-parser.service.js";
import { verifyReceiptAgainstPromotions } from "./receipt-verification.service.js";
import { browsePromotionsForRetailer } from "../promotions/promotions.service.js";
import { PROMOTION_RETAILER_CONFIGS } from "../promotions/promotions.config.js";
import {
  createPurchase,
  getPurchaseForUser,
  listPurchasesForUser,
} from "./purchase.service.js";

function getAuthenticatedUserId(request: { currentUserId?: string }): string {
  if (!request.currentUserId) {
    throw new Error("AUTHENTICATED_USER_ID_MISSING");
  }
  return request.currentUserId;
}

const scanReceiptSchema = z.object({
  imageBase64: z.string().min(1),
});

const createPurchaseSchema = z.object({
  retailerName: z.string().trim().min(1).max(191).nullable().optional(),
  totalAmount: z.number().nonnegative().nullable().optional(),
  purchasedAt: z.coerce.date().optional(),
  /*
   * REG-005: confirming a reviewed receipt scan and creating a
   * purchase manually are the same underlying action now (this one
   * endpoint), but they should still be distinguishable in history --
   * defaults to MANUAL, preserving this endpoint's existing behaviour
   * for callers that don't specify it.
   */
  source: z.enum(["RECEIPT_SCAN", "MANUAL"]).optional(),
  items: z
    .array(
      z.object({
        name: z.string().trim().min(1).max(191),
        price: z.number().nonnegative(),
        matchedPromotionName: z.string().trim().min(1).max(191).nullable().optional(),
        paidPromoPrice: z.boolean().nullable().optional(),
      }),
    )
    .min(1),
});

export async function registerReceiptRoutes(api: FastifyInstance): Promise<void> {
  /*
   * One shared OCR service instance for the whole app -- Tesseract
   * worker initialization takes real time (several seconds), so
   * creating one per request would make every single scan slow.
   * Created lazily (see TesseractOcrService) on the first actual scan,
   * not at server startup.
   */
  const ocrService = new TesseractOcrService();

  api.addHook("onClose", async () => {
    await ocrService.terminate();
  });

  api.register(
    async (scope) => {
      scope.addHook("preHandler", requireAuth);

      /*
       * The one real image-upload endpoint in this app -- everything
       * else (loyalty card "photos") only ever creates a local blob
       * URL for display, never uploads to the backend. Base64 JSON
       * rather than multipart, consistent with the rest of this
       * codebase never having added multipart handling, but this
       * does mean Fastify's default 1MB body limit needs raising for
       * this route specifically -- a real photo, base64-encoded,
       * routinely exceeds that.
       */
      scope.post<{ Querystring: { debug?: string } }>(
        "/receipts/scan",
        { bodyLimit: 15 * 1024 * 1024 },
        async (request, reply) => {
          const parsed = scanReceiptSchema.safeParse(request.body ?? {});
          const debugMode = request.query.debug === "true";

          if (!parsed.success) {
            return reply.code(400).send({
              error: "INVALID_REQUEST",
              message: "A base64-encoded receipt image is required.",
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

          let rawText: string | undefined;
          try {
            rawText = await ocrService.recognizeText(imageBuffer);
            const receipt = parseReceiptText(rawText);

            let verification: ReturnType<typeof verifyReceiptAgainstPromotions> = {
              matchedPromotions: [],
              unmatchedItems: receipt.items,
            };

            const retailerConfig = receipt.retailerName
              ? PROMOTION_RETAILER_CONFIGS.find(
                  (c) => c.retailerCode === receipt.retailerName,
                )
              : undefined;

            if (retailerConfig && receipt.items.length > 0) {
              // Best-effort: if the live specials page can't be
              // fetched right now, the receipt is still returned for
              // review -- just without promotion verification for
              // this scan, rather than failing the whole request.
              try {
                const promotions = await browsePromotionsForRetailer(retailerConfig);
                verification = verifyReceiptAgainstPromotions(receipt.items, promotions);
              } catch (error) {
                request.log.warn(error, "promotion verification failed during receipt scan");
              }
            }

            /*
             * REG-005: this is the OCR + parse step only -- nothing is
             * persisted here. Each parsed item is returned with its
             * promotion-match info attached directly (rather than a
             * separate parallel array the frontend would need to
             * cross-reference), so the review screen can show and
             * edit a single flat list. The user reviews, corrects
             * (edit names/prices, remove wrong items, add missing
             * ones), and only when they confirm does the frontend
             * call POST /me/purchases below to actually save --
             * carrying forward whatever matchedPromotionName/
             * paidPromoPrice survived their edits.
             */
            const items = receipt.items.map((item) => {
              const match = verification.matchedPromotions.find(
                (m) => m.purchasedItem === item,
              );
              return {
                name: item.name,
                price: item.price,
                matchedPromotionName: match?.matchedPromotion.name ?? null,
                paidPromoPrice: match?.paidPromoPrice ?? null,
              };
            });

            return reply.send({
              retailerName: receipt.retailerName,
              total: receipt.total,
              items,
              ...(debugMode ? { debugRawOcrText: rawText } : {}),
            });
          } catch (error) {
            request.log.error(error, "receipt scan failed");
            return reply.code(500).send({
              error: "RECEIPT_SCAN_FAILED",
              message: "Unable to process this receipt right now. You can still enter the items manually.",
              ...(debugMode ? { debugRawOcrText: rawText ?? null } : {}),
            });
          }
        },
      );

      scope.get("/purchases", async (request) => {
        const userId = getAuthenticatedUserId(request);
        return listPurchasesForUser(scope.prisma, userId);
      });

      scope.get<{ Params: { purchaseId: string } }>(
        "/purchases/:purchaseId",
        async (request, reply) => {
          const userId = getAuthenticatedUserId(request);
          const purchase = await getPurchaseForUser(
            scope.prisma,
            userId,
            request.params.purchaseId,
          );
          if (!purchase) {
            return reply.code(404).send({
              error: "PURCHASE_NOT_FOUND",
              message: "Purchase was not found.",
            });
          }
          return purchase;
        },
      );

      scope.post("/purchases", async (request, reply) => {
        const userId = getAuthenticatedUserId(request);
        const parsed = createPurchaseSchema.safeParse(request.body ?? {});

        if (!parsed.success) {
          return reply.code(400).send({
            error: "INVALID_REQUEST",
            message: "At least one item (name + price) is required.",
          });
        }

        const totalAmount =
          parsed.data.totalAmount ??
          parsed.data.items.reduce((sum, item) => sum + item.price, 0);

        const purchase = await createPurchase(scope.prisma, userId, {
          retailerName: parsed.data.retailerName ?? null,
          totalAmount,
          ...(parsed.data.purchasedAt ? { purchasedAt: parsed.data.purchasedAt } : {}),
          source: parsed.data.source ?? "MANUAL",
          items: parsed.data.items.map((item) => ({
            name: item.name,
            price: item.price,
            matchedPromotionName: item.matchedPromotionName ?? null,
            paidPromoPrice: item.paidPromoPrice ?? null,
          })),
        });

        return reply.code(201).send(purchase);
      });
    },
    { prefix: "/me" },
  );
}
