import type { FastifyReply, FastifyRequest } from "fastify";

import { getSessionCookieName, getUserFromSession } from "./auth.service.js";

declare module "fastify" {
  interface FastifyRequest {
    currentUserId?: string;
    currentSessionId?: string;
  }
}

function getBearerToken(request: FastifyRequest): string | null {
  const authorization = request.headers.authorization;

  if (!authorization) {
    return null;
  }

  const [scheme, token] = authorization.split(" ");

  if (scheme?.toLowerCase() !== "bearer" || !token) {
    return null;
  }

  return token;
}

export async function requireAuth(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const cookieToken = request.cookies?.[getSessionCookieName()];
  const bearerToken = getBearerToken(request);

  const token = cookieToken || bearerToken;

  if (!token) {
    await reply.code(401).send({
      error: "UNAUTHENTICATED",
      message: "Authentication is required."
    });
    return;
  }

  const result = await getUserFromSession(request.server.prisma, token);

  if (!result) {
    await reply.code(401).send({
      error: "INVALID_SESSION",
      message: "The authentication session is invalid or expired."
    });
    return;
  }

  request.currentUserId = result.user.id;
  request.currentSessionId = result.sessionId;
}
