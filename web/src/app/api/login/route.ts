import { NextRequest, NextResponse } from "next/server";
import { createSessionValue, SESSION_COOKIE } from "@/lib/session";

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const ok = !!process.env.APP_PASSWORD && form.get("password") === process.env.APP_PASSWORD;
  // Relative Weiterleitung – funktioniert auch hinter Tailscale/Proxy
  const res = new NextResponse(null, { status: 303, headers: { Location: ok ? "/" : "/login?error=1" } });
  if (ok) {
    res.cookies.set(SESSION_COOKIE, await createSessionValue(), {
      httpOnly: true, sameSite: "lax", secure: req.headers.get("x-forwarded-proto") === "https" || req.nextUrl.protocol === "https:", path: "/", maxAge: 60 * 60 * 24 * 30,
    });
  }
  return res;
}
