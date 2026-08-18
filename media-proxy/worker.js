/**
 * Cloudflare Worker — proxies Google Photos media downloads.
 *
 * Deploy:
 *   cd media-proxy && npx wrangler deploy
 *
 * Then set GitHub Actions secret / .env:
 *   NEXT_PUBLIC_MEDIA_PROXY_URL=https://one-second-a-day-proxy.<your-subdomain>.workers.dev
 */

function corsHeaders(request) {
  const origin = request.headers.get("Origin") || "*";
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
    "Access-Control-Expose-Headers": "Content-Type, Content-Length",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

function json(request, body, status) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders(request),
      "Content-Type": "application/json",
    },
  });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function retryable(status) {
  return status === 404 || status === 408 || status === 425 || status === 429 || status >= 500;
}

async function fetchUpstream(url, accessToken) {
  let lastResponse = null;

  for (let attempt = 0; attempt < 4; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 90_000);

    try {
      const upstream = await fetch(url, {
        headers: { Authorization: `Bearer ${accessToken}` },
        redirect: "follow",
        signal: controller.signal,
      });

      if (upstream.ok) return upstream;
      lastResponse = upstream;

      if (!retryable(upstream.status) || attempt === 3) return upstream;
      await sleep(400 * 2 ** attempt);
    } catch (error) {
      if (attempt === 3) throw error;
      await sleep(400 * 2 ** attempt);
    } finally {
      clearTimeout(timeout);
    }
  }

  return lastResponse;
}

async function handleRequest(request) {
  const cors = corsHeaders(request);

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
    return json(request, { error: "Missing url or access token" }, 400);
  }

  let parsed;
  try {
    parsed = new URL(target);
  } catch {
    return json(request, { error: "Invalid url" }, 400);
  }

  if (!parsed.hostname.endsWith(".googleusercontent.com")) {
    return json(request, { error: "Host not allowed" }, 400);
  }

  let upstream;
  try {
    upstream = await fetchUpstream(parsed.toString(), accessToken);
  } catch {
    return json(
      request,
      { error: "Timed out fetching media from Google Photos" },
      504
    );
  }

  if (!upstream) {
    return json(request, { error: "Failed to fetch media" }, 502);
  }

  if (!upstream.ok) {
    return json(
      request,
      { error: "Failed to fetch media", status: upstream.status },
      upstream.status
    );
  }

  const headers = new Headers(cors);
  headers.set(
    "Content-Type",
    upstream.headers.get("Content-Type") || "application/octet-stream"
  );
  headers.set("Cache-Control", "private, max-age=3600");
  const length = upstream.headers.get("Content-Length");
  if (length) headers.set("Content-Length", length);

  return new Response(upstream.body, { status: 200, headers });
}

export default {
  fetch: handleRequest,
};
