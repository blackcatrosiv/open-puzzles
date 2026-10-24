# AGENTS.md

## Architecture
- `public/index.html` is the whole app: markup, `<style>`, and one IIFE `<script>`. It's a deliberate single-file design with no framework, no bundler and no build step. Keep it that way unless the owner asks otherwise.
- `netlify.toml` publishes `public/`. No functions and no server.

## Script layout (in order)
1. Helpers and date utilities. Puzzle numbers count from `LAUNCH_DATE` (2026-10-24 = #1).
2. PRNG: `xmur3` string hash → `mulberry32`. The seed string is `"operand:" + YYYY-MM-DD` (local date). **Changing the seed, the number recipe, or the RNG call order changes every past and future puzzle.** Treat it as a breaking change.
3. `generatePuzzle(date)` picks 1–3 large numbers from {25,50,75,100} and fills the rest from two decks of 1–10. It builds the target by randomly combining 3–6 numbers with rule-valid operations, so every target is solvable. The generating expression is kept as `solution` and shown after the game ends.
4. `evaluate(tokens, numbers)` is a recursive-descent parser with standard precedence. It throws `RuleError` for negative intermediates, non-integer division, or divide-by-zero.
5. Persistence: `localStorage` keys prefixed `operand:v1:` (`game:<date>`, `stats`, `seenHelp`).
6. Rendering is done by plain `render*()` functions that rebuild innerHTML. There's no virtual DOM.

## Conventions
- Expression tokens: `{t:"n", i}` (tile index, not value, because duplicate values are allowed), `{t:"op", v:"+|-|*|/"}`, `{t:"lp"}`, `{t:"rp"}`.
- Closeness tolerance is `max(10, round(target * 5%))`.
- The live builder status deliberately does **not** reveal the expression's value before submission, because that would make the six tries meaningless. It only flags rule violations.
- Share text uses one square per number used (🟩 exact, 🟨 close, 🟦 far, ⬛ unused) plus the signed distance.
