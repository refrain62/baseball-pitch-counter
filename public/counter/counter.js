"use strict";

const STORAGE_KEY = "pitch-counter-state-v3";
const MAX_COUNT = 999;
const MAX_INNING = 99;
const MAX_PITCHERS = 100;
// 通常の履歴上限とは分け、破損した保存データによる巨大ループを防ぐ。
const MAX_SAVED_PITCHERS = 1000;
const MAX_ARCHIVED_PITCHERS = MAX_SAVED_PITCHERS - MAX_PITCHERS;
const $ = (id) => document.getElementById(id);

let state = {
  A: 0,
  B: 0,
  nameA: "1塁側",
  nameB: "3塁側",
  lapsA: [],
  lapsB: [],
  inning: 1,
  inningA: 1,
  inningB: 1,
  unassignedA: [],
  unassignedB: [],
  inningsA: [],
  inningsB: [],
  overflowA: null,
  overflowB: null
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
      saved.inningA === undefined ||
      saved.inningB === undefined ||
      !Number.isInteger(Number(saved.inningA)) ||
      Number(saved.inningA) < 1 ||
      Number(saved.inningA) > MAX_INNING ||
      !Number.isInteger(Number(saved.inningB)) ||
      Number(saved.inningB) < 1 ||
      Number(saved.inningB) > MAX_INNING ||
      (Array.isArray(saved.lapsA) && saved.lapsA.length > MAX_PITCHERS - 1) ||
      (Array.isArray(saved.lapsB) && saved.lapsB.length > MAX_PITCHERS - 1) ||
      (Array.isArray(saved.inningsA) && saved.inningsA.length > MAX_PITCHERS) ||
      (Array.isArray(saved.inningsB) && saved.inningsB.length > MAX_PITCHERS) ||
      (Array.isArray(saved.lapsA) && saved.lapsA.length > MAX_SAVED_PITCHERS - 1) ||
      (Array.isArray(saved.lapsB) && saved.lapsB.length > MAX_SAVED_PITCHERS - 1) ||
      (Array.isArray(saved.unassignedA) && saved.unassignedA.length > MAX_SAVED_PITCHERS) ||
      (Array.isArray(saved.unassignedB) && saved.unassignedB.length > MAX_SAVED_PITCHERS) ||
      (Array.isArray(saved.inningsA) && saved.inningsA.length > MAX_SAVED_PITCHERS) ||
      (Array.isArray(saved.inningsB) && saved.inningsB.length > MAX_SAVED_PITCHERS);
    state = { ...state, ...saved };
    // 旧形式は両側で共有していた回を、初期値として引き継ぐ。
    if (saved.inningA === undefined) {
      state.inningA = savedInning;
    }
    if (saved.inningB === undefined) {
      state.inningB = savedInning;
    }
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

// 旧形式は回を共有していたため、初回だけ同じ回を両側へ引き継ぐ。
["A", "B"].forEach((side) => {
  const key = "inning" + side;
  const savedInning = Number(state[key]);

  state[key] = Number.isInteger(savedInning)
    ? Math.max(1, Math.min(MAX_INNING, savedInning))
    : state.inning;
});

function getCurrentInning(side) {
  return state["inning" + side];
}

/*
  v3 の lapsA/lapsB は投手ごとの合計だけを持つため、
  イニング配列がない保存データは「イニング未設定」として読み込む。
  未設定分とイニング配列の合計を laps と現在球数へ反映し、二重管理のずれを防ぐ。
*/
function normalizeSide(side) {
  const lapsKey = "laps" + side;
  const unassignedKey = "unassigned" + side;
  const inningsKey = "innings" + side;
  const overflowKey = "overflow" + side;
  const sourceLaps = Array.isArray(state[lapsKey]) ? state[lapsKey] : [];
  const sourceUnassigned = Array.isArray(state[unassignedKey])
    ? state[unassignedKey]
    : [];
  const sourceInnings = Array.isArray(state[inningsKey])
    ? state[inningsKey]
    : [];
  const sourcePlayerCount = Math.max(
    sourceLaps.length + 1,
    sourceUnassigned.length,
    sourceInnings.length
  );
  const retainedStart = Math.max(0, sourcePlayerCount - MAX_SAVED_PITCHERS);
  const playerCount = Math.min(sourcePlayerCount, MAX_SAVED_PITCHERS);
  let rawLaps = sourceLaps.slice(
    retainedStart,
    Math.min(sourcePlayerCount - 1, sourceLaps.length)
  );
  let rawUnassigned = sourceUnassigned.slice(
    retainedStart,
    Math.min(sourcePlayerCount, sourceUnassigned.length)
  );
  let rawInnings = sourceInnings.slice(
    retainedStart,
    Math.min(sourcePlayerCount, sourceInnings.length)
  );
  const overflowCount = Math.max(0, playerCount - MAX_PITCHERS);
  const discardedCount = Math.max(0, sourcePlayerCount - playerCount);
  const previousOverflow = state[overflowKey] && typeof state[overflowKey] === "object"
    ? state[overflowKey]
    : null;

  if (overflowCount > 0 || discardedCount > 0) {
    state[overflowKey] = {
      count: overflowCount,
      discarded: discardedCount,
      laps: rawLaps.slice(0, overflowCount),
      unassigned: rawUnassigned.slice(0, overflowCount),
      innings: rawInnings.slice(0, overflowCount)
    };
    rawLaps = rawLaps.slice(overflowCount, playerCount - 1);
    rawUnassigned = rawUnassigned.slice(overflowCount, playerCount);
    rawInnings = rawInnings.slice(overflowCount, playerCount);
    stateNeedsMigration = true;
  } else if (previousOverflow) {
    const previousLaps = Array.isArray(previousOverflow.laps)
      ? previousOverflow.laps
      : [];
    const previousUnassigned = Array.isArray(previousOverflow.unassigned)
      ? previousOverflow.unassigned
      : [];
    const previousInnings = Array.isArray(previousOverflow.innings)
      ? previousOverflow.innings
      : [];
    const previousCount = Number(previousOverflow.count);
    const safePreviousCount = Number.isSafeInteger(previousCount) && previousCount > 0
      ? previousCount
      : 0;
    const previousSize = Math.max(
      previousLaps.length,
      previousUnassigned.length,
      previousInnings.length,
      safePreviousCount
    );
    const previousStart = Math.max(0, previousSize - MAX_ARCHIVED_PITCHERS);
    const discardedOverflow = Math.max(
      0,
      previousSize - MAX_ARCHIVED_PITCHERS
    );

    state[overflowKey] = {
      count: Math.min(MAX_ARCHIVED_PITCHERS, previousSize),
      discarded: (Number.isSafeInteger(Number(previousOverflow.discarded))
        ? Math.max(0, Number(previousOverflow.discarded))
        : 0) + discardedOverflow,
      laps: previousLaps.slice(previousStart),
      unassigned: previousUnassigned.slice(previousStart),
      innings: previousInnings.slice(previousStart)
    };

    if (discardedOverflow > 0) {
      stateNeedsMigration = true;
    }
  }

  const activePlayerCount = Math.min(playerCount, MAX_PITCHERS);
  const unassigned = [];
  const innings = [];

  for (let index = 0; index < activePlayerCount; index += 1) {
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
    while (innings[index].length < getCurrentInning(side)) {
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
  const currentInning = getCurrentInning(side);
  const inningBadge = $("currentInning" + side);
  const meta = $("inningMeta" + side);
  const counts = getPitcherCounts(side, getInnings(side).length - 1);
  const current = normalizeCount(counts[currentInning - 1]);
  const unassigned = getPitcherUnassigned(
    side,
    getInnings(side).length - 1
  );

  if (inningBadge) {
    inningBadge.textContent = `${currentInning}回`;
  }

  if (meta) {
    meta.textContent = unassigned > 0
      ? `${currentInning}回 ${current}球・未設定 ${unassigned}球`
      : `${currentInning}回 ${current}球をチップから訂正`;
  }
}

function getLaps(side) {
  const key =
    "laps" + side;

  return Array.isArray(state[key])
    ? state[key]
    : [];
}

function getOverflowCounts(side) {
  const overflow = state["overflow" + side];
  const archivedValue = Number(overflow?.count);
  const discardedValue = Number(overflow?.discarded);

  return {
    archived: Number.isFinite(archivedValue)
      ? Math.min(MAX_ARCHIVED_PITCHERS, Math.max(0, Math.floor(archivedValue)))
      : 0,
    discarded: Number.isSafeInteger(discardedValue)
      ? Math.max(0, discardedValue)
      : 0
  };
}

function renderPitcherInningChips(side, index, mount) {
  const currentIndex = getInnings(side).length - 1;
  const { archived, discarded } = getOverflowCounts(side);
  const pitcherNumber = index + 1 + archived + discarded;
  const pitcherLabel = index === currentIndex
    ? "現在の投手"
    : `${pitcherNumber}人目の投手`;
  const chips = document.createElement("div");
  chips.className = "inning-chip-list";
  const counts = getPitcherCounts(side, index, false);
  const currentInning = getCurrentInning(side);
  const inningCount = Math.min(
    MAX_INNING,
    Math.max(currentInning, counts.length)
  );
  let hasPitchCount = false;

  for (let inningIndex = 0; inningIndex < inningCount; inningIndex += 1) {
    if (normalizeCount(counts[inningIndex]) === 0) {
      continue;
    }
    hasPitchCount = true;
    const chip = document.createElement("button");
    chip.className = "inning-chip";
    const isCurrentInning = inningIndex + 1 === currentInning;
    if (isCurrentInning) {
      chip.classList.add("inning-chip-current");
      chip.setAttribute("aria-current", "true");
    }
    chip.type = "button";
    chip.dataset.editInning = side;
    chip.dataset.pitcherIndex = String(index);
    chip.dataset.inningIndex = String(inningIndex);
    chip.setAttribute(
      "aria-label",
      `${pitcherLabel} ${inningIndex + 1}回の投球数を訂正${isCurrentInning ? "（現在の回）" : ""}`
    );

    const label = document.createElement("span");
    label.textContent = `${inningIndex + 1}回`;
    const value = document.createElement("strong");
    value.className = "inning-chip-count";
    value.textContent = `${normalizeCount(counts[inningIndex])}球`;
    chip.append(label, value);
    chips.appendChild(chip);
  }

  const unassigned = getPitcherUnassigned(side, index);
  if (!hasPitchCount && unassigned === 0) {
    return;
  }
  if (unassigned > 0) {
    const chip = document.createElement("button");
    chip.className = "inning-chip inning-chip-unassigned";
    chip.type = "button";
    chip.dataset.editUnassigned = side;
    chip.dataset.pitcherIndex = String(index);
    chip.setAttribute(
      "aria-label",
      `${pitcherLabel}のイニング未設定分 ${unassigned}球を訂正`
    );

    const label = document.createElement("span");
    label.textContent = "未設定";
    const value = document.createElement("strong");
    value.textContent = `${unassigned}球`;
    chip.append(label, value);
    chips.appendChild(chip);
  }

  mount.appendChild(chips);
}

function renderLapHistory(side) {
  const mount = $("lap" + side);
  const meta = $("changeMeta" + side);

  if (!mount || !meta) {
    return;
  }

  const laps = getLaps(side);
  const innings = getInnings(side);
  const currentIndex = innings.length - 1;
  const visibleStart = Math.max(0, innings.length - MAX_PITCHERS);
  const { archived: archivedCount, discarded: discardedCount } =
    getOverflowCounts(side);
  const expandedIndex = mount.querySelector("details[open]")?.dataset.pitcherIndex;

  mount.replaceChildren();

  if (visibleStart > 0 || archivedCount > 0 || discardedCount > 0) {
    const note = document.createElement("p");
    note.className = "pitcher-history-overflow-note";
    const olderCount = visibleStart + archivedCount;
    note.textContent = discardedCount > 0
      ? `直近${MAX_PITCHERS}人分を表示中。以前の${olderCount}人分を保存しています。保存上限を超えた${discardedCount}人分は読み込み対象外です。`
      : `直近${MAX_PITCHERS}人分を表示中。以前の${olderCount}人分も保存されています。`;
    mount.appendChild(note);
  }

  for (let index = visibleStart; index < innings.length; index += 1) {
    const isCurrent = index === currentIndex;
    const section = document.createElement(isCurrent ? "section" : "details");
    section.className = "pitcher-section";
    section.dataset.pitcherIndex = String(index);

    const heading = document.createElement(isCurrent ? "div" : "summary");
    heading.className = "pitcher-section-heading";

    const player = document.createElement("strong");
    player.className = "lap-player";
    player.textContent =
      `${index + 1 + archivedCount + discardedCount}人目の投手`;

    const pitches = document.createElement("strong");
    pitches.className = "lap-count";
    pitches.dataset.pitcherTotal = String(index);
    pitches.textContent = `累計 ${getPitcherTotal(side, index)}球`;
    heading.append(player, pitches);

    const badge = document.createElement("span");
    badge.className = isCurrent
      ? "current-pitcher-badge"
      : "pitcher-history-hint";
    badge.textContent = isCurrent
      ? `現在 ${getCurrentInning(side)}回`
      : "回別を見る";
    if (isCurrent) {
      badge.setAttribute("aria-live", "polite");
    }
    heading.appendChild(badge);
    section.appendChild(heading);

    if (isCurrent) {
      renderPitcherInningChips(side, index, section);
    } else {
      section.addEventListener("toggle", () => {
        if (!section.open) {
          return;
        }

        mount.querySelectorAll("details[open]").forEach((other) => {
          if (other !== section) {
            other.open = false;
          }
        });

        if (!section.dataset.chipsRendered) {
          renderPitcherInningChips(side, index, section);
          section.dataset.chipsRendered = "true";
        }
      });

      if (String(index) === expandedIndex) {
        section.open = true;
        renderPitcherInningChips(side, index, section);
        section.dataset.chipsRendered = "true";
      }
    }

    mount.appendChild(section);
  }

  meta.textContent = `${laps.length + archivedCount + discardedCount + 1}人目`;
}

function updateCurrentPitcherHistory(side) {
  const currentIndex = getInnings(side).length - 1;
  const section = $("lap" + side)?.querySelector(
    `section[data-pitcher-index="${currentIndex}"]`
  );

  if (!section) {
    renderLapHistory(side);
    return;
  }

  const total = section.querySelector("[data-pitcher-total]");
  if (total) {
    total.textContent = `累計 ${getPitcherTotal(side, currentIndex)}球`;
  }

  const chip = section.querySelector(
    `[data-edit-inning="${side}"][data-pitcher-index="${currentIndex}"][data-inning-index="${getCurrentInning(side) - 1}"]`
  );
  const count = chip?.querySelector(".inning-chip-count");
  if (count) {
    const inningCounts = getPitcherCounts(side, currentIndex, false);
    count.textContent = `${normalizeCount(inningCounts[getCurrentInning(side) - 1])}球`;
  }
  renderLapHistory(side);
}

function renderAll() {
  updateDigits("A");
  updateDigits("B");
  renderNames();
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

        const inning = getCurrentInning(side);
        counts[inning - 1] = normalizeCount(
          counts[inning - 1] + 1
        );
        syncSideTotals(side);

        updateDigits(side);
        renderInningMeta(side);
        updateCurrentPitcherHistory(side);
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
          normalizeCount(counts[getCurrentInning(side) - 1]) <= 0
        ) {
          return;
        }

        const inning = getCurrentInning(side);
        counts[inning - 1] = normalizeCount(
          counts[inning - 1] - 1
        );
        syncSideTotals(side);

        updateDigits(side);
        renderInningMeta(side);
        updateCurrentPitcherHistory(side);
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
      new Array(getCurrentInning(side)).fill(0)
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
   イニング選択
   確定するまで state を変更せず、次の投球から選択回へ記録する。
================================================== */

const inningSelectDialog = $("inningSelectDialog");
const inningSelectLead = $("inningSelectLead");
const inningSelectCurrent = $("inningSelectCurrent");
const inningSelectDestination = $("inningSelectDestination");
const inningRegularOptions = $("inningRegularOptions");
const inningRegularDestination = $("inningRegularDestination");
const inningRegularStepButtons = inningSelectDialog.querySelectorAll(
  "[data-inning-step]"
);
const inningExtraInput = $("inningExtraInput");
const inningExtraError = $("inningExtraError");
const inningExtraStepButtons = inningSelectDialog.querySelectorAll(
  "[data-extension-step]"
);
let inningSelectTarget = null;
let inningSelectValue = 1;
let inningExtraInputTouched = false;

function setInningExtraError(message) {
  inningExtraError.textContent = message;
  inningExtraError.hidden = !message;
  if (message) {
    inningExtraInput.setAttribute("aria-invalid", "true");
  } else {
    inningExtraInput.removeAttribute("aria-invalid");
  }
}

function updateInningStepControls() {
  const destination = String(inningSelectValue) + "回";
  inningSelectDestination.textContent = destination;
  inningRegularDestination.textContent = destination;
  inningRegularStepButtons.forEach((button) => {
    const step = Number(button.dataset.inningStep);
    const atMinimum = step < 0 && inningSelectValue <= 1;
    const atMaximum = step > 0 && inningSelectValue >= MAX_INNING;
    button.disabled = atMinimum || atMaximum;
    button.setAttribute("aria-disabled", String(button.disabled));
  });
  const extensionValue = Math.max(10, inningSelectValue);
  inningExtraStepButtons.forEach((button) => {
    const step = Number(button.dataset.extensionStep);
    const atMinimum = step < 0 && extensionValue <= 10;
    const atMaximum = step > 0 && extensionValue >= MAX_INNING;
    button.disabled = atMinimum || atMaximum;
    button.setAttribute("aria-disabled", String(button.disabled));
  });
}

function updateInningOptionState() {
  inningSelectDialog
    .querySelectorAll("[data-inning-option]")
    .forEach((button) => {
      const selected = Number(button.dataset.inningOption) === inningSelectValue;
      button.setAttribute("aria-selected", String(selected));
    });
  inningExtraInput.value = inningSelectValue >= 10
    ? String(inningSelectValue)
    : "";
  inningExtraInput.placeholder = "10";
  inningExtraInputTouched = false;
  setInningExtraError("");
  updateInningStepControls();
}

function getInningOptionColumns() {
  const columns = getComputedStyle(inningRegularOptions)
    .gridTemplateColumns
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .length;
  return Math.max(1, columns);
}

function appendInningOptions(mount, start, end) {
  for (let inning = start; inning <= end; inning += 1) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "inning-option";
    button.dataset.inningOption = String(inning);
    button.setAttribute("role", "option");
    button.setAttribute("aria-selected", "false");
    button.setAttribute("aria-label", `${inning}回を選択`);
    button.textContent = `${inning}回`;
    button.addEventListener("click", () => {
      inningSelectValue = inning;
      updateInningOptionState();
    });
    button.addEventListener("keydown", (event) => {
      const options = Array.from(
        inningSelectDialog.querySelectorAll("[data-inning-option]")
      );
      const currentIndex = options.indexOf(event.currentTarget);
      let nextIndex = currentIndex;

      if (event.key === "ArrowDown") {
        nextIndex = Math.min(
          options.length - 1,
          currentIndex + getInningOptionColumns()
        );
      } else if (event.key === "ArrowRight") {
        nextIndex = Math.min(options.length - 1, currentIndex + 1);
      } else if (event.key === "ArrowUp") {
        nextIndex = Math.max(
          0,
          currentIndex - getInningOptionColumns()
        );
      } else if (event.key === "ArrowLeft") {
        nextIndex = Math.max(0, currentIndex - 1);
      } else if (event.key === "Home") {
        nextIndex = 0;
      } else if (event.key === "End") {
        nextIndex = options.length - 1;
      } else {
        return;
      }

      event.preventDefault();
      const nextOption = options[nextIndex];
      inningSelectValue = Number(nextOption.dataset.inningOption);
      updateInningOptionState();
      nextOption.focus();
    });
    mount.appendChild(button);
  }
}

appendInningOptions(inningRegularOptions, 1, 9);

function stepInningSelection(step) {
  inningSelectValue = Math.max(
    1,
    Math.min(MAX_INNING, inningSelectValue + step)
  );
  updateInningOptionState();
}

inningRegularStepButtons.forEach((button) => {
  button.addEventListener("click", () => {
    stepInningSelection(Number(button.dataset.inningStep) || 0);
  });
});

function setExtensionSelection(value) {
  const rawValue = String(value ?? "").trim();
  const nextValue = Number(rawValue);

  if (
    !rawValue ||
    !Number.isInteger(nextValue) ||
    nextValue < 10 ||
    nextValue > MAX_INNING
  ) {
    setInningExtraError("延長回は10〜99回の整数で入力してください。");
    inningExtraInputTouched = true;
    return false;
  }

  setInningExtraError("");
  inningSelectValue = Math.max(10, Math.min(MAX_INNING, nextValue));
  updateInningOptionState();
  return true;
}

inningExtraInput.addEventListener("input", () => {
  inningExtraInputTouched = true;
  const rawValue = inningExtraInput.value.trim();
  const nextValue = Number(rawValue);

  if (
    !rawValue ||
    !Number.isInteger(nextValue) ||
    nextValue < 10 ||
    nextValue > MAX_INNING
  ) {
    setInningExtraError("延長回は10〜99回の整数で入力してください。");
    return;
  }

  setInningExtraError("");
  inningSelectValue = Math.max(10, Math.min(MAX_INNING, nextValue));
  inningSelectDialog
    .querySelectorAll("[data-inning-option]")
    .forEach((button) => {
      button.setAttribute(
        "aria-selected",
        String(Number(button.dataset.inningOption) === inningSelectValue)
      );
    });
  updateInningStepControls();
});

inningExtraInput.addEventListener("change", () => {
  setExtensionSelection(inningExtraInput.value);
});

inningSelectDialog
  .querySelectorAll("[data-extension-step]")
  .forEach((button) => {
    button.addEventListener("click", () => {
      const step = Number(button.dataset.extensionStep) || 0;
      const currentValue = Number(inningExtraInput.value);
      const baseValue = Number.isInteger(currentValue) && currentValue >= 10
        ? currentValue
        : 10;
      setExtensionSelection(
        Math.max(10, Math.min(MAX_INNING, baseValue + step))
      );
    });
  });

function closeInningSelectDialog() {
  inningSelectTarget = null;
  inningSelectDialog.classList.remove("side-b");
  inningSelectDialog.close();
}

inningSelectDialog.addEventListener("cancel", () => {
  inningSelectTarget = null;
  inningSelectDialog.classList.remove("side-b");
});

document
  .querySelectorAll("[data-inning-select]")
  .forEach((button) => {
    button.addEventListener("click", () => {
      const side = button.dataset.inningSelect;

      if (side !== "A" && side !== "B") {
        return;
      }

      inningSelectTarget = side;
      const currentInning = getCurrentInning(side);
      inningSelectValue = currentInning;
      inningSelectDialog.classList.toggle("side-b", side === "B");
      inningSelectLead.textContent =
        `${side === "A" ? state.nameA : state.nameB}の次の投球を記録する回を選択します。`;
      inningSelectCurrent.textContent = `${currentInning}回`;
      updateInningOptionState();
      inningSelectDialog.showModal();

      const initialOption = inningSelectDialog.querySelector(
        `[data-inning-option="${inningSelectValue}"]`
      );
      (initialOption || inningExtraInput).focus();
    });
  });

$("cancelInningSelect").addEventListener("click", closeInningSelectDialog);
$("closeInningSelect").addEventListener("click", closeInningSelectDialog);

$("confirmInningSelect").addEventListener("click", () => {
  if (!inningSelectTarget) {
    closeInningSelectDialog();
    return;
  }

  // 入力欄からフォーカスを移さず確定しても、最後の値を反映する。
  if (inningExtraInputTouched) {
    if (!setExtensionSelection(inningExtraInput.value)) {
      inningExtraInput.focus();
      return;
    }
  }

  const side = inningSelectTarget;
  state["inning" + side] = inningSelectValue;
  renderInningMeta(side);
  renderLapHistory(side);
  scheduleSave();
  vibrate(18);
  closeInningSelectDialog();
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

function openPitcherEdit(side, index, inningIndex, unassigned = false) {
  const innings = getInnings(side);
  const currentIndex = innings.length - 1;

  if (
    index < 0 ||
    index > currentIndex ||
    (!unassigned && (
      !Number.isInteger(inningIndex) ||
      inningIndex < 0 ||
      inningIndex >= MAX_INNING
    ))
  ) {
    return;
  }

  const counts = getPitcherCounts(side, index, false);
  const currentValue = unassigned
    ? getPitcherUnassigned(side, index)
    : normalizeCount(counts[inningIndex]);
  const otherTotal = getPitcherTotal(side, index) - currentValue;
  const maximum = Math.max(0, MAX_COUNT - otherTotal);
  const { archived, discarded } = getOverflowCounts(side);
  const pitcherNumber = index + 1 + archived + discarded;
  const pitcherName = index === currentIndex
    ? "現在の投手"
    : `${pitcherNumber}人目の投手`;
  const targetLabel = unassigned
    ? "イニング未設定分"
    : `${inningIndex + 1}回`;

  pitcherEditTarget = { side, index, inningIndex, unassigned };
  pitcherEditDialog.classList.toggle("side-b", side === "B");
  $("pitcherEditTitle").textContent =
    `${pitcherName}・${targetLabel}を訂正`;
  $("pitcherEditLead").textContent =
    `${side === "A" ? state.nameA : state.nameB} / ${pitcherName} / ${targetLabel}。現在 ${currentValue}球（投手累計の上限 ${MAX_COUNT}球）`;
  pitcherEditFields.replaceChildren();
  showPitcherEditError("");

  const row = document.createElement("div");
  row.className = "pitcher-edit-row pitcher-edit-stepper";

  const label = document.createElement("label");
  const inputId = unassigned
    ? `pitcherEdit${side}${index}_unassigned`
    : `pitcherEdit${side}${index}_${inningIndex}`;
  label.htmlFor = inputId;
  label.textContent = unassigned ? "イニング未設定分" : "この回の球数";

  const controls = document.createElement("div");
  controls.className = "pitcher-edit-controls";

  const decrement = document.createElement("button");
  decrement.type = "button";
  decrement.className = "pitcher-edit-step";
  decrement.dataset.editAdjust = "-1";
  decrement.textContent = "−";
  decrement.setAttribute("aria-label", "1球減らす");

  const input = document.createElement("input");
  input.id = inputId;
  input.type = "number";
  input.inputMode = "numeric";
  input.min = "0";
  input.max = String(maximum);
  input.step = "1";
  input.value = String(currentValue);
  input.setAttribute("aria-label", `${targetLabel}の球数`);

  const increment = document.createElement("button");
  increment.type = "button";
  increment.className = "pitcher-edit-step";
  increment.dataset.editAdjust = "1";
  increment.textContent = "＋";
  increment.setAttribute("aria-label", "1球増やす");

  controls.append(decrement, input, increment);
  row.append(label, controls);
  pitcherEditFields.appendChild(row);

  pitcherEditDialog.showModal();
  $("pitcherEditTitle").focus();
}

document.addEventListener("click", (event) => {
  const button = event.target.closest("[data-edit-inning], [data-edit-unassigned]");

  if (!button) {
    return;
  }

  const unassigned = button.dataset.editUnassigned !== undefined;
  const side = unassigned
    ? button.dataset.editUnassigned
    : button.dataset.editInning;
  const index = Number(button.dataset.pitcherIndex);
  const inningIndex = Number(button.dataset.inningIndex);

  openPitcherEdit(side, index, inningIndex, unassigned);
});

pitcherEditFields.addEventListener("click", (event) => {
  const button = event.target.closest("[data-edit-adjust]");

  if (!button) {
    return;
  }

  const input = pitcherEditFields.querySelector("input");

  if (!input) {
    return;
  }

  const nextValue = Number(input.value) + Number(button.dataset.editAdjust);
  input.value = String(Math.max(Number(input.min), Math.min(Number(input.max), nextValue)));
  input.focus();
});

function closePitcherEditDialog() {
  pitcherEditTarget = null;
  pitcherEditDialog.classList.remove("side-b");
  pitcherEditDialog.close();
}

$("cancelPitcherEdit").addEventListener("click", closePitcherEditDialog);
$("closePitcherEdit").addEventListener("click", closePitcherEditDialog);

$("savePitcherEdit").addEventListener(
  "click",
  () => {
    if (!pitcherEditTarget) {
      pitcherEditDialog.classList.remove("side-b");
      pitcherEditDialog.close();
      return;
    }

    const input = pitcherEditFields.querySelector("input");
    const value = Number(input && input.value);

    if (!input || !Number.isInteger(value) || value < 0 || value > MAX_COUNT) {
      showPitcherEditError(`この回は0〜${MAX_COUNT}球の整数で入力してください。`);
      input?.focus();
      return;
    }

    const { side, index, inningIndex, unassigned } = pitcherEditTarget;
    const counts = getPitcherCounts(side, index, false);
    const currentValue = unassigned
      ? getPitcherUnassigned(side, index)
      : normalizeCount(counts[inningIndex]);
    const otherTotal = getPitcherTotal(side, index) - currentValue;

    if (otherTotal + value > MAX_COUNT) {
      showPitcherEditError(`投手ごとの合計は${MAX_COUNT}球以内で入力してください。`);
      return;
    }

    if (unassigned) {
      state["unassigned" + side][index] = value;
    } else {
      counts[inningIndex] = value;
    }
    syncSideTotals(side);
    updateDigits(side);
    renderInningMeta(side);
    renderLapHistory(side);
    scheduleSave();
    vibrate(24);

    pitcherEditTarget = null;
    pitcherEditDialog.classList.remove("side-b");
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
      renderLapHistory(resetTarget);

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
    state.inningA = 1;
    state.inningB = 1;
    state.overflowA = null;
    state.overflowB = null;
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
