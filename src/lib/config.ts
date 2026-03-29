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
  };
}

function trimOrUndefined(v: string | undefined): string | undefined {
  const t = v?.trim();
  return t || undefined;
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
