// GoToday's service worker: makes the site installable and gives a graceful offline page.
// Deliberately conservative — signed-in, admin and API traffic is never cached, listing pages
// are network-first so events are never stale, and only static files are cache-first.
const VERSION = "v1";
const STATIC_CACHE = `gotoday-static-${VERSION}`;
const PAGE_CACHE = `gotoday-pages-${VERSION}`;
const PRECACHE = ["/offline", "/icons/icon-192.png", "/icons/icon-512.png", "/manifest.webmanifest"];

// Pages that can hold personal data or trigger actions: hands off entirely.
const NEVER = [/^\/api\//, /^\/admin/, /^\/signin/, /^\/me(\/|$)/, /^\/manage(\/|$)/, /^\/cal(\/|$)/, /^\/create(\/|$)/, /^\/e(\/|$)/];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll(PRECACHE)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => ![STATIC_CACHE, PAGE_CACHE].includes(k)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const {request} = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (NEVER.some((re) => re.test(url.pathname))) return;

  // Pages: fresh from the network; a saved copy only when the network fails, then the offline page.
  if (request.mode === "navigate") {
    event.respondWith((async () => {
      try {
        const fresh = await fetch(request);
        const cache = await caches.open(PAGE_CACHE);
        cache.put(request, fresh.clone()).catch(() => {});
        return fresh;
      } catch {
        const cached = await caches.match(request);
        return cached || caches.match("/offline");
      }
    })());
    return;
  }

  // Build assets and icons never change under the same URL: serve from cache, fill on first use.
  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/") || url.pathname === "/manifest.webmanifest") {
    event.respondWith((async () => {
      const cached = await caches.match(request);
      if (cached) return cached;
      const fresh = await fetch(request);
      const cache = await caches.open(STATIC_CACHE);
      cache.put(request, fresh.clone()).catch(() => {});
      return fresh;
    })());
  }
});
