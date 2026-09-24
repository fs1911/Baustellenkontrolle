import "server-only";
import { SignJWT, jwtVerify } from "jose";
import { env } from "@/lib/env";

export const SESSION_COOKIE = "bk_session";
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 10; // 10 Stunden (Arbeitstag)

function key(): Uint8Array {
  return new TextEncoder().encode(env().SESSION_SECRET);
}

export interface SessionClaims {
  sub: string;
  email: string;
}

export async function createSessionToken(claims: SessionClaims): Promise<string> {
  return new SignJWT({ email: claims.email })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(claims.sub)
    .setIssuedAt()
    .setIssuer("baustellenkontrolle")
    .setAudience("baustellenkontrolle")
    .setExpirationTime(`${SESSION_MAX_AGE_SECONDS}s`)
    .sign(key());
}

export async function verifySessionToken(token: string): Promise<SessionClaims | null> {
  try {
    const { payload } = await jwtVerify(token, key(), {
      issuer: "baustellenkontrolle",
      audience: "baustellenkontrolle",
      algorithms: ["HS256"],
    });
    if (typeof payload.sub !== "string" || typeof payload.email !== "string") return null;
    return { sub: payload.sub, email: payload.email };
  } catch {
    return null;
  }
}
