"use strict";

const STORAGE_KEY = "pitch-counter-state-v1";
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

function save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function render() {
  $("countA").textContent = String(state.A);
  $("countB").textContent = String(state.B);
  $("nameA").value = state.nameA;
  $("nameB").value = state.nameB;
  save();
}

function vibrate(pattern) {
  if (typeof navigator.vibrate === "function") {
    navigator.vibrate(pattern);
  }
}

let audioContext = null;
function getAudioContext() {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return null;
  if (!audioContext) audioContext = new AudioContextClass();
  if (audioContext.state === "suspended") void audioContext.resume();
  return audioContext;
}

function strongClick() {
  const ctx = getAudioContext();
  if (!ctx) return;
  const now = ctx.currentTime;

  const osc1 = ctx.createOscillator();
  const gain1 = ctx.createGain();
  osc1.type = "square";
  osc1.frequency.setValueAtTime(1050, now);
  osc1.frequency.exponentialRampToValueAtTime(230, now + 0.045);
  gain1.gain.setValueAtTime(0.28, now);
  gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.055);
  osc1.connect(gain1).connect(ctx.destination);
  osc1.start(now);
  osc1.stop(now + 0.06);

  const osc2 = ctx.createOscillator();
  const gain2 = ctx.createGain();
  osc2.type = "sine";
  osc2.frequency.setValueAtTime(170, now);
  gain2.gain.setValueAtTime(0.17, now);
  gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.07);
  osc2.connect(gain2).connect(ctx.destination);
  osc2.start(now);
  osc2.stop(now + 0.075);
}

function undoClick() {
  const ctx = getAudioContext();
  if (!ctx) return;
  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "sine";
  osc.frequency.setValueAtTime(440, now);
  osc.frequency.exponentialRampToValueAtTime(210, now + 0.05);
  gain.gain.setValueAtTime(0.14, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
  osc.connect(gain).connect(ctx.destination);
  osc.start(now);
  osc.stop(now + 0.065);
}

function pulse(side) {
  const count = $("count" + side);
  count.classList.remove("pulse");
  void count.offsetWidth;
  count.classList.add("pulse");
  window.setTimeout(() => count.classList.remove("pulse"), 140);
}

function flash(button) {
  button.classList.remove("flash");
  void button.offsetWidth;
  button.classList.add("flash");
  window.setTimeout(() => button.classList.remove("flash"), 180);
}

document.querySelectorAll("[data-plus]").forEach((button) => {
  button.addEventListener("click", () => {
    const side = button.dataset.plus;
    state[side] += 1;
    strongClick();
    vibrate([40, 18, 40]);
    render();
    pulse(side);
    flash(button);
  });
});

document.querySelectorAll("[data-undo]").forEach((button) => {
  button.addEventListener("click", () => {
    const side = button.dataset.undo;
    if (state[side] <= 0) return;
    state[side] -= 1;
    undoClick();
    vibrate(20);
    render();
    pulse(side);
  });
});

["A", "B"].forEach((side) => {
  $("name" + side).addEventListener("change", (event) => {
    const fallback = side === "A" ? "1塁側" : "3塁側";
    const value = event.target.value.trim().slice(0, 12);
    state["name" + side] = value || fallback;
    render();
  });
});

const resetDialog = $("resetDialog");
let resetTarget = null;

document.querySelectorAll("[data-reset]").forEach((button) => {
  button.addEventListener("click", () => {
    resetTarget = button.dataset.reset;
    const name = resetTarget === "A" ? state.nameA : state.nameB;
    $("resetName").textContent = `「${name}」`;
    resetDialog.showModal();
  });
});

$("cancelReset").addEventListener("click", () => {
  resetTarget = null;
  resetDialog.close();
});

$("confirmReset").addEventListener("click", () => {
  if (resetTarget) {
    state[resetTarget] = 0;
    vibrate([55, 20, 55]);
    render();
    pulse(resetTarget);
  }
  resetTarget = null;
  resetDialog.close();
});

const installButton = $("installButton");
const installDialog = $("installDialog");
const installHelp = $("installHelp");
const installTitle = $("installTitle");
let deferredInstallPrompt = null;

const isStandalone = window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
const installIntent = new URLSearchParams(window.location.search).get("install") === "1";

if (!isStandalone && installIntent) {
  installButton.textContent = isIOS
    ? "このカウンターをホーム画面に追加"
    : "このカウンターをインストール";
  installButton.hidden = false;
  installButton.classList.add("install-focus");
}

if (!isStandalone && isIOS) {
  installButton.textContent = "このカウンターをホーム画面に追加";
  installButton.hidden = false;
}

window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  deferredInstallPrompt = event;
  if (!isStandalone) {
    installButton.textContent = "このカウンターをインストール";
    installButton.hidden = false;
  }
});

installButton.addEventListener("click", async () => {
  if (deferredInstallPrompt) {
    deferredInstallPrompt.prompt();
    await deferredInstallPrompt.userChoice;
    deferredInstallPrompt = null;
    installButton.hidden = true;
    return;
  }

  installTitle.textContent = "このカウンターをアプリとして使う";
  installHelp.textContent = isIOS
    ? "Safariの共有ボタン →「ホーム画面に追加」→ 確認画面右上の「追加」（iPhone標準ボタン）の順に操作してください。"
    : "ブラウザのメニューから「このカウンターをインストール」または「ホーム画面に追加」を選んでください。";
  installDialog.showModal();
});

$("closeInstall").addEventListener("click", () => installDialog.close());
window.addEventListener("appinstalled", () => { installButton.hidden = true; });

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/counter/sw.js", { scope: "/counter/" }).catch((error) => {
      console.warn("Service Worker registration failed", error);
    });
  });
}

render();
