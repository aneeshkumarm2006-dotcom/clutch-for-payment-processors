import { NextResponse } from "next/server";
import { SEO_COOKIE } from "@/lib/seoteam-auth";

/** POST /api/seoteam/logout — clear the SEO dashboard session cookie. */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SEO_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return res;
}
