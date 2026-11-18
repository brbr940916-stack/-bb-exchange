const CACHE_NAME = "bb-exchange-shell-v1";
const SHELL_FILES = ["/", "/index.html", "/styles.css", "/app.js", "/site.webmanifest", "/icon.svg"];

self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(SHELL_FILES)));
  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(key => key.startsWith("bb-exchange-shell-") && key !== CACHE_NAME)
        .map(key => caches.delete(key))
    ))
  );
  self.clients.claim();
});

self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  const isShellAsset = ["/", "/index.html", "/styles.css", "/app.js", "/site.webmanifest", "/icon.svg"].includes(url.pathname);
  if (!isShellAsset && request.mode !== "navigate") return;

  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    let response;
    try {
      response = await fetch(request);
    } catch (_error) {
      const cached = await cache.match(request) || (request.mode === "navigate" ? await cache.match("/index.html") : null);
      return cached || new Response("오프라인 상태입니다. 네트워크 연결 후 다시 시도해 주세요.", {
        status: 503, headers: { "Content-Type": "text/plain; charset=utf-8" }
      });
    }
    if (response.ok) {
      event.waitUntil(cache.put(request, response.clone()).catch(() => {}));
      if (request.mode === "navigate") {
        event.waitUntil(cache.put("/index.html", response.clone()).catch(() => {}));
      }
    }
    return response;
  })());
});
