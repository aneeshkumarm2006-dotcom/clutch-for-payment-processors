/**
 * Compare constants shared by the SERVER compare pages (`/compare`,
 * `/compare/[pair]`) and the CLIENT compare store (CompareContext / CompareView).
 *
 * Kept in a plain (non-"use client") module on purpose: when a Server Component
 * imports a value from a "use client" module, React replaces it with a
 * client-reference proxy ({}), not the real value. That silently turned
 * `COMPARE_MAX` into `{}` on the server, so `parseIds(...).slice(0, COMPARE_MAX)`
 * became `slice(0, NaN)` → `[]` and the compare pages could never resolve any
 * `?ids=` / pair slugs. Importing the constant from here keeps the real value on
 * both sides.
 */

/** Max processors comparable side by side (PRD §9.4). */
export const COMPARE_MAX = 4;
