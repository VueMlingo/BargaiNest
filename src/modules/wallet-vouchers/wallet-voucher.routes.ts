import type { FastifyInstance } from "fastify";
import { z } from "zod";

import { requireAuth } from "../auth/auth.middleware.js";
import {
  createWalletVoucher,
  listWalletVouchersForUser,
  getWalletVoucherForUser,
  redeemWalletVoucher,
} from "./wallet-voucher.service.js";

function getAuthenticatedUserId(request: { currentUserId?: string }): string {
  if (!request.currentUserId) {
    throw new Error("AUTHENTICATED_USER_ID_MISSING");
  }
  return request.currentUserId;
}

const createWalletVoucherSchema = z.object({
  retailerName: z.string().trim().min(1).max(191),
  barcode: z.string().trim().min(1).max(191),
  barcodeFormat: z.string().trim().min(1).max(50).nullable().optional(),
  value: z.coerce.number().positive(),
  currency: z.string().trim().length(3).optional(),
  expiresAt: z.coerce.date().nullable().optional(),
  sourcePurchaseId: z.string().uuid().nullable().optional(),
});

export async function registerWalletVoucherRoutes(api: FastifyInstance): Promise<void> {
  await api.register(
    async (scope) => {
      scope.addHook("preHandler", requireAuth);

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
          value: parsed.data.value,
          ...(parsed.data.currency !== undefined ? { currency: parsed.data.currency } : {}),
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
