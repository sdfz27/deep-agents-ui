"use client";

import { Suspense, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import {
  getEnvAppConfig,
  loadPublicAppConfig,
  resolveOAuth2Settings,
} from "@/lib/config";
import { OAUTH_REDIRECT_PATH } from "@/lib/oauth-constants";
import {
  clearOAuthSessionStorage,
  consumeOAuthState,
  persistSessionFromTokenResponse,
} from "@/lib/oauth-session";
import type { TokenResponseJson } from "@/lib/oauth-session";

function CallbackInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    void (async () => {
      const err = searchParams.get("error");
      const errDesc = searchParams.get("error_description");
      if (err) {
        toast.error(errDesc || err || "OAuth error");
        clearOAuthSessionStorage();
        router.replace("/");
        return;
      }

      const code = searchParams.get("code");
      const state = searchParams.get("state");
      if (!code || !state) {
        toast.error("Missing authorization code or state");
        router.replace("/");
        return;
      }

      const fileCfg = await loadPublicAppConfig();
      const envCfg = getEnvAppConfig();
      const oauth = resolveOAuth2Settings(fileCfg, envCfg);
      if (!oauth.enabled || !oauth.config) {
        toast.error("OAuth is not configured");
        clearOAuthSessionStorage();
        router.replace("/");
        return;
      }

      const expected = consumeOAuthState();
      if (!expected || expected !== state) {
        toast.error("Invalid OAuth state; try signing in again");
        clearOAuthSessionStorage();
        router.replace("/");
        return;
      }

      const redirect_uri = `${window.location.origin}${OAUTH_REDIRECT_PATH}`;
      let res: Response;
      try {
        res = await fetch("/api/oauth/token", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            code,
            redirect_uri,
            oauth_token_url: oauth.config.tokenUrl,
            client_id: oauth.config.clientId,
            ...(oauth.config.clientSecret
              ? { client_secret: oauth.config.clientSecret }
              : {}),
          }),
        });
      } catch {
        toast.error("Token request failed");
        clearOAuthSessionStorage();
        router.replace("/");
        return;
      }

      let data: TokenResponseJson & {
        error?: string;
        error_description?: string;
      };
      try {
        data = (await res.json()) as typeof data;
      } catch {
        toast.error("Invalid response from token API");
        clearOAuthSessionStorage();
        router.replace("/");
        return;
      }

      if (!res.ok) {
        toast.error(
          data.error_description || data.error || "Token exchange failed"
        );
        clearOAuthSessionStorage();
        router.replace("/");
        return;
      }

      try {
        persistSessionFromTokenResponse(oauth.config, data);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Failed to save session");
        clearOAuthSessionStorage();
        router.replace("/");
        return;
      }

      toast.success("Signed in");
      router.replace("/");
    })();
  }, [router, searchParams]);

  return (
    <div className="flex h-screen items-center justify-center">
      <p className="text-muted-foreground">Completing sign-in…</p>
    </div>
  );
}

export default function OAuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-screen items-center justify-center">
          <p className="text-muted-foreground">Loading…</p>
        </div>
      }
    >
      <CallbackInner />
    </Suspense>
  );
}
