import { NextRequest, NextResponse } from "next/server";
import { isValidSession, SESSION_COOKIE } from "@/lib/session";

// Öffentlich: Login und Erweiterungs-/Worker-API (eigener Token)
const PUBLIC = ["/login", "/api/login", "/api/ext", "/manifest.webmanifest", "/sw.js", "/icon-", "/apple-icon", "/favicon"];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (PUBLIC.some((p) => pathname.startsWith(p))) return NextResponse.next();
  if (await isValidSession(req.cookies.get(SESSION_COOKIE)?.value)) return NextResponse.next();
  if (pathname.startsWith("/api/")) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  // Echte Adresse aus den Proxy-Headern nehmen (sonst landet man hinter Tailscale auf 0.0.0.0)
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? req.nextUrl.host;
  const proto = host.endsWith(".ts.net") ? "https" : (req.headers.get("x-forwarded-proto") ?? req.nextUrl.protocol.replace(":", ""));
  return NextResponse.redirect(`${proto}://${host}/login`);
}

export const config = { matcher: ["/((?!_next|favicon.ico).*)"] };
