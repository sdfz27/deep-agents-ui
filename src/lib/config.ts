export interface StandaloneConfig {
  deploymentUrl: string;
  assistantId: string;
  langsmithApiKey?: string;
}

/** Optional fields from `public/deep-agents-ui.config.json` or env. */
export interface PublicAppConfigFile {
  /** Shown in the header, tab title, and welcome screen. */
  title?: string;
  deploymentUrl?: string;
  assistantId?: string;
  langsmithApiKey?: string;
  /**
   * When false, hides the threads sidebar and the header control to open it.
   * Defaults to true when omitted. Override with `NEXT_PUBLIC_SHOW_THREADS_HISTORY`.
   */
  showThreadsHistory?: boolean;
  /** When true, require OAuth2 login and send user id to the LangGraph deployment. */
  oauth2Enabled?: boolean;
  oauthAuthorizationUrl?: string;
  oauthTokenUrl?: string;
  oauthClientId?: string;
  oauthScope?: string;
  oauthJwtSource?: "id_token" | "access_token";
  oauthUserIdClaim?: string;
  oauthUsernameClaim?: string;
  oauthUserIdHeader?: string;
  /** Optional. Prefer server env `OAUTH_CLIENT_SECRET` so the secret is not in the browser bundle. */
  oauthClientSecret?: string;
  /**
   * Max completed Q&A rounds per thread (one user message + assistant reply = 1 round).
   * Omitted or non-positive = no limit.
   */
  maxConversationRounds?: number;
  /** Shown near the composer when the round limit is reached. */
  conversationLimitMessage?: string;
  /**
   * Sent automatically when a new thread starts (no thread id). Not shown in the UI.
   * Omitted or empty = disabled.
   */
  threadInitializationMessage?: string;
}

/** Resolved OAuth2 settings when enabled and all required fields are present. */
export interface ResolvedOAuth2Config {
  authorizationUrl: string;
  tokenUrl: string;
  clientId: string;
  scope: string;
  jwtSource: "id_token" | "access_token";
  userIdClaim: string;
  usernameClaim: string;
  userIdHeader: string;
  /** Present when set via public config or `NEXT_PUBLIC_OAUTH_CLIENT_SECRET`. */
  clientSecret?: string;
}

export interface OAuth2Resolution {
  enabled: boolean;
  config: ResolvedOAuth2Config | null;
  /** Present when `oauth2Enabled` is true but required URLs/id are missing. */
  missingKeys: string[];
}

export const DEFAULT_APP_TITLE = "Deep Agent UI";

const CONFIG_KEY = "deep-agent-config";

const PUBLIC_CONFIG_PATH = "/deep-agents-ui.config.json";

export function getEnvAppConfig(): PublicAppConfigFile {
  return {
    title: trimOrUndefined(process.env.NEXT_PUBLIC_APP_TITLE),
    deploymentUrl: trimOrUndefined(process.env.NEXT_PUBLIC_DEPLOYMENT_URL),
    assistantId: trimOrUndefined(process.env.NEXT_PUBLIC_ASSISTANT_ID),
    langsmithApiKey: trimOrUndefined(process.env.NEXT_PUBLIC_LANGSMITH_API_KEY),
    showThreadsHistory: parseBoolEnv(
      process.env.NEXT_PUBLIC_SHOW_THREADS_HISTORY
    ),
    oauth2Enabled: parseBoolEnv(process.env.NEXT_PUBLIC_OAUTH2_ENABLED),
    oauthAuthorizationUrl: trimOrUndefined(
      process.env.NEXT_PUBLIC_OAUTH_AUTHORIZATION_URL
    ),
    oauthTokenUrl: trimOrUndefined(process.env.NEXT_PUBLIC_OAUTH_TOKEN_URL),
    oauthClientId: trimOrUndefined(process.env.NEXT_PUBLIC_OAUTH_CLIENT_ID),
    oauthScope: trimOrUndefined(process.env.NEXT_PUBLIC_OAUTH_SCOPE),
    oauthJwtSource: parseJwtSourceEnv(process.env.NEXT_PUBLIC_OAUTH_JWT_SOURCE),
    oauthUserIdClaim: trimOrUndefined(
      process.env.NEXT_PUBLIC_OAUTH_USER_ID_CLAIM
    ),
    oauthUsernameClaim: trimOrUndefined(
      process.env.NEXT_PUBLIC_OAUTH_USERNAME_CLAIM
    ),
    oauthUserIdHeader: trimOrUndefined(
      process.env.NEXT_PUBLIC_OAUTH_USER_ID_HEADER
    ),
    oauthClientSecret: trimOrUndefined(
      process.env.NEXT_PUBLIC_OAUTH_CLIENT_SECRET
    ),
    maxConversationRounds: parsePositiveIntEnv(
      process.env.NEXT_PUBLIC_MAX_CONVERSATION_ROUNDS
    ),
    conversationLimitMessage: trimOrUndefined(
      process.env.NEXT_PUBLIC_CONVERSATION_LIMIT_MESSAGE
    ),
    threadInitializationMessage: trimOrUndefined(
      process.env.NEXT_PUBLIC_THREAD_INITIALIZATION_MESSAGE
    ),
  };
}

function parseJwtSourceEnv(
  v: string | undefined
): "id_token" | "access_token" | undefined {
  const t = v?.trim().toLowerCase();
  if (t === "id_token" || t === "access_token") return t;
  return undefined;
}

function trimOrUndefined(v: string | undefined): string | undefined {
  const t = v?.trim();
  return t || undefined;
}

function parseBoolEnv(v: string | undefined): boolean | undefined {
  const t = v?.trim().toLowerCase();
  if (t === "true" || t === "1") return true;
  if (t === "false" || t === "0") return false;
  return undefined;
}

function parsePositiveIntEnv(v: string | undefined): number | undefined {
  const t = v?.trim();
  if (!t) return undefined;
  const n = Number(t);
  if (!Number.isFinite(n) || n <= 0) return undefined;
  return Math.floor(n);
}

/**
 * Loads optional runtime config from the public folder (served as a static file).
 * Returns null if the file is missing or invalid.
 */
export async function loadPublicAppConfig(): Promise<PublicAppConfigFile | null> {
  if (typeof window === "undefined") return null;

  try {
    const res = await fetch(PUBLIC_CONFIG_PATH, { cache: "no-store" });
    if (!res.ok) return null;
    const data = (await res.json()) as unknown;
    if (!data || typeof data !== "object") return null;
    return data as PublicAppConfigFile;
  } catch {
    return null;
  }
}

/**
 * Merges file and env deployment settings (env fills gaps; non-empty file fields win).
 */
export function mergeDeploymentConfig(
  file: PublicAppConfigFile | null,
  env: PublicAppConfigFile
): StandaloneConfig | null {
  const deploymentUrl = (
    file?.deploymentUrl ||
    env.deploymentUrl ||
    ""
  ).trim();
  const assistantId = (file?.assistantId || env.assistantId || "").trim();
  const langsmithApiKey =
    trimOrUndefined(file?.langsmithApiKey) ??
    trimOrUndefined(env.langsmithApiKey);

  if (!deploymentUrl || !assistantId) return null;

  return {
    deploymentUrl,
    assistantId,
    ...(langsmithApiKey ? { langsmithApiKey } : {}),
  };
}

export function resolveAppTitle(
  file: PublicAppConfigFile | null,
  env: PublicAppConfigFile
): string {
  const t = trimOrUndefined(file?.title) ?? trimOrUndefined(env.title);
  return t ?? DEFAULT_APP_TITLE;
}

export function resolveShowThreadsHistory(
  file: PublicAppConfigFile | null,
  env: PublicAppConfigFile
): boolean {
  if (file?.showThreadsHistory !== undefined) {
    return file.showThreadsHistory;
  }
  if (env.showThreadsHistory !== undefined) {
    return env.showThreadsHistory;
  }
  return true;
}

const DEFAULT_CONVERSATION_LIMIT_MESSAGE =
  "This conversation has reached the maximum number of exchanges for this thread.";

/**
 * Max conversation rounds; undefined means no limit.
 * File wins when set to a positive integer.
 */
export function resolveMaxConversationRounds(
  file: PublicAppConfigFile | null,
  env: PublicAppConfigFile
): number | undefined {
  const fromFile = file?.maxConversationRounds;
  if (typeof fromFile === "number" && Number.isFinite(fromFile) && fromFile > 0) {
    return Math.floor(fromFile);
  }
  const fromEnv = env.maxConversationRounds;
  if (typeof fromEnv === "number" && Number.isFinite(fromEnv) && fromEnv > 0) {
    return Math.floor(fromEnv);
  }
  return undefined;
}

export function resolveConversationLimitMessage(
  file: PublicAppConfigFile | null,
  env: PublicAppConfigFile
): string {
  const custom =
    trimOrUndefined(file?.conversationLimitMessage) ??
    trimOrUndefined(env.conversationLimitMessage);
  return custom ?? DEFAULT_CONVERSATION_LIMIT_MESSAGE;
}

/** Text sent on new thread; empty string = off. File wins when non-empty. */
export function resolveThreadInitializationMessage(
  file: PublicAppConfigFile | null,
  env: PublicAppConfigFile
): string {
  const f = trimOrUndefined(file?.threadInitializationMessage);
  if (f) return f;
  return trimOrUndefined(env.threadInitializationMessage) ?? "";
}

function pickNonEmptyString(
  file: string | undefined,
  env: string | undefined
): string {
  const f = trimOrUndefined(file);
  if (f) return f;
  return trimOrUndefined(env) ?? "";
}

/**
 * Merges OAuth2 flags and URLs from public JSON (wins when set) and env.
 */
export function resolveOAuth2Settings(
  file: PublicAppConfigFile | null,
  env: PublicAppConfigFile
): OAuth2Resolution {
  let enabled = false;
  if (file?.oauth2Enabled !== undefined) {
    enabled = file.oauth2Enabled;
  } else if (env.oauth2Enabled !== undefined) {
    enabled = env.oauth2Enabled;
  }

  if (!enabled) {
    return { enabled: false, config: null, missingKeys: [] };
  }

  const missingKeys: string[] = [];
  const authorizationUrl = pickNonEmptyString(
    file?.oauthAuthorizationUrl,
    env.oauthAuthorizationUrl
  );
  const tokenUrl = pickNonEmptyString(file?.oauthTokenUrl, env.oauthTokenUrl);
  const clientId = pickNonEmptyString(file?.oauthClientId, env.oauthClientId);
  if (!authorizationUrl) missingKeys.push("oauthAuthorizationUrl");
  if (!tokenUrl) missingKeys.push("oauthTokenUrl");
  if (!clientId) missingKeys.push("oauthClientId");

  const scope =
    pickNonEmptyString(file?.oauthScope, env.oauthScope) ||
    "openid profile email";
  const jwtSourceRaw =
    file?.oauthJwtSource !== undefined
      ? file.oauthJwtSource
      : env.oauthJwtSource;
  const jwtSource: "id_token" | "access_token" =
    jwtSourceRaw === "access_token" ? "access_token" : "id_token";
  const userIdClaim =
    pickNonEmptyString(file?.oauthUserIdClaim, env.oauthUserIdClaim) || "sub";
  const usernameClaim =
    pickNonEmptyString(file?.oauthUsernameClaim, env.oauthUsernameClaim) ||
    "name";
  const userIdHeader =
    pickNonEmptyString(file?.oauthUserIdHeader, env.oauthUserIdHeader) ||
    "X-User-Id";
  const clientSecret = pickNonEmptyString(
    file?.oauthClientSecret,
    env.oauthClientSecret
  );

  if (missingKeys.length > 0) {
    return { enabled: true, config: null, missingKeys };
  }

  return {
    enabled: true,
    config: {
      authorizationUrl,
      tokenUrl,
      clientId,
      scope,
      jwtSource,
      userIdClaim,
      usernameClaim,
      userIdHeader,
      ...(clientSecret ? { clientSecret } : {}),
    },
    missingKeys: [],
  };
}

export function getConfig(): StandaloneConfig | null {
  if (typeof window === "undefined") return null;

  const stored = localStorage.getItem(CONFIG_KEY);
  if (!stored) return null;

  try {
    return JSON.parse(stored);
  } catch {
    return null;
  }
}

export function saveConfig(config: StandaloneConfig): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
}
