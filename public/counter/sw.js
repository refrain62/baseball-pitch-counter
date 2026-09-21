"use strict";

const CACHE_NAME =
  "pitch-counter-shell-v36";

const APP_SHELL = [
  "/counter/",

  "/counter/counter.css",
  "/counter/counter.js",

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
    if (
      url.origin !== self.location.origin ||
      (!url.pathname.startsWith("/counter/") &&
        !url.pathname.startsWith("/assets/"))
    ) {
      return;
    }

    /*
      HTML navigation:
      最新版を優先し、通信不能時だけ /counter/ のキャッシュを返す。
    */
    if (request.mode === "navigate") {
      event.respondWith(
        fetch(request)
          .then((response) => {
            if (response.ok) {
              const copy =
                response.clone();

              event.waitUntil(
                caches
                  .open(CACHE_NAME)
                  .then((cache) =>
                    cache.put(
                      "/counter/",
                      copy
                    )
                  )
              );
            }

            return response;
          })
          .catch(async () => {
            const cached =
              await caches.match(
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
      caches
        .match(request)
        .then(
          async (cached) => {
            if (cached) {
              return cached;
            }

            try {
              const response =
                await fetch(request);

              if (response.ok) {
                const copy =
                  response.clone();

                event.waitUntil(
                  caches
                    .open(CACHE_NAME)
                    .then((cache) =>
                      cache.put(
                        request,
                        copy
                      )
                    )
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
