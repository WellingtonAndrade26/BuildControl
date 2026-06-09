const CACHE_NAME = "buildcontrol-pwa-v3";

const ARQUIVOS_CACHE = [
  "./",
  "./index.html",
  "./login.html",
  "./style.css",
  "./script.js",
  "./login.js",
  "./manifest.json",
  "./imagens/icon-192.png",
  "./imagens/icon-512.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      for (const arquivo of ARQUIVOS_CACHE) {
        try {
          await cache.add(arquivo);
        } catch (error) {
          console.warn("Não foi possível cachear:", arquivo);
        }
      }
    })
  );

  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  );

  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const requestUrl = new URL(event.request.url);

  if (requestUrl.protocol !== "http:" && requestUrl.protocol !== "https:") {
    return;
  }

  if (requestUrl.origin !== self.location.origin) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cacheResponse) => {
      return cacheResponse || fetch(event.request);
    })
  );
});