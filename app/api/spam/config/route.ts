import { json } from "@/lib/api";
import { turnstileSiteKey } from "@/lib/spam/turnstile";

/**
 * GET /api/spam/config — the public spam-protection config the forms read.
 *
 * Exists so the Turnstile SITE KEY is an env var rather than page markup. This
 * repo builds pages from the database and has golden-file tests over some of
 * them; baking a key into markup would cost a migration, while an env var costs
 * nothing and needs no code edit when the key changes.
 *
 * `siteKey: null` (the state before the keys are added) tells the client not to
 * mount the widget at all, so every form keeps working untouched until then.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  return json({ turnstileSiteKey: turnstileSiteKey() });
}
