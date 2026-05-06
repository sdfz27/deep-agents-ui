import type { ResolvedOAuth2Config } from "@/lib/config";
import { OAUTH_REDIRECT_PATH } from "@/lib/oauth-constants";
import { storeOAuthState } from "@/lib/oauth-session";

export function startOAuthLogin(oauth: ResolvedOAuth2Config): void {
  const state = crypto.randomUUID();
  storeOAuthState(state);
  const url = new URL(oauth.authorizationUrl);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", oauth.clientId);
  url.searchParams.set(
    "redirect_uri",
    `${window.location.origin}${OAUTH_REDIRECT_PATH}`
  );
  url.searchParams.set("scope", oauth.scope);
  url.searchParams.set("state", state);
  window.location.assign(url.toString());
}
