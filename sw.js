"use strict";

const CACHE_PREFIX = "BliForest-";
const CACHE_NAME = CACHE_PREFIX + "BliForest-1.4.8-2026.07.22-22:42";

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
  "./icons/favicon/favicon.ico",
  "./icons/favicon/favicon-96x96.png",
  "./icons/favicon/apple-touch-icon.png",
  "./data/bkph.json",
  "./data/bkph-bundle.js",
  "./data/tvl-index.json",
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

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(CORE_FILES))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(
      keys
        .filter(key => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME)
        .map(key => caches.delete(key))
    );
    await self.clients.claim();
  })());
});

function normalizedCacheKey(request) {
  const url = new URL(request.url);
  url.searchParams.delete("refresh");
  return url.toString();
}

function cacheable(response) {
  return response && response.ok && (response.type === "basic" || response.type === "cors" || response.type === "default");
}

async function saveResponse(request, response) {
  if (!cacheable(response)) return response;
  const cache = await caches.open(CACHE_NAME);
  await cache.put(normalizedCacheKey(request), response.clone());
  return response;
}

async function networkFirst(request, fallbackUrl) {
  try {
    const response = await fetch(request);
    return await saveResponse(request, response);
  } catch (error) {
    const cached = await caches.match(normalizedCacheKey(request));
    if (cached) return cached;
    if (fallbackUrl) {
      const fallback = await caches.match(fallbackUrl);
      if (fallback) return fallback;
    }
    throw error;
  }
}

async function cacheFirstWithRefresh(request) {
  const key = normalizedCacheKey(request);
  const cached = await caches.match(key);
  const update = fetch(request)
    .then(response => saveResponse(request, response))
    .catch(() => null);

  if (cached) {
    update.catch(() => null);
    return cached;
  }

  const response = await update;
  if (response) return response;
  throw new Error("Sumber tidak tersedia saat offline.");
}

self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  const isNavigation = request.mode === "navigate";
  const isImage = request.destination === "image";
  const isSameOrigin = url.origin === self.location.origin;
  const isGithubRaw = url.hostname === "raw.githubusercontent.com";

  if (url.pathname.startsWith("/docs/") || url.pathname.startsWith("docs/")) {
    event.respondWith(fetch(request));
    return;
  }

  if (isNavigation) {
    event.respondWith(networkFirst(request, "./index.html"));
    return;
  }

  if (isImage && isSameOrigin) {
    event.respondWith(cacheFirstWithRefresh(request));
    return;
  }

  if (isSameOrigin || isGithubRaw) {
    event.respondWith(networkFirst(request));
  }
});

self.addEventListener("message", event => {
  if (event.data && event.data.type === "SKIP_WAITING") self.skipWaiting();
});
