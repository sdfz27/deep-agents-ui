import { NextResponse } from "next/server";

interface TokenRequestBody {
  code?: string;
  redirect_uri?: string;
  oauth_token_url?: string;
  client_id?: string;
  /** Optional; server env `OAUTH_CLIENT_SECRET` overrides when set. */
  client_secret?: string;
}

export async function POST(req: Request) {
  let body: TokenRequestBody;
  try {
    body = (await req.json()) as TokenRequestBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const code = typeof body.code === "string" ? body.code : "";
  const redirect_uri =
    typeof body.redirect_uri === "string" ? body.redirect_uri : "";
  const oauth_token_url =
    typeof body.oauth_token_url === "string" ? body.oauth_token_url : "";
  const client_id = typeof body.client_id === "string" ? body.client_id : "";
  const client_secret_from_body =
    typeof body.client_secret === "string" ? body.client_secret.trim() : "";
  const client_secret =
    (typeof process.env.OAUTH_CLIENT_SECRET === "string"
      ? process.env.OAUTH_CLIENT_SECRET.trim()
      : "") || client_secret_from_body;

  if (!code || !redirect_uri || !oauth_token_url || !client_id) {
    return NextResponse.json(
      {
        error: "invalid_request",
        error_description:
          "Missing code, redirect_uri, oauth_token_url, or client_id",
      },
      { status: 400 }
    );
  }

  const params = new URLSearchParams();
  params.set("grant_type", "authorization_code");
  params.set("code", code);
  params.set("client_id", client_id);
  params.set("redirect_uri", redirect_uri);
  if (client_secret) {
    params.set("client_secret", client_secret);
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/x-www-form-urlencoded",
    Accept: "application/json",
  };
  if (client_secret) {
    const basic = Buffer.from(
      `${client_id}:${client_secret}`,
      "utf8"
    ).toString("base64");
    headers.Authorization = `Basic ${basic}`;
  }

  let upstream: Response;
  try {
    upstream = await fetch(oauth_token_url, {
      method: "POST",
      headers,
      body: params.toString(),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "fetch failed";
    return NextResponse.json(
      { error: "token_endpoint_unreachable", error_description: msg },
      { status: 502 }
    );
  }

  const text = await upstream.text();
  let json: unknown;
  try {
    json = JSON.parse(text) as unknown;
  } catch {
    return NextResponse.json(
      {
        error: "invalid_token_response",
        error_description: "Token endpoint returned non-JSON",
        status: upstream.status,
        body_preview: text.slice(0, 500),
      },
      { status: 502 }
    );
  }

  if (!upstream.ok) {
    return NextResponse.json(json, { status: upstream.status });
  }

  return NextResponse.json(json);
}
