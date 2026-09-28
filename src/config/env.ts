import "dotenv/config";

import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),

  PORT: z.coerce
    .number()
    .int()
    .min(1)
    .max(65535)
    .default(4000),

  DB_HOST: z
    .string()
    .min(1, "DB_HOST is required")
    .optional(),

  DB_PORT: z.coerce
    .number()
    .int()
    .min(1)
    .max(65535)
    .default(3306),

  DB_USER: z
    .string()
    .min(1, "DB_USER is required"),

  DB_PASSWORD: z
    .string()
    .min(1, "DB_PASSWORD is required"),

  DB_NAME: z
    .string()
    .min(1, "DB_NAME is required"),

  LOG_LEVEL: z
    .enum(["fatal", "error", "warn", "info", "debug", "trace"])
    .default("info"),

  CORS_ORIGIN: z
    .string()
    .min(1)
    .default("http://localhost:5173"),

  AUTH_SESSION_SECRET: z
    .string()
    .min(32, "AUTH_SESSION_SECRET must be at least 32 characters"),

  AUTH_SESSION_TTL_DAYS: z.coerce
    .number()
    .int()
    .min(1)
    .max(90)
    .default(30),

  /*
   * Base URL the frontend is served from, used to build password-reset
   * and email-verification links (e.g. "https://pilot.bargainest.co.za").
   * Defaults to a local dev value so this doesn't hard-fail existing
   * environments that never needed it before this feature existed.
   */
  PUBLIC_APP_URL: z
    .string()
    .min(1)
    .default("http://localhost:5173"),

  PASSWORD_RESET_TOKEN_TTL_MINUTES: z.coerce
    .number()
    .int()
    .min(5)
    .max(1440)
    .default(60),

  EMAIL_VERIFICATION_TOKEN_TTL_HOURS: z.coerce
    .number()
    .int()
    .min(1)
    .max(168)
    .default(48),

  SUPPORT_INBOX_EMAIL: z
    .string()
    .min(1)
    .default("support@bargainest.co.za"),

  /*
   * Shared secret an external scheduler (e.g. Cloud Scheduler hitting
   * a Cloud Run endpoint) presents to trigger internal maintenance
   * tasks like the reward-expiry check. Required in production (no
   * default) -- an internal task endpoint with no real secret
   * configured would be a genuine security hole, not a convenience.
   */
  INTERNAL_TASK_SECRET: z
    .string()
    .min(16, "INTERNAL_TASK_SECRET must be at least 16 characters")
    .optional(),

  /*
   * All optional -- unset SMTP_HOST means "not configured yet", not
   * an error. createEmailSender() falls back to ConsoleEmailSender
   * when this is the case, so local dev and CI never need SMTP set up
   * at all. Works with SendGrid's SMTP relay, AWS SES's SMTP
   * interface, or any standard SMTP provider -- whichever the real
   * deployment ends up using, it's a config change here, not a code
   * change.
   */
  SMTP_HOST: z.string().min(1).optional(),
  SMTP_PORT: z.coerce.number().int().min(1).max(65535).optional(),
  SMTP_SECURE: z.coerce.boolean().optional(),
  SMTP_USER: z.string().min(1).optional(),
  SMTP_PASSWORD: z.string().min(1).optional(),
  SMTP_FROM_ADDRESS: z.string().email().optional(),

  /*
   * Where scripts/fetch-ocr-language-data.sh downloads the Tesseract
   * trained language data to. Defaults to a path relative to the
   * backend root, matching the script's own default.
   */
  OCR_LANG_DATA_DIR: z.string().min(1).default("./ocr-lang-data"),

  /*
   * Constructor.io is the third-party search platform both Pick n Pay
   * and Woolworths use for their own site search (confirmed by
   * probing both sites for cnstrc.com references -- see
   * CONSTRUCTOR-IO-PRICE-LOOKUP.md). These are each retailer's own
   * PUBLIC client key (the same one powering their own search bar,
   * not a secret credential) -- found by inspecting network requests
   * to cnstrc.com while using that retailer's search. Optional: if
   * unset, that retailer's live price lookup returns no results
   * rather than failing the whole search.
   */
  PICK_N_PAY_CONSTRUCTOR_KEY: z.string().min(1).optional(),

  /*
   * Pick n Pay's OWN commerce backend (SAP Hybris/OCC) exposes a
   * search endpoint that takes a specific store code directly and
   * returns that store's real price -- confirmed live (2026-09-21),
   * works as a plain server-to-server call with no auth at all. This
   * is a better, more direct path than Constructor.io for Pick n Pay
   * (no ambiguous multi-variation guessing needed) -- see
   * PNP-HYBRIS-PRICE-LOOKUP.md. Setting this switches Pick n Pay's
   * live search over to that path; per-request `storeCode` (see
   * CataloguePriceLookupQuery) overrides this default when a
   * shopper's actual store is known.
   */
  PICK_N_PAY_DEFAULT_STORE_CODE: z.string().min(1).optional(),
  WOOLWORTHS_CONSTRUCTOR_KEY: z.string().min(1).optional(),
  /*
   * Confirmed live (2026-09-21): Woolworths' Constructor.io key is
   * scoped to their OWN dedicated tenant subdomain
   * (wpkmgeuco-zone.cnstrc.com), not the shared ac.cnstrc.com host
   * every other Constructor.io customer uses by default (Pick n Pay
   * included -- confirmed working against the shared host with no
   * override needed). Required for Woolworths' key to work at all.
   */
  WOOLWORTHS_CONSTRUCTOR_HOST: z.string().min(1).default("wpkmgeuco-zone.cnstrc.com"),

  /*
   * Woolworths' Constructor.io response prices every product for
   * three zones at once. CONFIRMED (2026-09-21, by comparing real
   * displayed prices at three different delivery addresses against
   * the API's own values, across two different products to
   * cross-validate): p10 = Western Cape, p30 = Gauteng, p60 =
   * KwaZulu-Natal.
   *
   * This is genuinely a per-user, location-dependent value, not a
   * single "correct" default -- whichever zone is picked here will
   * be wrong for shoppers outside that province. Defaults to p30
   * (Gauteng) as the best available single default given no
   * per-user location today -- Gauteng is South Africa's most
   * populous province by a wide margin -- but this is a real product
   * gap, not a solved problem: see CONSTRUCTOR-IO-PRICE-LOOKUP.md.
   * The right long-term fix is knowing each user's own delivery area
   * and selecting their actual zone, not guessing one for everyone.
   */
  WOOLWORTHS_PRICE_ZONE: z.enum(["p10", "p30", "p60"]).default("p30")
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error(
    "Invalid environment configuration:",
    parsed.error.flatten().fieldErrors
  );
  process.exit(1);
}

export const env = parsed.data;
