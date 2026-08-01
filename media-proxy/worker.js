/**
 * Cloudflare Worker — proxies Google Photos media downloads.
 *
 * Deploy:
 *   cd media-proxy && npx wrangler deploy
 *
 * Then set GitHub Actions secret / .env:
 *   NEXT_PUBLIC_MEDIA_PROXY_URL=https://one-second-a-day-proxy.<your-subdomain>.workers.dev
 */
async function handleRequest(request) {
  const cors = {
    "Access-Control-Allow-Origin": request.headers.get("Origin") || "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: cors });
  }

  if (request.method !== "GET") {
    return new Response("Method not allowed", { status: 405, headers: cors });
  }

  const url = new URL(request.url);
  const target = url.searchParams.get("url");
  const accessToken = request.headers
    .get("Authorization")
    ?.replace(/^Bearer\s+/i, "");

  if (!target || !accessToken) {
    return Response.json(
      { error: "Missing url or access token" },
      { status: 400, headers: cors }
    );
  }

  let parsed;
  try {
    parsed = new URL(target);
  } catch {
    return Response.json({ error: "Invalid url" }, { status: 400, headers: cors });
  }

  if (!parsed.hostname.endsWith(".googleusercontent.com")) {
    return Response.json({ error: "Host not allowed" }, { status: 400, headers: cors });
  }

  const upstream = await fetch(parsed.toString(), {
    headers: { Authorization: `Bearer ${accessToken}` },
    redirect: "follow",
  });

  if (!upstream.ok) {
    return Response.json(
      { error: "Failed to fetch media", status: upstream.status },
      { status: upstream.status, headers: cors }
    );
  }

  const headers = new Headers(cors);
  headers.set(
    "Content-Type",
    upstream.headers.get("Content-Type") || "application/octet-stream"
  );
  headers.set("Cache-Control", "private, max-age=3600");

  return new Response(upstream.body, { status: 200, headers });
}

export default {
  fetch: handleRequest,
};
