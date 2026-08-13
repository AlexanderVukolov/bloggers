const CACHE_NAME = "nsl-bloggers-github-v86-live-card-count";
const APP_ROOT = new URL("./", self.registration.scope).pathname;
const APP_SHELL = [
  APP_ROOT,
  `${APP_ROOT}index.html`, `${APP_ROOT}manifest.webmanifest`, `${APP_ROOT}app-icon.svg`, `${APP_ROOT}styles.css`,
  `${APP_ROOT}body-part-1.js`, `${APP_ROOT}body-part-2.js`, `${APP_ROOT}body-loader.js`,
  `${APP_ROOT}imported-data.js`, `${APP_ROOT}eugenia-stats.js`, `${APP_ROOT}reach-updates.js`,
  `${APP_ROOT}vendor-part-1.js`, `${APP_ROOT}vendor-part-2.js`, `${APP_ROOT}vendor-part-3.js`, `${APP_ROOT}vendor-loader.js`,
  `${APP_ROOT}app-part-1.js`, `${APP_ROOT}app-part-2.js`, `${APP_ROOT}app-part-3.js`, `${APP_ROOT}app-hotfix-v86.js`, `${APP_ROOT}app-loader.js`
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin || url.pathname.startsWith("/api/")) return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(`${APP_ROOT}index.html`, copy));
          return response;
        })
        .catch(() => caches.match(`${APP_ROOT}index.html`).then((cached) => cached || caches.match(APP_ROOT)))
    );
    return;
  }

  event.respondWith(
    fetch(request, { cache: "no-store" })
      .then((response) => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        }
        return response;
      })
      .catch(() => caches.match(request).then((cached) => cached || caches.match(request, { ignoreSearch: true })))
  );
});
