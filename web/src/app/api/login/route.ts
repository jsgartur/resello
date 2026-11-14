import { NextRequest, NextResponse } from "next/server";
import { createSessionValue, SESSION_COOKIE } from "@/lib/session";

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const ok = !!process.env.APP_PASSWORD && form.get("password") === process.env.APP_PASSWORD;
  const res = NextResponse.redirect(new URL(ok ? "/" : "/login?error=1", req.url), 303);
  if (ok) {
    res.cookies.set(SESSION_COOKIE, await createSessionValue(), {
      httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24 * 30,
    });
  }
  return res;
}
