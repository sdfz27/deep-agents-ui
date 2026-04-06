import { NextResponse } from "next/server";

interface TokenRequestBody {
  code?: string;
  redirect_uri?: string;
  oauth_token_url?: string;
  client_id?: string;
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

  let upstream: Response;
  try {
    upstream = await fetch(oauth_token_url, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
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
