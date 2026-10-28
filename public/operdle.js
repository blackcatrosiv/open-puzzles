export function confetti() {
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const wrap = document.createElement("div");
  wrap.className = "confetti";
  const colors = ["#c6f36b", "#4ade80", "#fbbf24", "#38bdf8", "#f472b6", "#e8eaf0"];
  for (let i = 0; i < 90; i++) {
    const p = document.createElement("i");
    p.style.left = Math.random() * 100 + "vw";
    p.style.background = colors[i % colors.length];
    p.style.setProperty("--dx", (Math.random() * 200 - 100) + "px");
    p.style.setProperty("--rot", (Math.random() * 900 - 450) + "deg");
    p.style.animationDuration = 1.8 + Math.random() * 1.6 + "s";
    p.style.animationDelay = Math.random() * 0.4 + "s";
    wrap.appendChild(p);
  }
  document.body.appendChild(wrap);
  setTimeout(() => wrap.remove(), 4200);
}

(() => {
  "use strict";

  /* ---------- Constants & helpers ---------- */
  const MAX_ROWS = 6;
  const TILE_COUNT = 4; // numbers per puzzle; every one must be used
  const LAUNCH_DATE = "2026-10-24"; // Puzzle #1
  const STORE_PREFIX = "operand:v1:";
  const $ = (id) => document.getElementById(id);
  const pad = (n) => String(n).padStart(2, "0");
  const OP_DISPLAY = { "+": "+", "-": "−", "*": "×", "/": "÷" };

  function localDateStr(d = new Date()) {
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }
  function dateToUTC(s) {
    const [y, m, d] = s.split("-").map(Number);
    return Date.UTC(y, m - 1, d);
  }
  function shiftDate(s, days) {
    const d = new Date(dateToUTC(s) + days * 86400000);
    return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
  }
  function puzzleNumber(s) {
    return Math.max(1, Math.round((dateToUTC(s) - dateToUTC(LAUNCH_DATE)) / 86400000) + 1);
  }
  const fmtSigned = (n, minus = "−") => (n > 0 ? `+${n}` : n < 0 ? `${minus}${Math.abs(n)}` : "0");

  /* ---------- Seeded PRNG (xmur3 hash → mulberry32) ---------- */
  function xmur3(str) {
    let h = 1779033703 ^ str.length;
    for (let i = 0; i < str.length; i++) {
      h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
      h = (h << 13) | (h >>> 19);
    }
    return () => {
      h = Math.imul(h ^ (h >>> 16), 2246822507);
      h = Math.imul(h ^ (h >>> 13), 3266489909);
      return (h ^= h >>> 16) >>> 0;
    };
  }
  function mulberry32(a) {
    return () => {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* ---------- Daily puzzle generation ----------
     Four numbers from 2–12 are drawn one at a time, each value equally likely
     (no 1s, so there are no free "× 1" moves). 2–6 can repeat any number of
     times; 7–12 can appear at most twice. Every value reachable by combining *all four* with
     rule-valid operations is enumerated, along with how many distinct ways
     reach it. The target is picked from the rarest values under 500, so every
     puzzle is solvable but has very few routes. */
  const GEN_CAP = 10000; // ignore intermediates above this while enumerating
  const PICK_FROM = 40;  // choose among this many hardest targets
  function generatePuzzle(dateStr) {
    const rand = mulberry32(xmur3("operand:" + dateStr)());
    const numbers = [];
    while (numbers.length < TILE_COUNT) {
      const avail = [];
      for (let n = 2; n <= 12; n++) {
        if (n <= 6 || numbers.filter((x) => x === n).length < 2) avail.push(n);
      }
      numbers.push(avail[Math.floor(rand() * avail.length)]);
    }
    numbers.sort((a, b) => a - b);

    // ways[mask]: value → number of expressions using exactly those tiles
    // how[mask]:  value → one way to build it [leftMask, leftVal, op, rightMask, rightVal]
    const FULL = (1 << TILE_COUNT) - 1;
    const ways = Array.from({ length: FULL + 1 }, () => new Map());
    const how = Array.from({ length: FULL + 1 }, () => new Map());
    numbers.forEach((n, i) => ways[1 << i].set(n, 1));
    const bits = (m) => { let c = 0; for (; m; m >>= 1) c += m & 1; return c; };
    const masks = Array.from({ length: FULL }, (_, i) => i + 1).sort((a, b) => bits(a) - bits(b));
    for (const m of masks) {
      if (bits(m) < 2) continue;
      const W = ways[m], H = how[m];
      const add = (v, c, rec) => {
        if (v <= 0 || v > GEN_CAP) return;
        const prev = W.get(v);
        if (prev === undefined) { W.set(v, c); H.set(v, rec); } else W.set(v, prev + c);
      };
      for (let a = (m - 1) & m; a > 0; a = (a - 1) & m) {
        const b = m ^ a;
        if (a < b) continue; // each unordered split once
        for (const [x, cx] of ways[a]) for (const [y, cy] of ways[b]) {
          const c = cx * cy;
          add(x + y, c, [a, x, "+", b, y]);
          if (x > 1 && y > 1) add(x * y, c, [a, x, "*", b, y]);
          if (x > y) add(x - y, c, [a, x, "-", b, y]);
          else if (y > x) add(y - x, c, [b, y, "-", a, x]);
          if (y > 1 && x % y === 0) add(x / y, c, [a, x, "/", b, y]);
          if (x > 1 && y % x === 0 && x !== y) add(y / x, c, [b, y, "/", a, x]);
        }
      }
    }

    let cands = [...ways[FULL]].filter(([v]) => v <= 499);
    // Practically unreachable: fall back to any result.
    if (!cands.length) cands = [...ways[FULL]];
    cands.sort((p, q) => p[1] - q[1] || p[0] - q[0]);
    const pool = cands.slice(0, PICK_FROM);
    const target = pool[Math.floor(rand() * pool.length)][0];
    return { numbers, target, solution: exprString(how, FULL, target).s };
  }
  // Rebuild a stored derivation with only the brackets precedence needs.
  const PREC = { "+": 1, "-": 1, "*": 2, "/": 2 };
  function exprString(how, mask, value) {
    const rec = how[mask].get(value);
    if (!rec) return { s: String(value), p: 3 };
    const [lm, lv, op, rm, rv] = rec;
    const L = exprString(how, lm, lv), R = exprString(how, rm, rv);
    const p = PREC[op];
    const ls = L.p < p ? `(${L.s})` : L.s;
    const rs = R.p < p || (R.p === p && (op === "-" || op === "/")) ? `(${R.s})` : R.s;
    return { s: `${ls} ${OP_DISPLAY[op]} ${rs}`, p };
  }

  /* ---------- Expression evaluation ----------
     Tokens: {t:"n", i} number tile index · {t:"op", v} · {t:"lp"} · {t:"rp"}.
     Standard precedence via recursive descent; every intermediate result
     is checked against the rules. */
  class RuleError extends Error {}
  function evaluate(tokens, numbers) {
    let pos = 0;
    const peek = () => tokens[pos];
    const apply = (l, op, r) => {
      switch (op) {
        case "+": return l + r;
        case "-":
          if (r >= l) throw new RuleError(`${l} − ${r} isn't positive`);
          return l - r;
        case "*": return l * r;
        case "/":
          if (r === 0) throw new RuleError("Can't divide by zero");
          if (l % r !== 0) throw new RuleError(`${l} ÷ ${r} isn't a whole number`);
          return l / r;
      }
    };
    function expr() {
      let v = term();
      while (peek() && peek().t === "op" && (peek().v === "+" || peek().v === "-")) {
        const op = tokens[pos++].v;
        v = apply(v, op, term());
      }
      return v;
    }
    function term() {
      let v = factor();
      while (peek() && peek().t === "op" && (peek().v === "*" || peek().v === "/")) {
        const op = tokens[pos++].v;
        v = apply(v, op, factor());
      }
      return v;
    }
    function factor() {
      const tk = tokens[pos++];
      if (!tk) throw new RuleError("Finish the expression");
      if (tk.t === "n") return numbers[tk.i];
      if (tk.t === "lp") {
        const v = expr();
        const c = tokens[pos++];
        if (!c || c.t !== "rp") throw new RuleError("Close your brackets");
        return v;
      }
      throw new RuleError("That expression doesn't parse");
    }
    const value = expr();
    if (pos < tokens.length) throw new RuleError("That expression doesn't parse");
    return value;
  }

  /* ---------- Persistence ---------- */
  const store = {
    get(key, fallback) {
      try { const v = localStorage.getItem(STORE_PREFIX + key); return v ? JSON.parse(v) : fallback; }
      catch { return fallback; }
    },
    set(key, value) {
      try { localStorage.setItem(STORE_PREFIX + key, JSON.stringify(value)); } catch {}
    },
  };
  const defaultStats = () => ({ played: 0, wins: 0, streak: 0, maxStreak: 0, lastWin: null, dist: [0, 0, 0, 0, 0, 0] });

  /* ---------- State ---------- */
  const TODAY = localDateStr();
  const PUZZLE_NO = puzzleNumber(TODAY);
  const P = generatePuzzle(TODAY);
  const TOLERANCE = Math.max(10, Math.round(P.target * 0.05));
  // Bumped whenever the puzzle recipe changes, since old saves index different tiles
  // (v2: "use all six"; v3: unlimited repeats of 2–6; v4: targets under 500; v5: four numbers)
  const GAME_KEY = "game:v5:" + TODAY;
  let game = store.get(GAME_KEY, null) || { attempts: [], status: "playing", counted: false };
  let stats = store.get("stats", defaultStats());
  let tokens = [];
  let lastAddedRow = -1;

  function classify(value) {
    const diff = value - P.target;
    const ad = Math.abs(diff);
    return { diff, kind: ad === 0 ? "exact" : ad <= TOLERANCE ? "close" : "far" };
  }

  function builderState() {
    let depth = 0;
    for (const tk of tokens) { if (tk.t === "lp") depth++; else if (tk.t === "rp") depth--; }
    const last = tokens[tokens.length - 1];
    const afterValue = !!last && (last.t === "n" || last.t === "rp");
    const playing = game.status === "playing";
    const used = new Set(tokens.filter((t) => t.t === "n").map((t) => t.i));
    const left = P.numbers.length - used.size;
    return {
      depth,
      used,
      left,
      canNum: playing && !afterValue,
      canOp: playing && afterValue,
      canLp: playing && !afterValue,
      canRp: playing && afterValue && depth > 0,
      complete: tokens.length > 0 && afterValue && depth === 0 && left === 0,
      reason: !tokens.length ? "Build an expression first"
        : depth > 0 && afterValue ? "Close your brackets"
        : left > 0 ? `Use all four numbers (${left} left)` : "Finish the expression",
    };
  }

  /* ---------- Rendering ---------- */
  function exprHTML(toks) {
    return toks.map((tk) => {
      if (tk.t === "n") return `<span class="chip">${P.numbers[tk.i]}</span>`;
      if (tk.t === "op") return `<span class="sym">${OP_DISPLAY[tk.v]}</span>`;
      return `<span class="sym paren">${tk.t === "lp" ? "(" : ")"}</span>`;
    }).join("");
  }

  function renderStatic() {
    const d = new Date(dateToUTC(TODAY));
    const label = d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });
    $("puzzleMeta").textContent = `#${PUZZLE_NO} · ${label}`;
    $("target").textContent = P.target;

    $("numbers").innerHTML = P.numbers.map((n, i) =>
      `<button class="tile" data-i="${i}" aria-label="Number ${n}">${n}</button>`).join("");
    const ops = [["+", "op"], ["-", "op"], ["*", "op"], ["/", "op"], ["(", "lp"], [")", "rp"]];
    $("ops").innerHTML = ops.map(([v, t]) =>
      `<button class="op${t !== "op" ? " paren" : ""}" data-t="${t}" data-v="${v}" aria-label="${t === "op" ? OP_DISPLAY[v] : v}">${t === "op" ? OP_DISPLAY[v] : v}</button>`).join("");
  }

  function renderHistory() {
    const rows = [];
    for (let r = 0; r < MAX_ROWS; r++) {
      const a = game.attempts[r];
      if (a) {
        const used = a.tokens.filter((t) => t.t === "n").map((t) => t.i).join(",");
        const badge = a.kind === "exact" ? "🎯 Exact" : `${a.kind === "close" ? "🔥" : "🧊"} Off by ${fmtSigned(a.diff)}`;
        rows.push(`<div class="row ${a.kind}${r === lastAddedRow ? " enter" : ""}" data-used="${used}">
          <span class="row-n">${r + 1}</span>
          <span class="row-expr">${exprHTML(a.tokens)}</span>
          <span class="row-right"><span class="row-val">${a.value}</span><span class="badge">${badge}</span></span>
        </div>`);
      } else {
        const active = game.status === "playing" && r === game.attempts.length;
        rows.push(`<div class="row empty${active ? " active" : ""}">
          <span class="row-n">${r + 1}</span>
          <span class="row-hint">${active ? "Your next try" : ""}</span><span></span>
        </div>`);
      }
    }
    $("history").innerHTML = rows.join("");
    lastAddedRow = -1;

    $("pips").innerHTML = Array.from({ length: MAX_ROWS }, (_, r) => {
      const a = game.attempts[r];
      const cls = a ? a.kind : game.status === "playing" && r === game.attempts.length ? "current" : "";
      return `<span class="pip ${cls}"></span>`;
    }).join("");
    const left = MAX_ROWS - game.attempts.length;
    $("triesLeft").innerHTML = game.status === "won" ? "Solved!" : game.status === "lost" ? "Out of tries" : `<b>${left}</b> ${left === 1 ? "try" : "tries"} left`;
  }

  function renderBuilder() {
    const st = builderState();
    const order = tokens.filter((t) => t.t === "n").map((t) => t.i);
    document.querySelectorAll(".tile").forEach((el) => {
      const i = Number(el.dataset.i);
      const used = st.used.has(i);
      el.classList.toggle("used", used);
      el.disabled = used || !st.canNum;
      el.innerHTML = `${P.numbers[i]}${used ? `<span class="order">${order.indexOf(i) + 1}</span>` : ""}`;
    });
    document.querySelectorAll(".op").forEach((el) => {
      const t = el.dataset.t;
      el.disabled = t === "op" ? !st.canOp : t === "lp" ? !st.canLp : !st.canRp;
    });

    const f = $("formula");
    $("formulaTokens").innerHTML = tokens.length
      ? exprHTML(tokens) + '<span class="caret"></span>'
      : '<span class="placeholder">Tap numbers and operators to build an expression</span><span class="caret"></span>';

    let status = "", cls = "";
    if (st.complete) {
      try { evaluate(tokens, P.numbers); status = "✓ Looks good. Submit when you're ready."; cls = "ready"; }
      catch (e) { status = e.message; cls = "error"; }
    } else if (tokens.length) {
      const parts = [];
      if (st.left) parts.push(`${st.left} number${st.left > 1 ? "s" : ""} left`);
      if (st.depth) parts.push(`${st.depth} open bracket${st.depth > 1 ? "s" : ""}`);
      status = parts.join(" · ") || "Keep going…";
    } else {
      status = `Use all four numbers. Close counts within ${TOLERANCE} of the target`;
    }
    f.classList.toggle("ready", cls === "ready");
    f.classList.toggle("error", cls === "error");
    $("formulaStatus").textContent = status;

    $("undoBtn").disabled = !tokens.length || game.status !== "playing";
    $("clearBtn").disabled = !tokens.length || game.status !== "playing";
    $("submitBtn").disabled = game.status !== "playing" || cls !== "ready";
  }

  function renderEnd() {
    const over = game.status !== "playing";
    $("builder").classList.toggle("hidden", over);
    $("finished").classList.toggle("hidden", !over);
    if (!over) return;
    if (game.status === "won") {
      $("finishedTitle").textContent = `🎯 Solved in ${game.attempts.length}/${MAX_ROWS}`;
      $("finishedSub").textContent = "Come back tomorrow for a new target.";
    } else {
      const best = closestAttempt();
      $("finishedTitle").textContent = "Out of tries";
      $("finishedSub").textContent = `Closest: ${best.value} (off by ${fmtSigned(best.diff)}). A new puzzle arrives at midnight.`;
    }
  }

  function render() { renderHistory(); renderBuilder(); renderEnd(); }

  /* ---------- Actions ---------- */
  function push(tk) {
    const st = builderState();
    const ok = tk.t === "n" ? st.canNum && !st.used.has(tk.i)
      : tk.t === "op" ? st.canOp : tk.t === "lp" ? st.canLp : st.canRp;
    if (!ok) return false;
    tokens.push(tk);
    renderBuilder();
    return true;
  }
  function undo() { if (tokens.length && game.status === "playing") { tokens.pop(); renderBuilder(); } }
  function clearExpr() { if (game.status === "playing") { tokens = []; renderBuilder(); } }

  function shake(msg) {
    const f = $("formula");
    f.classList.remove("shake"); void f.offsetWidth; f.classList.add("shake");
    if (msg) toast(msg);
  }

  function submit() {
    if (game.status !== "playing") return;
    const st = builderState();
    if (!st.complete) return shake(st.reason);
    let value;
    try { value = evaluate(tokens, P.numbers); }
    catch (e) { return shake(e.message); }

    const { diff, kind } = classify(value);
    game.attempts.push({ tokens: tokens.slice(), value, diff, kind });
    lastAddedRow = game.attempts.length - 1;
    tokens = [];
    if (kind === "exact") game.status = "won";
    else if (game.attempts.length >= MAX_ROWS) game.status = "lost";

    if (game.status !== "playing" && !game.counted) recordStats();
    store.set(GAME_KEY, game);
    render();

    if (game.status === "won") {
      confetti();
      setTimeout(() => openResults(true), 1300);
    } else if (game.status === "lost") {
      setTimeout(() => openResults(true), 900);
    } else {
      toast(kind === "close" ? `🔥 Close! Off by ${fmtSigned(diff)}` : `🧊 Off by ${fmtSigned(diff)}`);
    }
  }

  function recordStats() {
    stats.played++;
    if (game.status === "won") {
      stats.wins++;
      stats.dist[game.attempts.length - 1]++;
      stats.streak = stats.lastWin === shiftDate(TODAY, -1) ? stats.streak + 1 : 1;
      stats.lastWin = TODAY;
      stats.maxStreak = Math.max(stats.maxStreak, stats.streak);
    } else {
      stats.streak = 0;
    }
    game.counted = true;
    store.set("stats", stats);
  }
  function currentStreak() {
    return stats.lastWin === TODAY || stats.lastWin === shiftDate(TODAY, -1) ? stats.streak : 0;
  }
  function closestAttempt() {
    return game.attempts.reduce((best, a) => (!best || Math.abs(a.diff) < Math.abs(best.diff) ? a : best), null);
  }

  /* ---------- Sharing ---------- */
  function shareText() {
    const score = game.status === "won" ? `${game.attempts.length}/${MAX_ROWS}` : `X/${MAX_ROWS}`;
    const lines = [`Operdle #${PUZZLE_NO} · ${TODAY}`, `🎯 ${P.target} · ${score}`, ""];
    for (const a of game.attempts) {
      const usedCount = a.tokens.filter((t) => t.t === "n").length;
      const sq = a.kind === "exact" ? "🟩" : a.kind === "close" ? "🟨" : "🟦";
      const squares = sq.repeat(usedCount) + "⬛".repeat(TILE_COUNT - usedCount);
      lines.push(`${squares} ${a.kind === "exact" ? "🎯" : fmtSigned(a.diff, "-")}`);
    }
    lines.push("", location.origin + location.pathname.replace(/index\.html$/, ""));
    return lines.join("\n");
  }

  async function copyResults() {
    const text = shareText();
    let ok = false;
    try { await navigator.clipboard.writeText(text); ok = true; }
    catch {
      const ta = document.createElement("textarea");
      ta.value = text; ta.setAttribute("readonly", ""); ta.style.position = "fixed"; ta.style.opacity = "0";
      document.body.appendChild(ta); ta.select();
      try { ok = document.execCommand("copy"); } catch {}
      ta.remove();
    }
    toast(ok ? "Results copied to clipboard" : "Couldn't copy. Select the text above instead");
  }

  /* ---------- Modals ---------- */
  let countdownTimer = null;
  function openModal(id) {
    $(id).classList.remove("hidden");
    const first = $(id).querySelector(".btn.primary, .close-x");
    if (first) first.focus({ preventScroll: true });
  }
  function closeModal(el) {
    el.classList.add("hidden");
    if (el.id === "resultsModal") clearInterval(countdownTimer);
  }

  function openResults() {
    const over = game.status !== "playing";
    $("resultBlock").classList.toggle("hidden", !over);
    $("copyBtn").classList.toggle("hidden", !over);
    if (over) {
      const won = game.status === "won";
      const n = game.attempts.length;
      $("resultEmoji").textContent = won ? (n === 1 ? "🏆" : n <= 3 ? "🎯" : "✅") : "🧮";
      $("resultsTitle").textContent = won
        ? (n === 1 ? "First try. Bullseye!" : n <= 3 ? "Sharp work!" : "Got there!")
        : "So close";
      const best = closestAttempt();
      $("resultSub").textContent = won
        ? `You hit ${P.target} in ${n} ${n === 1 ? "try" : "tries"}.`
        : `Your closest was ${best.value}, off by ${fmtSigned(best.diff)}.`;
      $("solution").innerHTML = `<span>${won ? "Another route" : "One way to get there"}</span>${P.solution} = ${P.target}`;
      $("sharePreview").textContent = shareText();
    }
    const winPct = stats.played ? Math.round((stats.wins / stats.played) * 100) : 0;
    $("stats").innerHTML = [
      [stats.played, "Played"], [winPct, "Win %"], [currentStreak(), "Streak"], [stats.maxStreak, "Best"],
    ].map(([v, l]) => `<div class="stat"><b>${v}</b><span>${l}</span></div>`).join("");
    const maxD = Math.max(1, ...stats.dist);
    $("dist").innerHTML = stats.dist.map((c, i) => {
      const hl = game.status === "won" && game.attempts.length === i + 1;
      return `<div class="dist-row"><span>${i + 1}</span><div class="dist-bar${hl ? " hl" : ""}" style="width:${Math.max(8, (c / maxD) * 100)}%">${c}</div></div>`;
    }).join("");

    const tick = () => {
      const now = new Date();
      const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
      const s = Math.max(0, Math.floor((next - now) / 1000));
      $("countdown").textContent = `${pad(Math.floor(s / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`;
      if (s === 0) location.reload();
    };
    tick();
    clearInterval(countdownTimer);
    countdownTimer = setInterval(tick, 1000);
    openModal("resultsModal");
  }

  /* ---------- Toast & confetti ---------- */
  let toastTimer = null;
  function toast(msg) {
    const t = $("toast");
    t.textContent = msg;
    t.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove("show"), 1800);
  }
  /* ---------- Puzzle wheel ---------- */
  // Slice i sits at 3 o'clock (in focus) when rot = -i * STEP. Angles are in degrees,
  // geometry is in the SVG's 640-unit viewBox with the pivot at (0, 0).
  const PUZZLES = [
    { id: "operdle", name: "Operdle", glyph: "±", color: "#c6f36b", live: true },
    { id: "mental-math", name: "Mental Math", glyph: "×", color: "#ff7a59", live: true, blurb: "One daily mental-math challenge. Start the clock when you are ready." },
    { id: "tbd-1", name: "TBD", glyph: "?", color: "#a78bfa", kicker: "Under construction", title: "Hard hats on", blurb: "Something clever is being bolted together back here. Mind the loose numbers on your way out." },
    { id: "tbd-2", name: "TBD", glyph: "?", color: "#38bdf8", kicker: "Still brewing", title: "Puzzle loading…", blurb: "…at roughly the speed of a kettle you're staring at. Check back soon." },
    { id: "tbd-3", name: "TBD", glyph: "?", color: "#fbbf24", kicker: "Top secret", title: "Classified", blurb: "This slot is reserved for a puzzle so good we can't talk about it yet. (We also haven't made it.)" },
    { id: "tbd-4", name: "TBD", glyph: "?", color: "#f472b6", kicker: "Coming soon", title: "Nothing to see… yet", blurb: "You've found an empty slice. Points for curiosity, and a new puzzle will fill it soon." },
    { id: "tbd-5", name: "TBD", glyph: "?", color: "#2dd4bf", kicker: "Work in progress", title: "Sketching it out", blurb: "There's a whiteboard, three markers and a lot of arrows. A puzzle is in there somewhere." },
    { id: "tbd-6", name: "TBD", glyph: "?", color: "#fb923c", kicker: "Out to lunch", title: "Back in five", blurb: "Give or take a few weeks. In the meantime, today's Operdle won't solve itself." },
  ];
  const WHEEL_N = PUZZLES.length;
  const STEP = 360 / WHEEL_N;
  const R0 = 70, R1 = 270; // slice inner / outer radius
  let activePuzzle = PUZZLES[0].id;

  const wheel = (() => {
    const el = $("puzzleWheel"), rotor = $("pwRotor"), svg = $("pwSlices");
    const handle = $("pwHandle"), scrim = $("pwScrim"), hint = $("pwHint");
    const reduced = matchMedia("(prefers-reduced-motion: reduce)");
    const mod = (a, n) => ((a % n) + n) % n;
    const wrap180 = (a) => mod(a + 180, 360) - 180;
    const polar = (r, deg) => {
      const a = deg * Math.PI / 180;
      return `${(r * Math.cos(a)).toFixed(2)} ${(r * Math.sin(a)).toFixed(2)}`;
    };
    const wedge = (r0, r1, a0, a1) =>
      `M${polar(r0, a0)}L${polar(r1, a0)}A${r1} ${r1} 0 0 1 ${polar(r1, a1)}L${polar(r0, a1)}A${r0} ${r0} 0 0 0 ${polar(r0, a0)}Z`;

    // Build the dial once; only the rotor's transform changes per frame
    let html = `<circle class="pw-disc" r="304"/>`;
    for (let k = 0; k < 64; k++) {
      const major = k % 8 === 0, a = k * (360 / 64) + STEP / 2;
      html += `<path class="pw-tick${major ? " major" : ""}" d="M${polar(major ? 280 : 284, a)}L${polar(294, a)}"/>`;
    }
    PUZZLES.forEach((p, i) => {
      html += `<g class="pw-slice" id="pw-opt-${i}" data-i="${i}" role="option" aria-label="${p.name}${p.live ? "" : ", coming soon"}" style="--c:${p.color}" transform="rotate(${i * STEP})">
        <g class="pw-body">
          <path class="pw-wedge" d="${wedge(R0, R1, -STEP / 2, STEP / 2)}"/>
          <path class="pw-band" d="${wedge(R1 - 9, R1 - 3, -STEP / 2 + 1.6, STEP / 2 - 1.6)}"/>
          <text class="pw-glyph" x="${R0 + 24}" y="0">${p.glyph}</text>
          <text class="pw-name" x="${R0 + 46}" y="-4">${p.name.toUpperCase()}</text>
          <text class="pw-tag" x="${R0 + 47}" y="15">${pad(i + 1)} · ${p.live ? "DAILY" : "SOON"}</text>
        </g>
      </g>`;
    });
    svg.innerHTML = html;
    const slices = [...svg.querySelectorAll(".pw-slice")];
    $("pwHubOf").textContent = "/" + pad(WHEEL_N);

    // Squeeze any label that would run past the rim
    const fitLabels = () => svg.querySelectorAll(".pw-name").forEach((t) => {
      t.removeAttribute("textLength");
      const room = R1 - 16 - Number(t.getAttribute("x"));
      if (t.getComputedTextLength() > room) { t.setAttribute("textLength", room); t.setAttribute("lengthAdjust", "spacingAndGlyphs"); }
    });
    if (document.fonts) document.fonts.ready.then(fitLabels); else fitLabels();

    // Physics: "drag" follows the pointer, "coast" decays momentum, "spring" settles on a target
    let rot = 0, vel = 0, target = 0, phase = "idle";
    let focusIdx = -1, selected = 0, raf = 0, lastT = 0;
    let compact = false, open = false;
    const K = 0.0006, C = 2 * Math.sqrt(K) * 0.72, FRICTION = 0.9955;
    const idxAt = (a) => mod(Math.round(-a / STEP), WHEEL_N);
    const snap = (a) => Math.round(a / STEP) * STEP;
    const angleFor = (i) => rot + wrap180(-i * STEP - rot); // nearest angle that focuses slice i

    function paint() {
      rotor.style.transform = `rotate(${rot.toFixed(3)}deg)`;
      const f = idxAt(rot);
      if (f === focusIdx) return;
      if (focusIdx >= 0) slices[focusIdx].classList.remove("is-focus");
      slices[f].classList.add("is-focus");
      focusIdx = f;
      el.setAttribute("aria-activedescendant", slices[f].id);
      $("pwHubN").textContent = pad(f + 1);
      document.documentElement.style.setProperty("--pw-c", PUZZLES[f].color);
    }

    function frame(t) {
      const dt = Math.min(32, t - (lastT || t)) || 16;
      lastT = t;
      if (phase === "coast") {
        vel *= Math.pow(FRICTION, dt);
        rot += vel * dt;
        if (Math.abs(vel) < 0.06 || reduced.matches) {
          // Land on the next slice boundary in the direction of travel
          target = reduced.matches ? snap(rot) : snap(rot + vel * 120);
          phase = "spring";
        }
      } else if (phase === "spring" || phase === "wheel") {
        if (reduced.matches) { rot = target; vel = 0; }
        else {
          vel += (K * (target - rot) - C * vel) * dt;
          rot += vel * dt;
        }
        if (phase === "spring" && Math.abs(target - rot) < 0.04 && Math.abs(vel) < 0.002) {
          rot = target; vel = 0; phase = "idle";
        }
      }
      paint();
      if (phase === "idle") { raf = 0; lastT = 0; hint.classList.remove("busy"); settle(); return; }
      raf = requestAnimationFrame(frame);
    }
    const kick = () => { hint.classList.add("busy"); if (!raf) raf = requestAnimationFrame(frame); };
    function springTo(a) { target = a; phase = "spring"; kick(); }

    function settle() {
      const f = idxAt(rot);
      if (f !== selected) select(f, "snap");
    }

    function select(i, source) {
      slices[selected].classList.remove("is-active");
      slices[selected].setAttribute("aria-selected", "false");
      selected = i;
      slices[i].classList.add("is-active");
      slices[i].setAttribute("aria-selected", "true");
      el.dispatchEvent(new CustomEvent("puzzleselect", { bubbles: true, detail: { ...PUZZLES[i], index: i, source } }));
      if (compact && open && source === "click") setTimeout(() => setOpen(false), 420);
    }

    // Pointer drag (mouse, touch, pen). A press that barely moves is a click.
    let drag = null, wheelBase = 0, wheelTimer = null;
    const pointerAngle = (e) => {
      const r = el.getBoundingClientRect();
      return Math.atan2(e.clientY - (r.top + r.height / 2), e.clientX - (r.left + r.width / 2)) * 180 / Math.PI;
    };
    el.addEventListener("pointerdown", (e) => {
      if (e.button !== 0) return;
      const s = e.target.closest(".pw-slice");
      drag = { id: e.pointerId, x: e.clientX, y: e.clientY, a: pointerAngle(e), t: performance.now(), slice: s ? Number(s.dataset.i) : -1, moved: false };
      el.setPointerCapture(e.pointerId);
      clearTimeout(wheelTimer);
      phase = "drag"; vel = 0;
      hint.classList.add("busy");
    });
    el.addEventListener("pointermove", (e) => {
      if (!drag || e.pointerId !== drag.id) return;
      if (!drag.moved && Math.hypot(e.clientX - drag.x, e.clientY - drag.y) < 6) return;
      if (!drag.moved) { drag.moved = true; el.classList.add("is-dragging"); }
      const a = pointerAngle(e), now = performance.now();
      const d = wrap180(a - drag.a), dt = Math.max(1, now - drag.t);
      rot += d;
      vel = vel * 0.6 + (d / dt) * 0.4;
      drag.a = a; drag.t = now;
      paint();
    });
    const endDrag = (e) => {
      if (!drag || e.pointerId !== drag.id) return;
      const d = drag;
      drag = null;
      el.classList.remove("is-dragging");
      if (!d.moved) {
        phase = "idle";
        if (d.slice >= 0) { if (d.slice !== selected) select(d.slice, "click"); else if (compact) setOpen(false); springTo(angleFor(d.slice)); }
        else springTo(snap(rot));
        return;
      }
      if (performance.now() - d.t > 80) vel = 0; // held still before letting go
      vel = Math.max(-2.5, Math.min(2.5, vel));
      phase = "coast"; kick();
    };
    el.addEventListener("pointerup", endDrag);
    el.addEventListener("pointercancel", endDrag);

    // Wheel / trackpad: deltas push a free target the spring chases; when input
    // pauses, the target snaps one or more slices on in the direction of travel.
    el.addEventListener("wheel", (e) => {
      e.preventDefault();
      const raw = Math.abs(e.deltaY) >= Math.abs(e.deltaX) ? e.deltaY : e.deltaX;
      const d = raw * (e.deltaMode === 1 ? 33 : e.deltaMode === 2 ? 400 : 1);
      if (phase !== "wheel") { wheelBase = snap(phase === "spring" ? target : rot); target = rot; phase = "wheel"; }
      target -= Math.max(-40, Math.min(40, d * 0.14));
      kick();
      clearTimeout(wheelTimer);
      wheelTimer = setTimeout(() => {
        const moved = target - wheelBase;
        const n = Math.abs(moved) < 2 ? 0 : Math.max(1, Math.round(Math.abs(moved) / STEP));
        springTo(wheelBase + Math.sign(moved) * n * STEP);
      }, 110);
    }, { passive: false });

    // Keyboard: arrows rotate, Home jumps to the first puzzle, Enter/Space confirms
    el.addEventListener("keydown", (e) => {
      const base = phase === "spring" ? target : snap(rot);
      const k = e.key;
      if (k === "ArrowDown" || k === "ArrowRight") springTo(base - STEP);
      else if (k === "ArrowUp" || k === "ArrowLeft") springTo(base + STEP);
      else if (k === "Home") springTo(angleFor(0));
      else if (k === "Enter" || k === " ") { const f = idxAt(base); if (f !== selected) select(f, "click"); else if (compact) setOpen(false); }
      else if (k === "Escape" && compact && open) setOpen(false);
      else { if (k !== "Tab") e.stopPropagation(); return; } // keep game shortcuts out of the wheel
      e.preventDefault(); e.stopPropagation();
    });

    // Layout: sit in the left gutter on wide screens, otherwise tuck behind a tab
    function setOpen(v) {
      open = v && compact;
      el.classList.toggle("is-open", open);
      scrim.classList.toggle("on", open);
      hint.classList.toggle("off", compact && !open);
      el.inert = compact && !open;
      if (open) el.focus({ preventScroll: true });
      else if (compact && document.activeElement === el) handle.focus({ preventScroll: true });
    }
    function layout() {
      const vw = innerWidth, vh = innerHeight;
      const gutter = (vw - 560) / 2 - 20; // room left of the centered game column
      let r = Math.min(300, vh * 0.46);
      compact = gutter < Math.min(r, 230) * 0.95;
      if (!compact) r = Math.min(r, gutter / 0.95);
      else r = Math.min(300, vh * 0.44, vw * 0.88);
      el.style.setProperty("--pw-r", Math.round(r) + "px");
      hint.style.setProperty("--pw-r", Math.round(r) + "px");
      el.classList.toggle("is-compact", compact);
      handle.classList.toggle("show", compact);
      setOpen(open);
    }
    handle.addEventListener("click", () => setOpen(true));
    scrim.addEventListener("click", () => setOpen(false));
    addEventListener("resize", layout);
    layout();

    slices.forEach((s) => s.setAttribute("aria-selected", "false"));
    slices[0].classList.add("is-active");
    slices[0].setAttribute("aria-selected", "true");
    paint();

    return { el, go(i) { if (i !== selected) select(i, "click"); springTo(angleFor(i)); } };
  })();

  // Swap the main view whenever the wheel picks a puzzle
  wheel.el.addEventListener("puzzleselect", (e) => {
    const p = e.detail;
    activePuzzle = p.id;
    if (typeof window.gtag === "function") window.gtag("event", "select_puzzle", { puzzle_id: p.id });
    document.querySelector(".app").classList.toggle("hidden", !p.live);
    $("soonPanel").classList.toggle("hidden", !!p.live);
    if (p.live) return;
    const card = $("soonCard");
    card.style.setProperty("--c", p.color);
    $("soonGlyph").textContent = p.glyph;
    $("soonKicker").textContent = p.kicker || "Coming soon";
    $("soonTitle").textContent = p.title || p.name;
    $("soonBlurb").textContent = p.blurb;
    card.style.animation = "none"; void card.offsetWidth; card.style.animation = "";
  });
  $("soonBack").addEventListener("click", () => wheel.go(0));

  /* ---------- Events ---------- */
  $("numbers").addEventListener("click", (e) => {
    const b = e.target.closest(".tile");
    if (b && !b.disabled) push({ t: "n", i: Number(b.dataset.i) });
  });
  $("ops").addEventListener("click", (e) => {
    const b = e.target.closest(".op");
    if (!b || b.disabled) return;
    push(b.dataset.t === "op" ? { t: "op", v: b.dataset.v } : { t: b.dataset.t });
  });
  $("undoBtn").addEventListener("click", undo);
  $("clearBtn").addEventListener("click", clearExpr);
  $("submitBtn").addEventListener("click", submit);
  $("helpBtn").addEventListener("click", () => openModal("helpModal"));
  $("statsBtn").addEventListener("click", openResults);
  $("viewResultsBtn").addEventListener("click", openResults);
  $("copyBtn").addEventListener("click", copyResults);
  document.querySelectorAll(".backdrop").forEach((bd) => {
    bd.addEventListener("click", (e) => {
      if (e.target === bd || e.target.closest("[data-close]")) closeModal(bd);
    });
  });

  // Hovering/pressing a past attempt highlights the tiles it used
  const peek = (rowEl, on) => {
    if (!rowEl || !rowEl.dataset.used) return;
    const ids = new Set(rowEl.dataset.used.split(",").map(Number));
    document.querySelectorAll(".tile").forEach((t) => t.classList.toggle("peek", on && ids.has(Number(t.dataset.i))));
  };
  $("history").addEventListener("pointerover", (e) => peek(e.target.closest(".row"), true));
  $("history").addEventListener("pointerout", (e) => peek(e.target.closest(".row"), false));

  // Keyboard: typed digits are matched against unused tile values
  let digitBuf = "", digitTimer = null;
  function flushDigits(force) {
    clearTimeout(digitTimer);
    const st = builderState();
    const avail = P.numbers.map((n, i) => ({ n: String(n), i })).filter((x) => !st.used.has(x.i));
    const exact = avail.find((x) => x.n === digitBuf);
    const longer = avail.some((x) => x.n.length > digitBuf.length && x.n.startsWith(digitBuf));
    if (exact && (force || !longer)) { push({ t: "n", i: exact.i }); digitBuf = ""; return; }
    if (!longer || force) { if (!exact && digitBuf) shake(`${digitBuf} isn't available`); digitBuf = ""; return; }
    digitTimer = setTimeout(() => flushDigits(true), 700);
  }
  document.addEventListener("keydown", (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const open = document.querySelector(".backdrop:not(.hidden)");
    if (open) { if (e.key === "Escape") closeModal(open); return; }
    if (activePuzzle !== "operdle" || game.status !== "playing") return;
    const k = e.key;
    if (/^[0-9]$/.test(k)) { digitBuf += k; flushDigits(false); e.preventDefault(); return; }
    if (digitBuf) flushDigits(true);
    const map = { "+": { t: "op", v: "+" }, "-": { t: "op", v: "-" }, "*": { t: "op", v: "*" }, x: { t: "op", v: "*" },
      "/": { t: "op", v: "/" }, "(": { t: "lp" }, ")": { t: "rp" } };
    if (map[k]) { push(map[k]); e.preventDefault(); }
    else if (k === "Backspace") { undo(); e.preventDefault(); }
    else if (k === "Escape") clearExpr();
    else if (k === "Enter") { submit(); e.preventDefault(); }
  });

  /* ---------- Boot ---------- */
  renderStatic();
  render();
  if (!store.get("seenHelp", false)) { openModal("helpModal"); store.set("seenHelp", true); }
})();
