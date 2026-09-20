"use strict";

const SHARE_URL =
  "https://baseball-pitch-counter.refrain62.workers.dev/";

const SHARE_TITLE =
  "Pitch Counter | 野球の投球数カウンター";

const SHARE_TEXT =
  "登録不要で使える、1塁側・3塁側対応の野球用投球数カウンターです。";

const shareDialog =
  document.getElementById("lpShareDialog");

const copyStatus =
  document.getElementById("lpCopyShareStatus");

document
  .querySelectorAll("[data-open-share]")
  .forEach((button) => {
    button.addEventListener(
      "click",
      () => {
        copyStatus.textContent =
          "URLをクリップボードへコピー";

        shareDialog.showModal();
      }
    );
  });

function closeShareDialog() {
  shareDialog.close();
}

document
  .getElementById("lpShareClose")
  .addEventListener(
    "click",
    closeShareDialog
  );

document
  .getElementById("lpShareCloseBottom")
  .addEventListener(
    "click",
    closeShareDialog
  );

async function copyShareUrl() {
  try {
    if (
      navigator.clipboard &&
      typeof navigator.clipboard.writeText === "function"
    ) {
      await navigator.clipboard.writeText(
        SHARE_URL
      );
    } else {
      const textarea =
        document.createElement("textarea");

      textarea.value = SHARE_URL;
      textarea.setAttribute("readonly", "");
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";

      document.body.appendChild(textarea);
      textarea.select();

      const copied =
        document.execCommand("copy");

      textarea.remove();

      if (!copied) {
        throw new Error("Copy failed");
      }
    }

    copyStatus.textContent =
      "コピーしました";
  } catch (error) {
    console.warn(
      "Copy failed",
      error
    );

    copyStatus.textContent =
      "コピーできませんでした";
  }
}

document
  .getElementById("lpCopyShare")
  .addEventListener(
    "click",
    () => {
      void copyShareUrl();
    }
  );

document
  .getElementById("lpNativeShare")
  .addEventListener(
    "click",
    async () => {
      if (
        typeof navigator.share ===
        "function"
      ) {
        try {
          await navigator.share({
            title: SHARE_TITLE,
            text: SHARE_TEXT,
            url: SHARE_URL
          });
        } catch (error) {
          if (
            error &&
            error.name !== "AbortError"
          ) {
            console.warn(
              "Share failed",
              error
            );
          }
        }

        return;
      }

      await copyShareUrl();
    }
  );
