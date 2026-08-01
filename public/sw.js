/* Media proxy for static hosting (GitHub Pages).
 * Intercepts same-origin /media-proxy requests and fetches Google media
 * with the Authorization header — bypasses browser CORS on googleusercontent.
 */
self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (!url.pathname.endsWith("/media-proxy")) return;

  event.respondWith(proxyMedia(event.request, url));
});

async function proxyMedia(request, url) {
  const target = url.searchParams.get("url");
  if (!target) {
    return new Response("Missing url", { status: 400 });
  }

  const auth = request.headers.get("Authorization") || "";
  const res = await fetch(target, {
    headers: auth ? { Authorization: auth } : {},
  });

  if (!res.ok) {
    return new Response(`Upstream ${res.status}`, { status: res.status });
  }

  const headers = new Headers();
  const contentType = res.headers.get("Content-Type");
  if (contentType) headers.set("Content-Type", contentType);
  headers.set("Cache-Control", "private, max-age=3600");

  return new Response(res.body, { status: 200, headers });
}
