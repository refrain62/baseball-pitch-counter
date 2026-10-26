"use strict";

const CACHE_NAME =
  "pitch-counter-shell-v59";

const APP_SHELL = [
  "/counter/",

  "/counter/counter.css?v=53",
  "/counter/counter.js?v=49",

  "/counter/manifest.webmanifest",

  "/counter/icons/icon-192.png",
  "/counter/icons/icon-512.png",
  "/counter/icons/icon-maskable-512.png",
  "/counter/icons/apple-touch-icon.png",

  "/counter/images/base-first.svg",
  "/counter/images/base-third.svg",
  "/counter/images/bg-stadium-mobile.png",
  "/counter/images/bg-stadium-desktop.png",
  "/counter/images/baseball-count-button.png",
  "/counter/images/share-qr.png",
  "/assets/install-iphone-share.png",
  "/assets/install-iphone-addhome.png",
  "/assets/install-android-button.png",
  "/assets/install-android-menu.png",

  "/counter/audio/counter-click.ogg",
  "/counter/audio/counter-click.wav"
];

const APP_SHELL_URLS = new Set(
  APP_SHELL.map((path) =>
    new URL(path, self.location.origin).href
  )
);
const NAVIGATION_URLS = new Set([
  "/counter/",
  "/counter/?install=1"
].map((path) =>
  new URL(path, self.location.origin).href
));

function isAllowedRequest(url) {
  return url.origin === self.location.origin &&
    (APP_SHELL_URLS.has(url.href) || NAVIGATION_URLS.has(url.href));
}

function isSafeResponse(response) {
  if (
    !response ||
    !response.ok ||
    response.type === "opaque" ||
    response.type === "opaqueredirect"
  ) {
    return false;
  }

  try {
    const responseUrl = new URL(response.url);
    return responseUrl.origin === self.location.origin &&
      isAllowedRequest(responseUrl);
  } catch {
    return false;
  }
}

async function cacheResponse(request, response) {
  if (!isSafeResponse(response)) {
    return;
  }

  try {
    const requestUrl = new URL(
      typeof request === "string" ? request : request.url,
      self.location.origin
    );
    const responseUrl = new URL(response.url);

    if (requestUrl.pathname !== responseUrl.pathname) {
      return;
    }

    const cache = await caches.open(CACHE_NAME);
    await cache.put(request, response.clone());
  } catch (error) {
    console.warn("SW cache update failed", error);
  }
}

async function matchCached(request) {
  const cache = await caches.open(CACHE_NAME);
  return cache.match(request);
}

/* ==================================================
   INSTALL
================================================== */

self.addEventListener(
  "install",
  (event) => {
    event.waitUntil(
      caches
        .open(CACHE_NAME)
        .then((cache) =>
          cache.addAll(APP_SHELL)
        )
        .then(() =>
          self.skipWaiting()
        )
    );
  }
);

/* ==================================================
   ACTIVATE
================================================== */

self.addEventListener(
  "activate",
  (event) => {
    event.waitUntil(
      caches
        .keys()
        .then((keys) =>
          Promise.all(
            keys
              .filter(
                (key) =>
                  key.startsWith("pitch-counter-shell-") &&
                  key !== CACHE_NAME
              )
              .map(
                (key) =>
                  caches.delete(key)
              )
          )
        )
        .then(() =>
          self.clients.claim()
        )
    );
  }
);

/* ==================================================
   FETCH
================================================== */

self.addEventListener(
  "fetch",
  (event) => {
    const request =
      event.request;

    if (request.method !== "GET") {
      return;
    }

    const url =
      new URL(request.url);

    /*
      同一オリジンのアプリ本体と共有アセットだけを制御。
      インストール手順画像は LP と共有するため /assets/ に置く。
    */
    if (!isAllowedRequest(url)) {
      return;
    }

    /*
      HTML navigation:
      最新版を優先し、通信不能時だけ /counter/ のキャッシュを返す。
    */
    if (request.mode === "navigate") {
      if (url.pathname !== "/counter/") {
        return;
      }

      event.respondWith(
        fetch(request)
          .then((response) => {
            if (isSafeResponse(response)) {
              event.waitUntil(
                cacheResponse("/counter/", response)
              );
            }

            return response;
          })
          .catch(async () => {
            const cached =
              await matchCached(
                "/counter/"
              );

            if (cached) {
              return cached;
            }

            return new Response(
              "Offline",
              {
                status: 503,
                headers: {
                  "Content-Type":
                    "text/plain; charset=utf-8"
                }
              }
            );
          })
      );

      return;
    }

    /*
      CSS / JS / 画像 / 音声:
      Cache First。
      fetch 失敗を未処理の Promise reject にしない。
    */
    event.respondWith(
      matchCached(request)
        .then(
          async (cached) => {
            if (cached) {
              return cached;
            }

            try {
              const response =
                await fetch(request);

              if (isSafeResponse(response)) {
                event.waitUntil(
                  cacheResponse(request, response)
                );
              }

              return response;
            } catch (error) {
              console.warn(
                "SW fetch failed:",
                url.pathname
              );

              return new Response(
                "",
                {
                  status: 503
                }
              );
            }
          }
        )
    );
  }
);
