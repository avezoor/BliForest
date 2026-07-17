const CACHE_NAME = "BliForest";
const CORE_FILES = [
  "./",
  "./index.html",
  "./css/base.css",
  "./css/layout.css",
  "./css/components.css",
  "./css/pages.css",
  "./css/responsive.css",
  "./js/config.js",
  "./js/utils.js",
  "./js/app.js",
  "./js/modules/storage.js",
  "./js/modules/tvl.js",
  "./js/modules/bkph.js",
  "./js/modules/components.js",
  "./js/modules/handlers.js",
  "./js/modules/pwa.js",
  "./manifest.webmanifest",
  "./icons/pwa/icon-192.png",
  "./icons/pwa/icon-512.png",
  "./icons/favicon/favicon.svg",
  "./data/bkph.json",
  "./data/bkph-bundle.js",
  "./data/tvl-index.json"
];

const TVL_FILES = [
  "./data/tvl/tvl_jati.json",
  "./data/tvl/tvl_sengon.json",
  "./data/tvl/tvl_mahoni.json",
  "./data/tvl/tvl_pinus.json",
  "./data/tvl/tvl_damar.json",
  "./data/tvl/tvl_maesosis.json",
  "./data/tvl/tvl_akasia_mangium.json",
  "./data/tvl/tvl_akasia_au.json",
  "./data/tvl/tvl_johar.json",
  "./data/tvl/tvl_lokes.json",
  "./data/tvl/tvl_eupcaliptus.json",
  "./data/tvl/tvl_mindi.json",
  "./data/tvl/tvl_flamboyan.json",
  "./data/tvl/tvl_gemilina.json",
  "./data/tvl/tvl_sonokeling.json"
];

const ALL_FILES = CORE_FILES.concat(TVL_FILES);

self.addEventListener("install", event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await cache.addAll(ALL_FILES);
  })());
  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;

  const url = new URL(event.request.url);
  const isTvlJson = url.pathname.includes("/data/tvl/") && url.pathname.endsWith(".json");

  // TVL JSON: cache-first saat offline, network-fresh saat online (biar selalu update saat online)
  // Tidak perlu cache busting manual karena fetchJson sudah handle ?refresh=...
  if (isTvlJson) {
    event.respondWith(
      fetch(event.request).then(response => {
        if (response && response.status === 200) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
        }
        return response;
      }).catch(() => {
        // Offline: serve dari cache
        return caches.match(event.request);
      })
    );
    return;
  }

  // BKPH JSON: cache-first (jarang berubah)
  const isBkphJson = url.pathname.includes("/data/") && url.pathname.endsWith(".json");
  if (isBkphJson) {
    event.respondWith(
      caches.match(event.request).then(cached => {
        if (cached) return cached;
        return fetch(event.request).then(response => {
          if (response && response.status === 200) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
          }
          return response;
        });
      })
    );
    return;
  }

  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put("./index.html", copy));
          return response;
        })
        .catch(() => caches.match("./index.html"))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(response => {
        if (!response || response.status !== 200 || response.type === "opaque") return response;
        const copy = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
        return response;
      });
    })
  );
});
