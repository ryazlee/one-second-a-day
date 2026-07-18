import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const oauthError = searchParams.get("error");

  if (oauthError) {
    return new NextResponse(
      `<!DOCTYPE html><html><body style="font-family:system-ui;padding:2rem;">
        <h1>Google sign-in failed</h1>
        <p>${oauthError}</p>
        <p>${searchParams.get("error_description") ?? ""}</p>
        <script>setTimeout(() => window.close(), 4000)</script>
      </body></html>`,
      { status: 400, headers: { "Content-Type": "text/html; charset=utf-8" } }
    );
  }

  if (!code) {
    return NextResponse.json({ error: "No code" }, { status: 400 });
  }

  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
  const redirectUri = process.env.GOOGLE_REDIRECT_URI?.trim();

  if (!clientId || !clientSecret || !redirectUri) {
    return NextResponse.json(
      { error: "Missing GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET / GOOGLE_REDIRECT_URI" },
      { status: 500 }
    );
  }

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });

  const tokenData = await tokenRes.json();

  if (!tokenRes.ok || !tokenData.access_token) {
    return new NextResponse(
      `<!DOCTYPE html><html><body style="font-family:system-ui;padding:2rem;">
        <h1>Token exchange failed</h1>
        <pre>${JSON.stringify(tokenData, null, 2)}</pre>
      </body></html>`,
      { status: 400, headers: { "Content-Type": "text/html; charset=utf-8" } }
    );
  }

  const html = `<!DOCTYPE html>
<html>
  <body>
    <script>
      if (window.opener) {
        window.opener.postMessage(
          {
            type: "GOOGLE_OAUTH_SUCCESS",
            accessToken: ${JSON.stringify(tokenData.access_token)},
            expiresIn: ${JSON.stringify(tokenData.expires_in ?? null)}
          },
          window.location.origin
        );
        window.close();
      }
    </script>
    <p style="font-family:system-ui">Signed in — you can close this window.</p>
  </body>
</html>`;

  return new NextResponse(html, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
