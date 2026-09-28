import {
  FastifyError,
  FastifyInstance,
  FastifyReply,
  FastifyRequest
} from "fastify";

export function registerErrorHandler(
  fastify: FastifyInstance
): void {
  fastify.setErrorHandler(
    (
      error: FastifyError,
      request: FastifyRequest,
      reply: FastifyReply
    ) => {
      request.log.error(
        {
          err: error,
          method: request.method,
          url: request.url
        },
        "Request failed"
      );

      const statusCode =
        error.statusCode && error.statusCode >= 400
          ? error.statusCode
          : 500;

      reply.status(statusCode).send({
        error: {
          code:
            statusCode >= 500
              ? "INTERNAL_SERVER_ERROR"
              : error.code ?? "REQUEST_ERROR",

          message:
            statusCode >= 500
              ? "An unexpected error occurred."
              : error.message
        }
      });
    }
  );
}