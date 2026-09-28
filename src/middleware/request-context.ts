import { FastifyInstance } from "fastify";
import { randomUUID } from "node:crypto";

export function registerRequestContext(
  fastify: FastifyInstance
): void {
  fastify.addHook("onRequest", async (request, reply) => {
    const requestId =
      request.headers["x-request-id"]?.toString() ??
      randomUUID();

    reply.header("x-request-id", requestId);

    request.log = request.log.child({
      requestId
    });
  });
}