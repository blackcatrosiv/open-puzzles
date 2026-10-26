# AGENTS.md

## Architecture
- `public/index.html` is the whole app: markup, `<style>`, and one IIFE `<script>`. It's a deliberate single-file design with no framework, no bundler and no build step. Keep it that way unless the owner asks otherwise.
- `netlify.toml` publishes `public/`. No functions and no server.

## Script layout (in order)
1. Helpers and date utilities. Puzzle numbers count from `LAUNCH_DATE` (2026-10-24 = #1).
2. PRNG: `xmur3` string hash → `mulberry32`. The seed string is `"operand:" + YYYY-MM-DD` (local date). **Changing the seed, the number recipe, or the RNG call order changes every past and future puzzle.** Treat it as a breaking change.
3. `generatePuzzle(date)` draws `TILE_COUNT` (4) numbers from 2–12 one at a time, each available value equally likely. 2–6 can repeat without limit; 7–12 at most twice. It enumerates (subset-mask DP) every value reachable using **all four** numbers with rule-valid operations, counting the ways to reach each, then picks the target from the `PICK_FROM` rarest values under 500 (no lower bound). One derivation is rebuilt by `exprString` as `solution` and shown after the game ends.
4. `evaluate(tokens, numbers)` is a recursive-descent parser with standard precedence. It throws `RuleError` for zero or negative intermediates, non-integer division, or divide-by-zero.
5. Persistence: `localStorage` keys prefixed `operand:v1:` (`game:v5:<date>`, `stats`, `seenHelp`). Bump the game key version whenever the puzzle recipe changes.
6. Rendering is done by plain `render*()` functions that rebuild innerHTML. There's no virtual DOM.

## Conventions
- Expression tokens: `{t:"n", i}` (tile index, not value, because duplicate values are allowed), `{t:"op", v:"+|-|*|/"}`, `{t:"lp"}`, `{t:"rp"}`.
- A submission must use all four tiles; `builderState().complete` enforces it.
- Closeness tolerance is `max(10, round(target * 5%))`.
- The live builder status deliberately does **not** reveal the expression's value before submission, because that would make the six tries meaningless. It only flags rule violations.
- Share text uses one square per number used (🟩 exact, 🟨 close, 🟦 far; ⬛ unused can no longer occur since all four are required) plus the signed distance.
