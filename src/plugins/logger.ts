import fp from "fastify-plugin";

const loggerPlugin = fp(async (fastify) => {
  fastify.log.info("BargaiNest logging initialized");
});

export default loggerPlugin;