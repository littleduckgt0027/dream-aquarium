const ROOT = new URL(self.registration.scope);
const CACHE = "dream-aquarium-v2:" + ROOT.pathname;
async function shell(response) {
  if (!response.ok) return response;
  const cache = await caches.open(CACHE);
  const html = await response.clone().text();
  const files = [
    ...html.matchAll(/(?:src|href)="([^" ]*\/assets\/[^" ]+)"/g),
  ].map((m) => new URL(m[1], ROOT).href);
  await cache.addAll(files);
  await cache.put(ROOT.href, response.clone());
  return response;
}
self.addEventListener("install", (event) =>
  event.waitUntil(
    fetch(ROOT, { cache: "reload" })
      .then(shell)
      .then(() => self.skipWaiting()),
  ),
);
self.addEventListener("activate", (event) =>
  event.waitUntil(self.clients.claim()),
);
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (
    event.request.method !== "GET" ||
    url.origin !== ROOT.origin ||
    !url.pathname.startsWith(ROOT.pathname) ||
    url.pathname.startsWith("/api/")
  )
    return;
  if (event.request.mode === "navigate")
    event.respondWith(
      fetch(event.request)
        .then((r) => shell(r).catch(() => r))
        .catch(() => caches.match(ROOT.href)),
    );
  else if (url.pathname.startsWith(ROOT.pathname + "assets/"))
    event.respondWith(
      caches.match(event.request).then((hit) => hit || fetch(event.request)),
    );
});
