/* Lakfa ERP Progressive Web App Service Worker */
const CACHE_NAME = "lakfa-erp-cache-v15";
const ASSETS_TO_CACHE = [
  "index.html",
  "manager.html",
  "investor.html",
  "css/style.css",
  "js/firebase-config.js",
  "js/firebase-db.js",
  "js/company-profile.js",
  "js/auth.js",
  "js/role-guard.js",
  "js/manager.js",
  "js/investor.js",
  "js/utils.js",
  "manifest.json",
  "assets/logo.svg"
];

// Installation phase - Caching the shell files
self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log("[Service Worker] Caching application shell assets...");
      return cache.addAll(ASSETS_TO_CACHE);
    }).then(() => self.skipWaiting())
  );
});

// Activation phase - Cleaning old cache hashes
self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log("[Service Worker] Removing stale cache: ", key);
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetching assets - Network-First fallback to Cache
self.addEventListener("fetch", (e) => {
  e.respondWith(
    fetch(e.request)
      .then((networkResponse) => {
        // If successful, dynamically update cache
        if (networkResponse && networkResponse.status === 200 && e.request.method === "GET") {
          const cacheCopy = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(e.request, cacheCopy));
        }
        return networkResponse;
      })
      .catch(() => {
        // Fallback to offline local cache if network is unavailable
        console.warn("[Service Worker] Fetch failed, loading from offline cache...");
        return caches.match(e.request);
      })
  );
});
