const CACHE_NAME = "buildcontrol-v3"

const FILES_TO_CACHE = [
  "./",
  "./index.html",
  "./style.css",
  "./script.js",
  "./manifest.json",
  "./icons/icon-192.png",
  "./icons/icon-512.png"
]

// =============================
// INSTALAR
// =============================
self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(FILES_TO_CACHE)
    })
  )
  self.skipWaiting()
})

// =============================
// ATIVAR (limpa cache antigo)
// =============================
self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.map(key => {
          if (key !== CACHE_NAME) {
            return caches.delete(key)
          }
        })
      )
    })
  )
  self.clients.claim()
})

// =============================
// FETCH (network first)
// =============================
self.addEventListener("fetch", event => {
  event.respondWith(
    fetch(event.request)
      .then(response => {
        // Atualiza o cache com a versão nova
        const responseClone = response.clone()
        caches.open(CACHE_NAME).then(cache => {
          cache.put(event.request, responseClone)
        })
        return response
      })
      .catch(() => {
        // Só usa cache se estiver offline
        return caches.match(event.request)
      })
  )
})