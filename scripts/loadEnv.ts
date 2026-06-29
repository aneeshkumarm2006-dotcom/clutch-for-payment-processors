import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Minimal `.env` loader for standalone CLI scripts (seed-admin, seed).
 *
 * Next.js loads `.env.local` automatically, but `tsx scripts/*.ts` does not —
 * so we parse it ourselves with zero dependencies. Existing `process.env`
 * values win (so real env / CI overrides take precedence over the file).
 */
export function loadEnv(file = ".env.local"): void {
  let content: string;
  try {
    content = readFileSync(resolve(process.cwd(), file), "utf8");
  } catch {
    // No file — rely on whatever is already in process.env.
    return;
  }

  for (const rawLine of content.split("\n")) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    const eq = line.indexOf("=");
    if (eq === -1) continue;

    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}
