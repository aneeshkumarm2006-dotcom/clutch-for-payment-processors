import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { setServers } from "node:dns";
import { setServers as setServersPromise } from "node:dns/promises";

/**
 * Minimal `.env` loader for standalone CLI scripts (seed-admin, seed).
 *
 * Next.js loads `.env.local` automatically, but `tsx scripts/*.ts` does not —
 * so we parse it ourselves with zero dependencies. Existing `process.env`
 * values win (so real env / CI overrides take precedence over the file).
 */
export function loadEnv(file = ".env.local"): void {
  // Atlas uses a `mongodb+srv://` URI, which requires a DNS SRV lookup. Some
  // networks/Windows resolvers refuse SRV queries (querySrv ECONNREFUSED), which
  // breaks the seed before it starts. Point Node's resolver at public DNS so the
  // SRV/TXT lookup succeeds regardless of the local resolver. Honour an override
  // via DNS_SERVERS (comma-separated) for locked-down environments.
  //
  // Node keeps SEPARATE resolvers for the callback (`node:dns`) and promise
  // (`node:dns/promises`) APIs; the MongoDB driver resolves SRV via the PROMISE
  // one, so we MUST set both — setting only the callback resolver looks fixed via
  // `dns.getServers()` yet leaves the driver's lookup on the broken resolver.
  try {
    const servers = (process.env.DNS_SERVERS ?? "8.8.8.8,1.1.1.1")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (servers.length) {
      setServers(servers);
      setServersPromise(servers);
    }
  } catch {
    // Non-fatal: fall back to the system resolver.
  }

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
