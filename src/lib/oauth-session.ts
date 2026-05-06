import type { ResolvedOAuth2Config } from "@/lib/config";
import {
  OAUTH_SESSION_STORAGE_KEY,
  OAUTH_STATE_STORAGE_KEY,
} from "@/lib/oauth-constants";

const CLOCK_SKEW_MS = 60_000;

export interface TokenResponseJson {
  access_token?: string;
  id_token?: string;
  expires_in?: number;
  token_type?: string;
  refresh_token?: string;
}

export interface PersistedOAuthSession {
  v: 1;
  issuedAtMs: number;
  expiresAtMs: number | null;
  userId: string;
  username: string;
  access_token?: string;
  id_token?: string;
}

function base64UrlToBase64(input: string): string {
  const b64 = input.replace(/-/g, "+").replace(/_/g, "/");
  const pad = (4 - (b64.length % 4)) % 4;
  return b64 + "=".repeat(pad);
}

export function decodeJwtPayload(token: string): Record<string, unknown> {
  const parts = token.split(".");
  if (parts.length !== 3) {
    throw new Error("Invalid JWT format");
  }
  const json = atob(base64UrlToBase64(parts[1]));
  return JSON.parse(json) as Record<string, unknown>;
}

export function computeExpiresAtMs(
  tr: TokenResponseJson,
  jwtSource: "id_token" | "access_token",
  issuedAtMs: number
): number | null {
  let expiresAt: number | null = null;
  if (typeof tr.expires_in === "number" && Number.isFinite(tr.expires_in)) {
    expiresAt = issuedAtMs + tr.expires_in * 1000;
  }
  const token =
    jwtSource === "id_token" ? tr.id_token : tr.access_token;
  if (token) {
    try {
      const payload = decodeJwtPayload(token) as { exp?: number };
      if (typeof payload.exp === "number") {
        const jwtExpMs = payload.exp * 1000;
        expiresAt =
          expiresAt === null ? jwtExpMs : Math.min(expiresAt, jwtExpMs);
      }
    } catch {
      /* ignore */
    }
  }
  return expiresAt;
}

export function isSessionExpired(expiresAtMs: number | null): boolean {
  if (expiresAtMs === null) return false;
  return Date.now() >= expiresAtMs - CLOCK_SKEW_MS;
}

export function loadPersistedOAuthSession(): PersistedOAuthSession | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(OAUTH_SESSION_STORAGE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as PersistedOAuthSession;
    if (parsed.v !== 1 || typeof parsed.userId !== "string") {
      return null;
    }
    if (isSessionExpired(parsed.expiresAtMs)) {
      clearOAuthSessionStorage();
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function persistSessionFromTokenResponse(
  oauth: ResolvedOAuth2Config,
  tr: TokenResponseJson
): PersistedOAuthSession {
  const issuedAtMs = Date.now();
  const expiresAtMs = computeExpiresAtMs(tr, oauth.jwtSource, issuedAtMs);
  const token =
    oauth.jwtSource === "id_token" ? tr.id_token : tr.access_token;
  if (!token || typeof token !== "string") {
    throw new Error(
      `Token response missing ${oauth.jwtSource} for claim extraction`
    );
  }
  const payload = decodeJwtPayload(token);
  const uid = payload[oauth.userIdClaim];
  const uname = payload[oauth.usernameClaim];
  const userId = uid != null ? String(uid) : "";
  const username = uname != null ? String(uname) : "";
  if (!userId) {
    throw new Error(`Missing claim "${oauth.userIdClaim}" in JWT`);
  }

  const session: PersistedOAuthSession = {
    v: 1,
    issuedAtMs,
    expiresAtMs,
    userId,
    username,
    access_token: tr.access_token,
    id_token: tr.id_token,
  };
  localStorage.setItem(OAUTH_SESSION_STORAGE_KEY, JSON.stringify(session));
  return session;
}

export function clearOAuthSessionStorage(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(OAUTH_SESSION_STORAGE_KEY);
  localStorage.removeItem(OAUTH_STATE_STORAGE_KEY);
}

export function storeOAuthState(state: string): void {
  localStorage.setItem(OAUTH_STATE_STORAGE_KEY, state);
}

export function consumeOAuthState(): string | null {
  const s = localStorage.getItem(OAUTH_STATE_STORAGE_KEY);
  if (s) localStorage.removeItem(OAUTH_STATE_STORAGE_KEY);
  return s;
}

