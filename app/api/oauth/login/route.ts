import { NextResponse } from "next/server";

export async function GET() {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  const redirectUri = process.env.GOOGLE_REDIRECT_URI?.trim();

  if (!clientId || !redirectUri) {
    return new NextResponse(
      `<!DOCTYPE html>
<html>
  <head><title>OAuth not configured</title></head>
  <body style="font-family: system-ui; max-width: 40rem; margin: 3rem auto; padding: 0 1rem; line-height: 1.5;">
    <h1>Google OAuth isn’t configured</h1>
    <p>Create <code>.env.local</code> in the project root with:</p>
    <pre style="background:#f4f4f5;padding:1rem;border-radius:8px;overflow:auto;">GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret
GOOGLE_REDIRECT_URI=http://localhost:3000/api/oauth/callback</pre>
    <p>Then restart <code>npm run dev</code>.</p>
    <p>In Google Cloud Console → APIs &amp; Services → Credentials, the OAuth client’s authorized redirect URI must match <code>GOOGLE_REDIRECT_URI</code> exactly. Also enable the <strong>Google Photos Picker API</strong>.</p>
  </body>
</html>`,
      {
        status: 500,
        headers: { "Content-Type": "text/html; charset=utf-8" },
      }
    );
  }

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "https://www.googleapis.com/auth/photospicker.mediaitems.readonly",
    access_type: "online",
    prompt: "consent",
  });

  return NextResponse.redirect(
    `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`
  );
}
