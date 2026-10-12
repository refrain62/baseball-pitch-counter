"use strict";

const STORAGE_KEY = "pitch-counter-state-v3";
const MAX_COUNT = 999;
const MAX_INNING = 99;
const MAX_PITCHERS = 100;
const $ = (id) => document.getElementById(id);

let state = {
  A: 0,
  B: 0,
  nameA: "1塁側",
  nameB: "3塁側",
  lapsA: [],
  lapsB: [],
  inning: 1,
  unassignedA: [],
  unassignedB: [],
  inningsA: [],
  inningsB: []
};
let stateNeedsMigration = false;

try {
  const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));

  if (saved && typeof saved === "object") {
    const savedInning = Number(saved.inning);
    stateNeedsMigration =
      !Array.isArray(saved.unassignedA) ||
      !Array.isArray(saved.unassignedB) ||
      !Number.isInteger(savedInning) ||
      savedInning < 1 ||
      savedInning > MAX_INNING ||
      (Array.isArray(saved.lapsA) && saved.lapsA.length > MAX_PITCHERS - 1) ||
      (Array.isArray(saved.lapsB) && saved.lapsB.length > MAX_PITCHERS - 1) ||
      (Array.isArray(saved.inningsA) && saved.inningsA.length > MAX_PITCHERS) ||
      (Array.isArray(saved.inningsB) && saved.inningsB.length > MAX_PITCHERS);
    state = { ...state, ...saved };
  }
} catch (error) {
  console.warn("Saved state could not be loaded", error);
}

function normalizeCount(value) {
  const count = Number(value);

  if (!Number.isFinite(count)) {
    return 0;
  }

  return Math.max(0, Math.min(MAX_COUNT, Math.floor(count)));
}

state.inning = Math.max(
  1,
  Math.min(MAX_INNING, Math.floor(Number(state.inning) || 1))
);

/*
  v3 の lapsA/lapsB は投手ごとの合計だけを持つため、
  イニング配列がない保存データは「イニング未設定」として読み込む。
  未設定分とイニング配列の合計を laps と現在球数へ反映し、二重管理のずれを防ぐ。
*/
function normalizeSide(side) {
  const lapsKey = "laps" + side;
  const unassignedKey = "unassigned" + side;
  const inningsKey = "innings" + side;
  const rawLaps = Array.isArray(state[lapsKey])
    ? state[lapsKey].slice(0, MAX_PITCHERS - 1)
    : [];
  const rawUnassigned = Array.isArray(state[unassignedKey])
    ? state[unassignedKey].slice(0, MAX_PITCHERS)
    : [];
  const rawInnings = Array.isArray(state[inningsKey])
    ? state[inningsKey].slice(0, MAX_PITCHERS)
    : [];
  const playerCount = Math.max(
    rawLaps.length + 1,
    rawUnassigned.length,
    rawInnings.length
  );
  const unassigned = [];
  const innings = [];

  for (let index = 0; index < playerCount; index += 1) {
    const savedCounts = rawInnings[index];
    const legacyFallback = index < rawLaps.length
      ? normalizeCount(rawLaps[index])
      : normalizeCount(state[side]);
    const hasSavedParts =
      index < rawUnassigned.length ||
      Array.isArray(savedCounts);
    const savedUnassigned = hasSavedParts
      ? normalizeCount(rawUnassigned[index])
      : legacyFallback;
    const savedInnings = Array.isArray(savedCounts)
      ? savedCounts.slice(0, MAX_INNING).map(normalizeCount)
      : [];
    let remaining = MAX_COUNT;
    const safeUnassigned = Math.min(savedUnassigned, remaining);
    remaining -= safeUnassigned;
    const safeInnings = savedInnings.map((count) => {
      const safeCount = Math.min(count, remaining);
      remaining -= safeCount;
      return safeCount;
    });

    unassigned.push(safeUnassigned);
    innings.push(safeInnings);
  }

  // 旧形式では laps を残しつつ、未設定分とイニング配列の合計を正として同期する。
  state[unassignedKey] = unassigned;
  state[inningsKey] = innings;
  state[lapsKey] = innings
    .slice(0, -1)
    .map((counts, index) =>
      unassigned[index] + counts.reduce((total, count) => total + count, 0)
    );
  state[side] = unassigned[unassigned.length - 1] + innings[innings.length - 1]
    .reduce((total, count) => total + count, 0);
}

normalizeSide("A");
normalizeSide("B");

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
    Math.min(MAX_COUNT, Number(state[side]) || 0)
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

function getInnings(side) {
  const key = "innings" + side;

  return Array.isArray(state[key])
    ? state[key]
    : [];
}

function getPitcherCounts(side, index, ensureCurrent = true) {
  const innings = getInnings(side);

  if (!Array.isArray(innings[index])) {
    innings[index] = [];
  }

  if (ensureCurrent) {
    while (innings[index].length < state.inning) {
      innings[index].push(0);
    }
  }

  return innings[index];
}

function getPitcherUnassigned(side, index) {
  const key = "unassigned" + side;

  if (!Array.isArray(state[key])) {
    state[key] = [];
  }

  if (!Number.isFinite(Number(state[key][index]))) {
    state[key][index] = 0;
  }

  return normalizeCount(state[key][index]);
}

function getPitcherTotal(side, index) {
  return getPitcherUnassigned(side, index) + getPitcherCounts(side, index)
    .reduce((total, count) => total + normalizeCount(count), 0);
}

function syncSideTotals(side) {
  const lapsKey = "laps" + side;
  const unassignedKey = "unassigned" + side;
  const innings = getInnings(side);

  state[lapsKey] = innings
    .slice(0, -1)
    .map((counts, index) =>
      getPitcherUnassigned(side, index) +
      counts.reduce((total, count) => total + normalizeCount(count), 0)
    );
  state[side] = getPitcherTotal(side, innings.length - 1);

  // 交代済み投手の配列長を laps と揃え、保存時の対応関係を固定する。
  state[unassignedKey] = innings.map((_, index) =>
    getPitcherUnassigned(side, index)
  );
}

function renderInningMeta(side) {
  const mount = $("inningMeta" + side);

  if (!mount) {
    return;
  }

  const counts = getPitcherCounts(side, getInnings(side).length - 1);
  const current = normalizeCount(counts[state.inning - 1]);
  const unassigned = getPitcherUnassigned(
    side,
    getInnings(side).length - 1
  );

  mount.textContent = unassigned > 0
    ? `現在 ${state.inning}回・この回 ${current}球 / 未設定 ${unassigned}球`
    : `現在 ${state.inning}回・この回 ${current}球`;
}

function getLaps(side) {
  const key =
    "laps" + side;

  return Array.isArray(state[key])
    ? state[key]
    : [];
}

function renderLapHistory(side) {
  const mount =
    $("lap" + side);

  const meta =
    $("changeMeta" + side);

  if (!mount || !meta) {
    return;
  }

  const laps =
    getLaps(side);

  mount.replaceChildren();

  if (laps.length > 0) {
    const title =
      document.createElement("div");

    title.className =
      "lap-title";

    title.textContent =
      "交代済み投手（タップで訂正）";

    mount.appendChild(title);
  }

  laps.forEach(
    (count, index) => {
      const row =
        document.createElement("button");

      row.className =
        "lap-chip";
      row.type = "button";
      row.dataset.editPitcher = side;
      row.dataset.pitcherIndex = String(index);
      row.setAttribute(
        "aria-label",
        `${index + 1}人目のイニング別投球数を訂正`
      );

      const player =
        document.createElement("span");

      player.className =
        "lap-player";

      player.textContent =
        `${index + 1}人目`;

      const pitches =
        document.createElement("strong");

      pitches.className =
        "lap-count";

      pitches.textContent =
        `合計 ${count}球`;

      const breakdown =
        document.createElement("small");

      breakdown.className =
        "lap-breakdown";

      const counts = getPitcherCounts(side, index, false);
      const breakdownParts = [
        `未設定 ${getPitcherUnassigned(side, index)}球`,
        ...counts.map((pitchCount, inningIndex) =>
          `${inningIndex + 1}回 ${pitchCount}球`
        )
      ];
      breakdown.textContent = breakdownParts.join(" / ");

      row.append(
        player,
        pitches,
        breakdown
      );

      mount.appendChild(row);
    }
  );

  meta.textContent =
    `${laps.length + 1}人目`;
}

function renderAll() {
  updateDigits("A");
  updateDigits("B");
  renderNames();
  $("currentInning").textContent = String(state.inning);
  renderInningMeta("A");
  renderInningMeta("B");
  renderLapHistory("A");
  renderLapHistory("B");
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

        if (state[side] >= MAX_COUNT) {
          return;
        }

        /*
          最優先はカウンター更新。
          音や保存を待たない。
        */
        const counts = getPitcherCounts(
          side,
          getInnings(side).length - 1
        );

        counts[state.inning - 1] = normalizeCount(
          counts[state.inning - 1] + 1
        );
        syncSideTotals(side);

        updateDigits(side);
        renderInningMeta(side);
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

        const counts = getPitcherCounts(
          side,
          getInnings(side).length - 1
        );

        if (
          state[side] <= 0 ||
          normalizeCount(counts[state.inning - 1]) <= 0
        ) {
          return;
        }

        counts[state.inning - 1] = normalizeCount(
          counts[state.inning - 1] - 1
        );
        syncSideTotals(side);

        updateDigits(side);
        renderInningMeta(side);
        scheduleSave();

        undoClick();
        vibrate(18);

        animateCounter(side);
      }
    );
  });

/* ==================================================
   選手交代 / Lap
   現在の球数を履歴へ保存し、0球から次の投手を開始。
================================================== */

const playerChangeDialog =
  $("playerChangeDialog");
const playerChangeTitle =
  $("playerChangeTitle");
const playerChangePrompt =
  $("playerChangePrompt");
const playerChangeLimit =
  $("playerChangeLimit");
const confirmPlayerChangeButton =
  $("confirmPlayerChange");

let playerChangeTarget =
  null;

document
  .querySelectorAll("[data-change-player]")
  .forEach((button) => {
    button.addEventListener(
      "click",
      () => {
        const side =
          button.dataset.changePlayer;

        if (getInnings(side).length >= MAX_PITCHERS) {
          playerChangeTarget = null;
          playerChangeTitle.textContent =
            "選手交代できません";
          playerChangePrompt.hidden = true;
          playerChangeLimit.textContent =
            `この側で保存できる投手履歴は${MAX_PITCHERS}人までです。現在の投手の内訳を訂正して記録を続けてください。`;
          playerChangeLimit.hidden = false;
          confirmPlayerChangeButton.hidden = true;
          playerChangeDialog.showModal();
          return;
        }

        if (state[side] <= 0) {
          return;
        }

        playerChangeTitle.textContent =
          "選手交代しますか？";
        playerChangePrompt.hidden = false;
        playerChangeLimit.hidden = true;
        confirmPlayerChangeButton.hidden = false;
        playerChangeTarget =
          side;

        const name =
          side === "A"
            ? state.nameA
            : state.nameB;

        $("playerChangeName").textContent =
          `「${name}」`;

        $("playerChangeCount").textContent =
          String(state[side]);

        playerChangeDialog.showModal();
      }
    );
  });

$("cancelPlayerChange").addEventListener(
  "click",
  () => {
    playerChangeTarget = null;
    playerChangeTitle.textContent =
      "選手交代しますか？";
    playerChangePrompt.hidden = false;
    playerChangeLimit.hidden = true;
    confirmPlayerChangeButton.hidden = false;
    playerChangeDialog.close();
  }
);

$("confirmPlayerChange").addEventListener(
  "click",
  () => {
    if (!playerChangeTarget) {
      playerChangeDialog.close();
      return;
    }

    const side =
      playerChangeTarget;

    if (getInnings(side).length >= MAX_PITCHERS) {
      playerChangeTarget = null;
      playerChangeDialog.close();
      return;
    }

    syncSideTotals(side);

    const key =
      "laps" + side;

    if (!Array.isArray(state[key])) {
      state[key] = [];
    }

    state[key].push(
      state[side]
    );

    const inningsKey = "innings" + side;
    const unassignedKey = "unassigned" + side;
    state[unassignedKey].push(0);
    state[inningsKey].push(
      new Array(state.inning).fill(0)
    );

    state[side] = 0;

    updateDigits(side);
    renderInningMeta(side);
    renderLapHistory(side);

    saveDirty = true;
    flushSave();

    vibrate([24, 20, 24]);
    animateCounter(side);

    playerChangeTarget = null;
    playerChangeDialog.close();
  }
);

/* ==================================================
   イニング切り替え
   進めても既存の球数は消さず、各投手の配列だけを次の回へ広げる。
================================================== */

document
  .querySelectorAll("[data-inning-step]")
  .forEach((button) => {
    button.addEventListener(
      "click",
      () => {
        const step = Number(button.dataset.inningStep) || 0;
        const nextInning = state.inning + step;

        if (nextInning < 1 || nextInning > MAX_INNING) {
          return;
        }

        state.inning = nextInning;
        $("currentInning").textContent = String(state.inning);
        renderInningMeta("A");
        renderInningMeta("B");
        renderLapHistory("A");
        renderLapHistory("B");

        saveDirty = true;
        flushSave();
        vibrate(18);
      }
    );
  });

/* ==================================================
   交代済み投手のイニング別訂正
================================================== */

const pitcherEditDialog = $("pitcherEditDialog");
const pitcherEditFields = $("pitcherEditFields");
const pitcherEditError = $("pitcherEditError");
let pitcherEditTarget = null;

function showPitcherEditError(message) {
  pitcherEditError.textContent = message;
  pitcherEditError.hidden = !message;
}

function openPitcherEdit(side, index) {
  const laps = getLaps(side);

  if (index < 0 || index > laps.length) {
    return;
  }

  const counts = getPitcherCounts(side, index, false);
  pitcherEditTarget = { side, index };
  $("pitcherEditTitle").textContent =
    index === laps.length
      ? "現在の投手の投球数を訂正"
      : `${index + 1}人目の投球数を訂正`;
  pitcherEditFields.replaceChildren();
  showPitcherEditError("");

  const unassignedRow = document.createElement("div");
  unassignedRow.className = "pitcher-edit-row";

  const unassignedLabel = document.createElement("label");
  const unassignedInput = document.createElement("input");
  unassignedLabel.htmlFor = `pitcherEdit${side}${index}_unassigned`;
  unassignedLabel.textContent = "イニング未設定";
  unassignedInput.id = unassignedLabel.htmlFor;
  unassignedInput.type = "number";
  unassignedInput.inputMode = "numeric";
  unassignedInput.min = "0";
  unassignedInput.max = String(MAX_COUNT);
  unassignedInput.step = "1";
  unassignedInput.value = String(getPitcherUnassigned(side, index));
  unassignedInput.dataset.unassigned = "true";
  unassignedRow.append(unassignedLabel, unassignedInput);
  pitcherEditFields.appendChild(unassignedRow);

  const inningCount = Math.min(
    MAX_INNING,
    Math.max(state.inning, counts.length)
  );

  for (let inningIndex = 0; inningIndex < inningCount; inningIndex += 1) {
    const row = document.createElement("div");
    row.className = "pitcher-edit-row";

    const label = document.createElement("label");
    const inputId = `pitcherEdit${side}${index}_${inningIndex}`;
    label.htmlFor = inputId;
    label.textContent = `${inningIndex + 1}回`;

    const input = document.createElement("input");
    input.id = inputId;
    input.type = "number";
    input.inputMode = "numeric";
    input.min = "0";
    input.max = String(MAX_COUNT);
    input.step = "1";
    input.value = String(normalizeCount(counts[inningIndex]));
    input.dataset.inningIndex = String(inningIndex);

    row.append(label, input);
    pitcherEditFields.appendChild(row);
  }

  pitcherEditDialog.showModal();
}

document.addEventListener("click", (event) => {
  const button = event.target.closest(
    "[data-edit-pitcher], [data-edit-current]"
  );

  if (!button) {
    return;
  }

  const side = button.dataset.editPitcher || button.dataset.editCurrent;
  const index = button.dataset.editCurrent === undefined
    ? Number(button.dataset.pitcherIndex)
    : getLaps(side).length;

  openPitcherEdit(side, index);
});

$("cancelPitcherEdit").addEventListener(
  "click",
  () => {
    pitcherEditTarget = null;
    pitcherEditDialog.close();
  }
);

$("savePitcherEdit").addEventListener(
  "click",
  () => {
    if (!pitcherEditTarget) {
      pitcherEditDialog.close();
      return;
    }

    const inputs = pitcherEditFields.querySelectorAll("input");
    const counts = [];
    let total = 0;
    let unassigned = 0;

    for (const input of inputs) {
      const value = Number(input.value);

      if (!Number.isInteger(value) || value < 0 || value > MAX_COUNT) {
        showPitcherEditError(`各イニングは0〜${MAX_COUNT}球の整数で入力してください。`);
        input.focus();
        return;
      }

      if (input.dataset.unassigned === "true") {
        unassigned = value;
      } else {
        counts.push(value);
      }

      total += value;
    }

    if (total > MAX_COUNT) {
      showPitcherEditError(`投手ごとの合計は${MAX_COUNT}球以内で入力してください。`);
      return;
    }

    const { side, index } = pitcherEditTarget;
    state["unassigned" + side][index] = unassigned;
    state["innings" + side][index] = counts;
    syncSideTotals(side);

    if (index === getInnings(side).length - 1) {
      updateDigits(side);
      renderInningMeta(side);
    }

    renderLapHistory(side);
    saveDirty = true;
    flushSave();
    vibrate(24);

    pitcherEditTarget = null;
    pitcherEditDialog.close();
  }
);

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
      const currentCounts = getPitcherCounts(
        resetTarget,
        getInnings(resetTarget).length - 1
      );

      currentCounts.fill(0);
      state["unassigned" + resetTarget][
        getInnings(resetTarget).length - 1
      ] = 0;
      syncSideTotals(resetTarget);

      updateDigits(resetTarget);
      renderInningMeta(resetTarget);

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
    state.lapsA = [];
    state.lapsB = [];
    state.inning = 1;
    state.unassignedA = [0];
    state.unassignedB = [0];
    state.inningsA = [[0]];
    state.inningsB = [[0]];

    $("nameA").value =
      state.nameA;

    $("nameB").value =
      state.nameB;

    updateDigits("A");
    updateDigits("B");
    $("currentInning").textContent = "1";
    renderInningMeta("A");
    renderInningMeta("B");
    renderLapHistory("A");
    renderLapHistory("B");

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

const isAndroid =
  /android/i.test(
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
      ? "ホーム画面に追加（3ステップ）"
      : "このカウンターをインストール";

  installButton.hidden = false;
}

showInstallButton();

/*
  LPで「インストールして使う」を選んだiPhoneは、
  追加でもう一度ボタンを押させず、手順を自動表示する。
*/
if (
  isIOS &&
  wantsInstall &&
  !isStandalone
) {
  window.setTimeout(
    () => {
      installTitle.textContent =
        "ホーム画面に追加";

      installHelp.textContent =
        "迷いやすい2か所だけ確認してください。";

      $("iosInstallSteps").hidden =
        false;

      $("androidInstallSteps").hidden =
        true;

      if (!installDialog.open) {
        installDialog.showModal();
      }
    },
    180
  );
}

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

    const iosSteps =
      $("iosInstallSteps");

    const androidSteps =
      $("androidInstallSteps");

    if (isIOS) {
      installTitle.textContent =
        "iPhoneのホーム画面に追加";

      installHelp.textContent =
        "迷いやすい2か所だけ確認してください。";

      iosSteps.hidden = false;
      androidSteps.hidden = true;
    } else if (isAndroid) {
      installTitle.textContent =
        "Androidにインストール";

      installHelp.textContent =
        "通常はインストールボタンだけで完了します。出ない場合だけChromeメニューを使います。";

      iosSteps.hidden = true;
      androidSteps.hidden = false;
    } else {
      installTitle.textContent =
        "このカウンターをインストール";

      installHelp.textContent =
        "ブラウザのメニューにある「インストール」または「ホーム画面に追加」を選んでください。";

      iosSteps.hidden = true;
      androidSteps.hidden = true;
    }

    installDialog.showModal();
  }
);

$("closeInstall").addEventListener(
  "click",
  () => {
    installDialog.close();
  }
);

$("closeInstallTop").addEventListener(
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

if (stateNeedsMigration) {
  // 旧 v3 データも、初回表示時に未設定分を含む形式へ移行して保存する。
  saveDirty = true;
  flushSave();
}

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
