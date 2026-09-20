"use strict";

const STORAGE_KEY = "pitch-counter-state-v3";
const $ = (id) => document.getElementById(id);

let state = {
  A: 0,
  B: 0,
  nameA: "1塁側",
  nameB: "3塁側"
};

try {
  const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));

  if (saved && typeof saved === "object") {
    state = { ...state, ...saved };
  }
} catch (error) {
  console.warn("Saved state could not be loaded", error);
}

/* ==================================================
   保存
   連打中は毎回 localStorage に同期書き込みせず、
   200ms 後にまとめて保存する。
================================================== */

let saveTimer = null;
let saveDirty = false;

function scheduleSave() {
  saveDirty = true;

  if (saveTimer !== null) {
    window.clearTimeout(saveTimer);
  }

  saveTimer = window.setTimeout(() => {
    flushSave();
  }, 200);
}

function flushSave() {
  if (!saveDirty) {
    return;
  }

  saveDirty = false;

  if (saveTimer !== null) {
    window.clearTimeout(saveTimer);
    saveTimer = null;
  }

  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(state)
    );
  } catch (error) {
    console.warn("State could not be saved", error);
  }
}

window.addEventListener("pagehide", flushSave);

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") {
    flushSave();
  }
});

/* ==================================================
   カウンター表示
   DOM は最初に1回だけ作り、その後は文字だけ更新。
================================================== */

function initDigits(targetId) {
  const mount = $(targetId);

  if (!mount || mount.children.length === 3) {
    return;
  }

  mount.replaceChildren();

  for (let i = 0; i < 3; i += 1) {
    const span = document.createElement("span");
    span.className = "digit";
    span.textContent = "0";
    mount.appendChild(span);
  }
}

function updateDigits(side) {
  const mount = $("count" + side);

  if (!mount) {
    return;
  }

  const value = Math.max(
    0,
    Math.min(999, Number(state[side]) || 0)
  );

  const text = String(value).padStart(3, "0");
  const digits = mount.children;

  for (let i = 0; i < 3; i += 1) {
    if (digits[i] && digits[i].textContent !== text[i]) {
      digits[i].textContent = text[i];
    }
  }

  const name =
    side === "A"
      ? state.nameA
      : state.nameB;

  mount.setAttribute(
    "aria-label",
    `${name} ${value}球`
  );
}

function renderNames() {
  $("nameA").value = state.nameA;
  $("nameB").value = state.nameB;
}

function renderAll() {
  updateDigits("A");
  updateDigits("B");
  renderNames();
}

/* ==================================================
   バイブ
================================================== */

function vibrate(pattern) {
  if (typeof navigator.vibrate === "function") {
    navigator.vibrate(pattern);
  }
}

/* ==================================================
   AudioContext
================================================== */

let audioContext = null;

function getAudioContext() {
  const AudioContextClass =
    window.AudioContext ||
    window.webkitAudioContext;

  if (!AudioContextClass) {
    return null;
  }

  if (!audioContext) {
    audioContext = new AudioContextClass();
  }

  if (audioContext.state === "suspended") {
    void audioContext.resume();
  }

  return audioContext;
}

/* ==================================================
   実機クリック音
   - OGG を優先
   - 失敗時は WAV
   - fetch / decode は必ず一度だけ
   - 再生時は AudioBuffer から BufferSource を生成
================================================== */

let counterClickBuffer = null;
let counterClickLoadPromise = null;

async function fetchAndDecodeAudio(ctx, url) {
  const response = await fetch(url, {
    cache: "force-cache"
  });

  if (!response.ok) {
    throw new Error(
      `Audio fetch failed (${response.status}): ${url}`
    );
  }

  const arrayBuffer =
    await response.arrayBuffer();

  return ctx.decodeAudioData(arrayBuffer);
}

function loadCounterClickSound() {
  if (counterClickBuffer) {
    return Promise.resolve(counterClickBuffer);
  }

  if (counterClickLoadPromise) {
    return counterClickLoadPromise;
  }

  const ctx = getAudioContext();

  if (!ctx) {
    return Promise.resolve(null);
  }

  counterClickLoadPromise = (async () => {
    try {
      counterClickBuffer =
        await fetchAndDecodeAudio(
          ctx,
          "/counter/audio/counter-click.ogg"
        );

      return counterClickBuffer;
    } catch (oggError) {
      try {
        counterClickBuffer =
          await fetchAndDecodeAudio(
            ctx,
            "/counter/audio/counter-click.wav"
          );

        return counterClickBuffer;
      } catch (wavError) {
        console.warn(
          "Counter click sound could not be loaded",
          {
            oggError,
            wavError
          }
        );

        return null;
      }
    }
  })();

  return counterClickLoadPromise;
}

function playCounterClick() {
  const ctx = getAudioContext();

  if (!ctx) {
    return;
  }

  if (!counterClickBuffer) {
    /*
      読み込み完了を待ってカウント処理を止めない。
      ロード自体は Promise 1本だけなので、連打しても多重 fetch しない。
    */
    void loadCounterClickSound();
    return;
  }

  const source = ctx.createBufferSource();

  source.buffer = counterClickBuffer;
  source.connect(ctx.destination);
  source.start();
}

/* ==================================================
   Undo 音
   元の低い電子音を維持。
================================================== */

function undoClick() {
  const ctx = getAudioContext();

  if (!ctx) {
    return;
  }

  const now = ctx.currentTime;

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = "sine";

  osc.frequency.setValueAtTime(
    450,
    now
  );

  osc.frequency.exponentialRampToValueAtTime(
    220,
    now + 0.05
  );

  gain.gain.setValueAtTime(
    0.14,
    now
  );

  gain.gain.exponentialRampToValueAtTime(
    0.001,
    now + 0.06
  );

  osc.connect(gain).connect(ctx.destination);
  osc.start(now);
  osc.stop(now + 0.065);
}

/* ==================================================
   軽量アニメーション
   offsetWidth による強制リフローを使わない。
================================================== */

const activeAnimations =
  new WeakMap();

const prefersReducedMotion =
  window.matchMedia(
    "(prefers-reduced-motion: reduce)"
  );

function runAnimation(element, keyframes, options) {
  if (!element || prefersReducedMotion.matches) {
    return;
  }

  const previous =
    activeAnimations.get(element);

  if (previous) {
    previous.cancel();
  }

  const animation =
    element.animate(
      keyframes,
      options
    );

  activeAnimations.set(
    element,
    animation
  );

  animation.addEventListener(
    "finish",
    () => {
      if (
        activeAnimations.get(element) ===
        animation
      ) {
        activeAnimations.delete(element);
      }
    },
    { once: true }
  );

  animation.addEventListener(
    "cancel",
    () => {
      if (
        activeAnimations.get(element) ===
        animation
      ) {
        activeAnimations.delete(element);
      }
    },
    { once: true }
  );
}

function animateCounter(side) {
  runAnimation(
    $("count" + side),
    [
      {
        transform: "scale(1)",
        filter: "brightness(1)"
      },
      {
        transform: "scale(1.022)",
        filter: "brightness(1.14)"
      },
      {
        transform: "scale(1)",
        filter: "brightness(1)"
      }
    ],
    {
      duration: 120,
      easing: "ease-out"
    }
  );
}

function animateButton(button) {
  runAnimation(
    button,
    [
      {
        filter: "brightness(1)"
      },
      {
        filter: "brightness(.88)"
      },
      {
        filter: "brightness(1)"
      }
    ],
    {
      duration: 100,
      easing: "ease-out"
    }
  );
}

/* ==================================================
   +1
================================================== */

document
  .querySelectorAll("[data-plus]")
  .forEach((button) => {
    button.addEventListener(
      "click",
      () => {
        const side =
          button.dataset.plus;

        if (state[side] >= 999) {
          return;
        }

        /*
          最優先はカウンター更新。
          音や保存を待たない。
        */
        state[side] += 1;

        updateDigits(side);
        scheduleSave();

        playCounterClick();

        /*
          連打時に長いバイブパターンを積み上げない。
        */
        vibrate(30);

        animateCounter(side);
        animateButton(button);
      }
    );
  });

/* ==================================================
   Undo
================================================== */

document
  .querySelectorAll("[data-undo]")
  .forEach((button) => {
    button.addEventListener(
      "click",
      () => {
        const side =
          button.dataset.undo;

        if (state[side] <= 0) {
          return;
        }

        state[side] -= 1;

        updateDigits(side);
        scheduleSave();

        undoClick();
        vibrate(18);

        animateCounter(side);
      }
    );
  });

/* ==================================================
   チーム名
================================================== */

["A", "B"].forEach((side) => {
  $("name" + side).addEventListener(
    "change",
    (event) => {
      const fallback =
        side === "A"
          ? "1塁側"
          : "3塁側";

      const value =
        event.target.value
          .trim()
          .slice(0, 12);

      state["name" + side] =
        value || fallback;

      event.target.value =
        state["name" + side];

      updateDigits(side);

      /*
        名前変更は頻繁な操作ではないので
        すぐ保存してよい。
      */
      saveDirty = true;
      flushSave();
    }
  );
});

/* ==================================================
   リセット
================================================== */

const resetDialog =
  $("resetDialog");

let resetTarget = null;

document
  .querySelectorAll("[data-reset]")
  .forEach((button) => {
    button.addEventListener(
      "click",
      () => {
        resetTarget =
          button.dataset.reset;

        const name =
          resetTarget === "A"
            ? state.nameA
            : state.nameB;

        $("resetName").textContent =
          `「${name}」`;

        resetDialog.showModal();
      }
    );
  });

$("cancelReset").addEventListener(
  "click",
  () => {
    resetTarget = null;
    resetDialog.close();
  }
);

$("confirmReset").addEventListener(
  "click",
  () => {
    if (resetTarget) {
      state[resetTarget] = 0;

      updateDigits(resetTarget);

      saveDirty = true;
      flushSave();

      vibrate(35);
      animateCounter(resetTarget);
    }

    resetTarget = null;
    resetDialog.close();
  }
);

/* ==================================================
   すべてリセット
   球数とチーム名を初期状態へ戻す
================================================== */

const allResetDialog =
  $("allResetDialog");

$("allResetButton").addEventListener(
  "click",
  () => {
    allResetDialog.showModal();
  }
);

$("cancelAllReset").addEventListener(
  "click",
  () => {
    allResetDialog.close();
  }
);

$("confirmAllReset").addEventListener(
  "click",
  () => {
    state.A = 0;
    state.B = 0;
    state.nameA = "1塁側";
    state.nameB = "3塁側";

    $("nameA").value =
      state.nameA;

    $("nameB").value =
      state.nameB;

    updateDigits("A");
    updateDigits("B");

    saveDirty = true;
    flushSave();

    vibrate([35, 30, 35]);

    animateCounter("A");
    animateCounter("B");

    allResetDialog.close();
  }
);

/* ==================================================
   PWA install
================================================== */

const installButton =
  $("installButton");

const installButtonText =
  $("installButtonText");

const installDialog =
  $("installDialog");

const installHelp =
  $("installHelp");

const installTitle =
  $("installTitle");

let deferredInstallPrompt = null;

const installParams =
  new URLSearchParams(
    window.location.search
  );

const wantsInstall =
  installParams.get("install") === "1";

const isStandalone =
  window.matchMedia(
    "(display-mode: standalone)"
  ).matches ||
  window.navigator.standalone === true;

const isIOS =
  /iphone|ipad|ipod/i.test(
    navigator.userAgent
  );

function showInstallButton() {
  /*
    LPの「今すぐ使う」から来た場合は
    インストールUIを出さない。

    /counter/?install=1 の時だけ表示する。
  */
  if (isStandalone || !wantsInstall) {
    installButton.hidden = true;
    return;
  }

  installButtonText.textContent =
    isIOS
      ? "このカウンターをホーム画面に追加"
      : "このカウンターをインストール";

  installButton.hidden = false;
}

showInstallButton();

window.addEventListener(
  "beforeinstallprompt",
  (event) => {
    event.preventDefault();

    deferredInstallPrompt =
      event;

    if (wantsInstall) {
      showInstallButton();
    }
  }
);

installButton.addEventListener(
  "click",
  async () => {
    if (deferredInstallPrompt) {
      deferredInstallPrompt.prompt();

      await deferredInstallPrompt.userChoice;

      deferredInstallPrompt = null;
      installButton.hidden = true;

      return;
    }

    installTitle.textContent =
      "このカウンターをアプリとして使う";

    installHelp.textContent =
      isIOS
        ? "Safariの共有ボタン →「ホーム画面に追加」→ 確認画面右上の「追加」（iPhone標準ボタン）の順に操作してください。"
        : "ブラウザのメニューから「このカウンターをインストール」または「ホーム画面に追加」を選んでください。";

    installDialog.showModal();
  }
);

$("closeInstall").addEventListener(
  "click",
  () => {
    installDialog.close();
  }
);

window.addEventListener(
  "appinstalled",
  () => {
    installButton.hidden = true;
  }
);


/* ==================================================
   Knowledge / Share
================================================== */

const SHARE_URL =
  "https://baseball-pitch-counter.refrain62.workers.dev/";

const SHARE_TITLE =
  "投球数カウンター";

const SHARE_TEXT =
  "1塁側・3塁側を同時に数えられる、シンプルな野球用の投球数カウンターです。";

const knowledgeDialog =
  $("knowledgeDialog");

const shareDialog =
  $("shareDialog");

$("knowledgeButton").addEventListener(
  "click",
  () => {
    knowledgeDialog.showModal();
  }
);

function closeKnowledgeDialog() {
  knowledgeDialog.close();
}

$("closeKnowledge").addEventListener(
  "click",
  closeKnowledgeDialog
);

$("closeKnowledgeBottom").addEventListener(
  "click",
  closeKnowledgeDialog
);

$("shareButton").addEventListener(
  "click",
  () => {
    $("copyShareStatus").textContent =
      "URLをクリップボードへコピー";

    shareDialog.showModal();
  }
);

function closeShareDialog() {
  shareDialog.close();
}

$("closeShare").addEventListener(
  "click",
  closeShareDialog
);

$("closeShareBottom").addEventListener(
  "click",
  closeShareDialog
);

$("nativeShareButton").addEventListener(
  "click",
  async () => {
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({
          title: SHARE_TITLE,
          text: SHARE_TEXT,
          url: SHARE_URL
        });
      } catch (error) {
        /*
          ユーザーが共有シートを閉じた場合もここへ来る。
          カウンター操作には影響させない。
        */
        if (error && error.name !== "AbortError") {
          console.warn(
            "Share failed",
            error
          );
        }
      }

      return;
    }

    /*
      Web Share非対応ブラウザではコピーへフォールバック。
    */
    await copyShareUrl();
  }
);

async function copyShareUrl() {
  const status =
    $("copyShareStatus");

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
      textarea.setAttribute(
        "readonly",
        ""
      );
      textarea.style.position =
        "fixed";
      textarea.style.opacity =
        "0";

      document.body.appendChild(
        textarea
      );

      textarea.select();

      const copied =
        document.execCommand("copy");

      textarea.remove();

      if (!copied) {
        throw new Error(
          "Copy command failed"
        );
      }
    }

    status.textContent =
      "コピーしました";

    vibrate(18);
  } catch (error) {
    console.warn(
      "Copy failed",
      error
    );

    status.textContent =
      "コピーできませんでした";
  }
}

$("copyShareLink").addEventListener(
  "click",
  () => {
    void copyShareUrl();
  }
);

/* ==================================================
   Service Worker
================================================== */

if ("serviceWorker" in navigator) {
  window.addEventListener(
    "load",
    () => {
      navigator.serviceWorker
        .register(
          "/counter/sw.js",
          {
            scope: "/counter/"
          }
        )
        .catch((error) => {
          console.warn(
            "Service Worker registration failed",
            error
          );
        });
    }
  );
}

/* ==================================================
   初期化
================================================== */

initDigits("countA");
initDigits("countB");
renderAll();

/*
  初回ユーザー操作より前に AudioContext は開始できないため、
  pointerdown を受けたらロード開始。
  Promise は1本に固定される。
*/
document.addEventListener(
  "pointerdown",
  () => {
    void loadCounterClickSound();
  },
  {
    once: true,
    passive: true
  }
);
