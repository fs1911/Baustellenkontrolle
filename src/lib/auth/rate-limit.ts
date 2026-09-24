import "server-only";

/**
 * Einfache In-Memory-Begrenzung für Anmeldeversuche (pro Instanz).
 * Produktion mit Supabase Auth: zusätzlich greifen die Rate Limits von Supabase.
 */
const attempts = new Map<string, { count: number; resetAt: number }>();
const WINDOW_MS = 10 * 60 * 1000;
const MAX = 8;

export function checkRateLimit(key: string): { allowed: boolean; retryInMinutes: number } {
  const now = Date.now();
  const entry = attempts.get(key);
  if (!entry || entry.resetAt < now) {
    attempts.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return { allowed: true, retryInMinutes: 0 };
  }
  entry.count += 1;
  return { allowed: entry.count <= MAX, retryInMinutes: Math.ceil((entry.resetAt - now) / 60000) };
}

export function resetRateLimit(key: string) {
  attempts.delete(key);
}
