/**
 * config/env.ts calls process.exit(1) at import time if required
 * environment variables are missing -- correct behaviour for a real
 * deployment (fail fast on bad config), but it means any test file
 * that transitively imports anything touching `env` needs these set
 * first. Only sets values that aren't already present, so a real CI
 * environment's actual secrets are never overridden.
 */
process.env.DB_USER ??= "test_user";
process.env.DB_PASSWORD ??= "test_password";
process.env.DB_NAME ??= "test_db";
process.env.AUTH_SESSION_SECRET ??= "test_session_secret_at_least_32_characters_long";
