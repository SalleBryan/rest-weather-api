/* Cache only the published app shell. API responses and tokens never enter here. */
"use strict";
const VERSION = "weather-board-2026-11-04-5";
const ASSETS = [
  "./",
  "index.html",
  "workspace.html",
  "platform.css",
  "explore.css",
  "library.css",
  "workspace-base.css",
  "workspace.css",
  "palettes.js",
  "request-policy.js",
  "open-meteo.js",
  "location-names.js",
  "typeahead.js",
  "place-store.js",
  "explore.js",
  "library.js",
  "workspace.js",
  "history.js",
  "register-sw.js",
  "manifest.webmanifest",
  "icon.svg",
  "icon-192.png",
  "icon-512.png",
  "fonts/fonts.css",
  "fonts/google-sans-flex-latin.woff2",
  "fonts/google-sans-flex-latin-ext.woff2",
  "fonts/google-sans-code-latin.woff2",
  "fonts/google-sans-code-latin-ext.woff2",
  "fonts/material-symbols-rounded.woff2",
];
const urls = new Set(
  ASSETS.map((path) => new URL(path, self.registration.scope).href),
);
self.addEventListener("install", (event) =>
  event.waitUntil(caches.open(VERSION).then((cache) => cache.addAll(ASSETS))),
);
// Activate on the next navigation after old tabs close, so an editing session is not interrupted.
self.addEventListener("activate", (event) =>
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter(
              (key) => key.startsWith("weather-board-") && key !== VERSION,
            )
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  ),
);
self.addEventListener("fetch", (event) => {
  const request = event.request,
    url = new URL(request.url);
  if (
    request.method !== "GET" ||
    url.origin !== self.location.origin ||
    request.headers.has("Authorization")
  )
    return;
  const canonical = new URL(url.pathname, url.origin).href;
  if (!urls.has(canonical)) return;
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(() =>
        caches
          .open(VERSION)
          .then((cache) => cache.match(canonical))
          .then((response) => response || Response.error()),
      ),
    );
  } else
    event.respondWith(
      caches
        .open(VERSION)
        .then(
          async (cache) => (await cache.match(canonical)) || fetch(request),
        ),
    );
});
