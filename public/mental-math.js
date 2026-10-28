import { confetti } from "./operdle.js";

(() => {
  "use strict";
  const STORE = "mental-math:v1:game:";
  const wheel = document.getElementById("puzzleWheel");
  const app = document.querySelector(".app");
  const soon = document.getElementById("soonPanel");
  if (!wheel || !app || !soon) return;
  const pad = (n) => String(n).padStart(2, "0");
  const today = () => {
    const d = new Date();
    return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
  };
  const weekday = (date) => new Date(date + "T12:00:00").getDay();
  const utcDay = (date) => {
    const p = date.split("-").map(Number);
    return Date.UTC(p[0], p[1] - 1, p[2]);
  };
  function rngFor(seed) {
    let h = 2166136261;
    for (let i = 0; i < seed.length; i++) { h ^= seed.charCodeAt(i); h = Math.imul(h, 16777619); }
    let a = h >>> 0;
    return () => {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const int = (r, min, max) => min + Math.floor(r() * (max - min + 1));
  function hardProblem(date) {
    const r = rngFor("mental-math:hard:v1:" + date);
    const type = Math.floor(r() * 4);
    let a, b, c, prompt, answer;
    if (type === 0) {
      a = int(r, 34, 89); b = int(r, 14, 28); c = int(r, 150, 599);
      prompt = "Calculate mentally: " + a + " × " + b + " + " + c; answer = a * b + c;
    } else if (type === 1) {
      a = int(r, 48, 89); b = int(r, 16, 29); c = int(r, 150, 650);
      prompt = "Calculate mentally: " + a + " × " + b + " − " + c; answer = a * b - c;
    } else if (type === 2) {
      a = int(r, 320, 789); b = int(r, 210, 689); c = int(r, 110, 399);
      prompt = "Calculate mentally: " + a + " + " + b + " − " + c; answer = a + b - c;
    } else {
      a = int(r, 24, 79); b = int(r, 16, 39); c = int(r, 12, 29);
      prompt = "Calculate mentally: (" + a + " + " + b + ") × " + c; answer = (a + b) * c;
    }
    return { id: "hard-" + date, track: "A", title: "Just Hard", prompt, answer, explanation: null };
  }
  function cleverProblem(date) {
    const r = rngFor("mental-math:clever:v1:" + date);
    const type = Math.floor(r() * 5);
    let n, x, y, a, b, base, prompt, answer, title, explanation;
    if (type === 0) {
      n = int(r, 1, 8) * 10 + 5; prompt = "What is " + n + "²?"; answer = n * n;
      title = "Square endings"; explanation = "A number ending in 5 can be squared by multiplying the tens digit by the next integer, then appending 25.";
    } else if (type === 1) {
      x = int(r, 2, 9); y = int(r, 2, 9); a = 100 - x; b = 100 - y;
      prompt = "Calculate " + a + " × " + b + " mentally."; answer = a * b; title = "Near one hundred";
      explanation = "Use (100 − " + x + ")(100 − " + y + ") = 100 × " + (100 - x - y) + " + " + (x * y) + ".";
    } else if (type === 2) {
      n = int(r, 23, 89); prompt = "Calculate " + n + " × 11 mentally."; answer = n * 11;
      title = "The elevens"; explanation = "For a two-digit number, add its digits and place the sum between them, carrying if needed.";
    } else if (type === 3) {
      n = int(r, 16, 48); prompt = "Calculate " + n + " × 25 mentally."; answer = n * 25;
      title = "Quarter hundreds"; explanation = "Multiplying by 25 is the same as multiplying by 100, then dividing by 4.";
    } else {
      n = int(r, 160, 360); base = Math.floor(n / 20) * 20; prompt = "What is 15% of " + base + "?"; answer = base * 0.15;
      title = "Percent split"; explanation = "15% is 10% plus 5%: find one tenth, then add half of that.";
    }
    return { id: "clever-" + date, track: "B", title, prompt, answer, explanation };
  }
  function dailyProblem(date, bank) {
    const day = weekday(date);
    if (day === 0) {
      const enabled = bank.filter((item) => item && item.enabled !== false && typeof item.prompt === "string" && Number.isFinite(Number(item.answer)));
      if (!enabled.length) throw new Error("Add at least one enabled Sunday problem to data/mental-math-curated.json.");
      const week = Math.floor(utcDay(date) / 604800000);
      const item = enabled[((week % enabled.length) + enabled.length) % enabled.length];
      return { id: "curated-" + (item.id || week) + "-" + date, track: "B", title: item.title || "Sunday selection",
        prompt: item.prompt, answer: Number(item.answer), explanation: item.explanation || null };
    }
    return [1, 3, 5].includes(day) ? hardProblem(date) : cleverProblem(date);
  }
  function readGame(date) {
    try {
      const value = JSON.parse(localStorage.getItem(STORE + date) || "null");
      if (!value || value.date !== date || !value.problem || !["playing", "complete"].includes(value.status)) return null;
      return value;
    } catch (_) { return null; }
  }
  function saveGame() {
    try { localStorage.setItem(STORE + state.date, JSON.stringify(state)); }
    catch (_) { /* Current tab remains playable if storage is unavailable. */ }
  }
  const formatTime = (ms) => {
    const cs = Math.floor(Math.max(0, ms) / 10), sec = Math.floor(cs / 100);
    return Math.floor(sec / 60) + ":" + pad(sec % 60) + "." + pad(cs % 100);
  };
  const screen = document.createElement("main");
  screen.id = "mentalMathScreen"; screen.className = "mental-screen hidden";
  screen.setAttribute("aria-labelledby", "mmTitle");
  screen.innerHTML = [
    '<section class="mm-card"><div class="mm-kicker">DAILY CHALLENGE</div>',
    '<h1 id="mmTitle">Mental Math</h1><p class="mm-intro" id="mmIntro"></p><div class="mm-meta" id="mmMeta"></div>',
    '<div class="mm-intro-actions" id="mmIntroActions"><button class="btn primary mm-start" id="mmStart" type="button">Start Challenge</button></div>',
    '<section class="mm-play hidden" id="mmPlay" aria-live="polite"><div class="mm-clock" id="mmClock" aria-label="Elapsed time">0:00.00</div>',
    '<div class="mm-question" id="mmQuestion"></div>',
    '<form class="mm-answer-form" id="mmAnswerForm"><label class="mm-label" for="mmAnswer">Your answer</label>',
    '<div class="mm-answer-row"><input id="mmAnswer" name="answer" type="text" inputmode="decimal" autocomplete="off" autocapitalize="off" spellcheck="false" aria-describedby="mmFeedback" />',
    '<button class="btn primary" id="mmSubmit" type="submit">Check</button></div></form>',
    '<p class="mm-feedback" id="mmFeedback" role="status" aria-live="polite"></p><p class="mm-attempts" id="mmAttempts"></p></section>',
    '<section class="mm-result hidden" id="mmResult" aria-live="polite"><div class="mm-result-label">CHALLENGE COMPLETE</div>',
    '<div class="mm-final-time" id="mmFinalTime"></div><p id="mmResultText"></p><div class="mm-explanation hidden" id="mmExplanation"></div></section></section>'
  ].join("");
  document.body.appendChild(screen);

  let bank = [], currentDate = today(), state = null, interval = null, active = false;
  const el = (id) => document.getElementById(id);
  
  function stopClock() { if (interval) clearInterval(interval); interval = null; }
  function elapsed() { return state.status === "complete" ? state.elapsedMs : Math.max(0, Date.now() - state.startedAt); }
  function paintClock() { if (state && state.status === "playing") el("mmClock").textContent = formatTime(elapsed()); }
  function startClock() {
    stopClock(); paintClock();
    interval = setInterval(() => { if (today() !== currentDate) { activate(); return; } paintClock(); }, 50);
  }
  function showIntro(problem) {
    el("mmIntro").textContent = "One problem a day - come back Sundays for an interesting problem. Clock starts when you begin and keeps running until the correct answer.";
    el("mmMeta").textContent = problem.title + " · Track " + problem.track + " · " + currentDate;
    el("mmIntroActions").classList.remove("hidden"); el("mmPlay").classList.add("hidden"); el("mmResult").classList.add("hidden");
  }
  function showPlaying() {
    el("mmIntroActions").classList.add("hidden"); el("mmPlay").classList.remove("hidden"); el("mmResult").classList.add("hidden");
    el("mmMeta").textContent = state.problem.title + " · Track " + state.problem.track + " · " + currentDate;
    el("mmQuestion").textContent = state.problem.prompt;
    el("mmAttempts").textContent = state.attempts + (state.attempts === 1 ? " attempt" : " attempts");
    el("mmFeedback").textContent = state.attempts ? "Keep going. Your timer is still running." : "";
    el("mmAnswer").value = ""; el("mmAnswer").disabled = false; el("mmSubmit").disabled = false; startClock();
  }
  function showComplete() {
    stopClock(); el("mmIntroActions").classList.add("hidden"); el("mmPlay").classList.add("hidden"); el("mmResult").classList.remove("hidden");
    el("mmMeta").textContent = state.problem.title + " · " + currentDate;
    el("mmFinalTime").textContent = formatTime(state.elapsedMs);
    const tries = state.attempts + 1;
    el("mmResultText").textContent = "Solved in " + tries + (tries === 1 ? " try." : " tries.") + " Your daily challenge is recorded on this browser.";
    if (state.problem.explanation) { el("mmExplanation").textContent = state.problem.explanation; el("mmExplanation").classList.remove("hidden"); }
    else el("mmExplanation").classList.add("hidden");
  }
  function showLoadError(message) {
    el("mmIntro").textContent = message; el("mmMeta").textContent = "Challenge unavailable";
    el("mmIntroActions").classList.add("hidden"); el("mmPlay").classList.add("hidden"); el("mmResult").classList.add("hidden");
  }
  function activate() {
    stopClock(); currentDate = today(); state = readGame(currentDate);
    if (!state) {
      let problem;
      try { problem = dailyProblem(currentDate, bank); } catch (error) { showLoadError(error.message); return; }
      state = { date: currentDate, problem, status: "not-started", startedAt: null, completedAt: null, elapsedMs: null, attempts: 0 };
    }
    if (state.status === "complete") showComplete(); else if (state.status === "playing") showPlaying(); else showIntro(state.problem);
  }
  function startChallenge() {
    if (!state || state.status !== "not-started") return;
    state.status = "playing"; state.startedAt = Date.now(); state.attempts = 0; saveGame(); showPlaying(); el("mmAnswer").focus();
  }
  function submitAnswer(event) {
    event.preventDefault(); if (!state || state.status !== "playing") return;
    const raw = el("mmAnswer").value.trim().replace(/,/g, "");
    if (!raw || !Number.isFinite(Number(raw))) { el("mmFeedback").textContent = "Enter a number to check."; el("mmAnswer").focus(); return; }
    if (Number(raw) === state.problem.answer) {
      state.status = "complete"; state.completedAt = Date.now(); state.elapsedMs = Math.max(0, state.completedAt - state.startedAt); saveGame(); showComplete(); confetti();
    } else {
      state.attempts += 1; saveGame();
      el("mmAttempts").textContent = state.attempts + (state.attempts === 1 ? " attempt" : " attempts");
      el("mmFeedback").textContent = "Not quite! Try again, the clock is running. "; el("mmAnswer").select();
    }
  }
  el("mmStart").addEventListener("click", startChallenge);
  el("mmAnswerForm").addEventListener("submit", submitAnswer);
  wheel.addEventListener("puzzleselect", (event) => {
    active = !!(event.detail && event.detail.id === "mental-math"); screen.classList.toggle("hidden", !active);
    if (active) { app.classList.add("hidden"); soon.classList.add("hidden"); activate(); } else stopClock();
  });
  window.addEventListener("storage", (event) => { if (event.key === STORE + currentDate && active) activate(); });
  fetch("data/mental-math-curated.json", { cache: "no-store" })
    .then((response) => { if (!response.ok) throw new Error("Could not load the Sunday problem bank."); return response.json(); })
    .then((data) => { bank = Array.isArray(data) ? data : (data.problems || []); if (active) activate(); })
    .catch((error) => {
      console.error("[Mental Math] Curated bank failed to load:", error);
      if (active && weekday(currentDate) === 0) showLoadError("Sunday's challenge could not be loaded. Check the curated JSON file and refresh.");
      else if (active) activate();
    });
})();
