// Läuft in Middleware (Edge) und Node – daher nur Web Crypto.
const enc = new TextEncoder();

async function hmac(data: string) {
  const secret = process.env.SESSION_SECRET || process.env.APP_PASSWORD || "dev";
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(data));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export const SESSION_COOKIE = "resello_session";

export async function createSessionValue() {
  const exp = Date.now() + 1000 * 60 * 60 * 24 * 30; // 30 Tage
  return `${exp}.${await hmac(String(exp))}`;
}

export async function isValidSession(value: string | undefined) {
  if (!value) return false;
  const [exp, sig] = value.split(".");
  if (!exp || !sig || Number(exp) < Date.now()) return false;
  return (await hmac(exp)) === sig;
}
