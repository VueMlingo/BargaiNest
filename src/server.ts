import { buildApp } from "./app/app.js";
import { env } from "./config/env.js";

const app = buildApp();

const start = async (): Promise<void> => {
  try {
    await app.listen({
      port: env.PORT,
      host: "0.0.0.0"
    });

    app.log.info(
      `BargaiNest Backend running on port ${env.PORT}`
    );
  } catch (error) {
    app.log.error(error);
    process.exit(1);
  }
};

start();