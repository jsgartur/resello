import "server-only";
import { NextRequest } from "next/server";

/** Prüft den Bearer-Token von Chrome-Erweiterung / Worker. */
export function checkExtensionToken(req: NextRequest) {
  const token = process.env.EXTENSION_TOKEN;
  const header = req.headers.get("authorization") || "";
  return !!token && header === `Bearer ${token}`;
}
