// Scope vocabulary (H3). apiv2 has no notion of scope — a seller token is
// all-or-nothing — so this server is the only place least-privilege exists.
// Every tool declares the scope it needs; a token carries the scopes the
// seller approved on the consent page.

export const SCOPES = {
  "seller:read": "View orders, tracking, shipping rates and pickup addresses",
  "seller:write": "Create, ship and cancel orders; schedule pickups",
} as const;

export type Scope = keyof typeof SCOPES;

/** Canonical order — used when scopes are rendered or serialized. */
export const ALL_SCOPES: readonly Scope[] = Object.keys(SCOPES) as Scope[];

/** What a client gets when it asks for nothing. Least privilege by default. */
export const DEFAULT_SCOPES: readonly Scope[] = ["seller:read"];

export function isScope(value: string): value is Scope {
  return Object.prototype.hasOwnProperty.call(SCOPES, value);
}

/**
 * Parse an RFC 6749 space-delimited scope string. Unknown values are
 * returned separately so the caller can answer `invalid_scope` instead of
 * silently narrowing what the client asked for.
 */
export function parseScope(raw?: string): { scopes: Set<Scope>; unknown: string[] } {
  const parts = (raw ?? "").split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { scopes: new Set(DEFAULT_SCOPES), unknown: [] };

  const scopes = new Set<Scope>();
  const unknown: string[] = [];
  for (const part of parts) {
    if (isScope(part)) scopes.add(part);
    else unknown.push(part);
  }
  return { scopes, unknown };
}

/** Serialize in canonical order, e.g. "seller:read seller:write". */
export function formatScope(scopes: Iterable<Scope>): string {
  const set = new Set(scopes);
  return ALL_SCOPES.filter((s) => set.has(s)).join(" ");
}

/**
 * Does a grant cover the required scope? Accepts either a parsed set or the
 * raw string stored on a token, so callers never need to re-parse.
 */
export function permits(granted: Iterable<Scope> | string, required: Scope): boolean {
  const set = typeof granted === "string" ? parseScope(granted).scopes : new Set(granted);
  return set.has(required);
}
