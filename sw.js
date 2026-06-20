// Minimal service worker: keep the HTML fresh despite GitHub Pages' max-age=600.
// GitHub Pages forces `cache-control: max-age=600` on index.html and we cannot
// change that header. So navigations fetch the document network-first with
// `cache: no-store`, which bypasses the HTTP cache and always pulls the latest
// index.html. That HTML then references the current ?v=<tag> assets, which keep
// caching normally — so only the small HTML re-downloads each visit.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));
self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.mode === "navigate") {
    event.respondWith(fetch(request, { cache: "no-store" }).catch(() => fetch(request)));
  }
  // All other requests fall through to the browser's default handling, so the
  // ?v=<tag> cache-busting on JS/CSS still works as before.
});
