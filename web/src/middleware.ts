import { NextRequest, NextResponse } from "next/server";
import { isValidSession, SESSION_COOKIE } from "@/lib/session";

// Öffentlich: Login und Erweiterungs-/Worker-API (eigener Token)
const PUBLIC = ["/login", "/api/login", "/api/ext"];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (PUBLIC.some((p) => pathname.startsWith(p))) return NextResponse.next();
  if (await isValidSession(req.cookies.get(SESSION_COOKIE)?.value)) return NextResponse.next();
  if (pathname.startsWith("/api/")) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  // Relative Weiterleitung – funktioniert auch hinter Tailscale/Proxy (sonst landet man auf 0.0.0.0)
  return new NextResponse(null, { status: 307, headers: { Location: "/login" } });
}

export const config = { matcher: ["/((?!_next|favicon.ico).*)"] };
