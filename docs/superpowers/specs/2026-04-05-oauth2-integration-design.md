# OAuth2 (Authorization Code) Integration — Design

**Date:** 2026-04-05  
**Status:** Draft for implementation (brainstorming complete)  
**Base branch:** `main`

## Goals

- Optional **OAuth2 Authorization Code** login for Deep Agent UI.
- **Configurable:** authorization URL, token URL, client id, enable/disable OAuth2, JWT claim names for user id and username, and the HTTP header name used to send user id to the LangGraph backend.
- **User-visible username** in the UI when authenticated.
- **Public client:** `client_id` only, **no `client_secret`**, **no PKCE** (IdP must allow this; many providers require PKCE — document risk).
- **Token exchange** via **Next.js Route Handler** (same-origin) to avoid browser CORS issues against the token endpoint.
- **Persistence:** tokens in **`localStorage`**; when the session is **expired**, **clear stored OAuth state** and **re-trigger the login flow** (no silent refresh required for v1).

## Non-goals (v1)

- OIDC discovery (`.well-known`).
- PKCE (explicitly out of scope unless added later).
- Client secret / confidential client flows.
- JWT signature verification (JWKS); backend must not rely solely on forwarded headers for authorization.
- Refresh token rotation UX beyond “expired → sign in again.”

## Configuration

Extend runtime config (`public/deep-agents-ui.config.json` pattern and `PublicAppConfigFile`) with:

| Field | Type | Description |
|--------|------|-------------|
| `oauth2Enabled` | boolean | When `false`, app behaves as today: no OAuth UI, no user-id header from OAuth. |
| `oauthAuthorizationUrl` | string | Authorization endpoint URL. |
| `oauthTokenUrl` | string | Token endpoint URL (server-side proxy target). |
| `oauthClientId` | string | Public client id. |
| `oauthScope` | string | Space-separated scopes (e.g. `openid profile email`). |
| `oauthJwtSource` | `"id_token"` \| `"access_token"` | Which token from the token response is treated as JWT for claim extraction. |
| `oauthUserIdClaim` | string | JWT payload claim for user id (sent in backend header). |
| `oauthUsernameClaim` | string | JWT payload claim for display name in UI. |
| `oauthUserIdHeader` | string | Header name on LangGraph `Client` requests (e.g. `X-User-Id`). |

**Redirect URI:** Fixed path under the app origin, e.g. `/oauth/callback` (documented; IdP registration must match `https://<host>/oauth/callback`). No configurable path in v1 unless requirements change.

Env parity: mirror critical flags/URLs with `NEXT_PUBLIC_*` where the existing app pattern uses env overrides (same merge rules as other public config).

## Architecture

### Token exchange (Approach 2)

- Browser completes redirect to **`/oauth/callback`** with `code` and `state`.
- Callback page calls **`POST /api/oauth/token`** (same origin) with the code and redirect URI metadata.
- Route Handler forwards **`application/x-www-form-urlencoded`** body to configured **`oauthTokenUrl`** with:
  - `grant_type=authorization_code`
  - `code`
  - `client_id`
  - `redirect_uri` (must match authorization request)
  - **No** `client_secret`, **no** PKCE parameters.
- Handler returns token JSON to the client (or normalized subset: tokens + `expires_in`).

### Session storage (`localStorage`)

Persist minimally:

- Raw token response fields needed: `access_token`, `id_token` (if used), `expires_in` (if present), `token_type` (if needed).
- Derived: **expiry instant** for session validity (see below).
- Derived: **user id** and **username** after JWT decode (or re-decode on load from stored JWT).

**Expiry and re-login**

1. **Primary:** If token response includes **`expires_in`** (seconds), compute `expiresAt = issuedAt + expires_in` (use server response time or client `Date.now()` at receipt; document skew).
2. **Secondary:** If the JWT used for claims contains **`exp`**, use the **earlier** of `expiresAt` from (1) and JWT `exp` for the access/id token actually used for API calls, depending on which token is sent to the backend (if any).
3. On **app load** and **before relying on authenticated state**, if `now >= expiry` (with a small clock-skew buffer, e.g. 60s), **clear** OAuth-related `localStorage` keys and treat user as **signed out**, then **present sign-in** or **redirect into the authorization** flow (product choice: default to explicit “Sign in” button for clearer debugging).

If neither `expires_in` nor JWT `exp` is available, document as **unsupported** for strict expiry behavior; implementation may treat session as valid until manual sign-out or cap with a conservative default (prefer requiring IdP to return `expires_in`).

### JWT claims

- Decode **payload only** (base64url) of the token selected by `oauthJwtSource`.
- Map `oauthUserIdClaim` and `oauthUsernameClaim` from JSON payload.
- Missing claims: show error, clear session, prompt re-login.

### LangGraph client

- Extend `ClientProvider` (or equivalent) so `defaultHeaders` include:
  - Existing: `Content-Type`, `X-Api-Key` (LangSmith).
  - When `oauth2Enabled` and user id present and session **not** expired: **`oauthUserIdHeader`: user id**.

### UI

- When `oauth2Enabled` and not authenticated: gate or show **Sign in** (exact pattern: align with existing layout/header).
- When authenticated: show **username** (from stored claim or re-parsed JWT); **Sign out** clears `localStorage` OAuth keys and UI state.

### Security notes (documentation)

- Public client without PKCE: document **OAuth threat model** (e.g. authorization code interception); IdPs may **require** PKCE — operators must confirm IdP policy.
- Forwarded user id header is **hint** for backend; LangGraph deployment should enforce real auth as appropriate.

## Testing

- Unit tests: JWT payload parsing, expiry computation, header merge for `Client`.
- Route Handler: mock upstream token endpoint; assert forwarded body shape and no secret leakage.

## Implementation branch

- Branch from **`main`**; integrate before unrelated refactors.

## Open items

- Exact fixed callback path string (`/oauth/callback`) — confirm in README and IdP setup.
- Whether to auto-redirect to IdP when session expired vs. show a dedicated “Session expired” message (recommend message + Sign in for clarity).
