# Open-Puzzles

Open-Puzzles is a daily math puzzle site in the spirit of Wordle and the Countdown numbers game. 

# Operdle: 

Each day everyone gets the same six numbers and the same target between 100 and 999. Players have six tries to build an arithmetic expression (+ − × ÷ and brackets) that hits the target exactly. 

## Features

- **Deterministic daily puzzle.** The local date (`YYYY-MM-DD`) seeds a Mulberry32 PRNG, so every player sees the same numbers and target. Targets are built from the day's numbers, so every puzzle is guaranteed to be solvable.
- **Countdown rules.** Each number can be used once per try. Division must be exact and intermediate results can't go negative.
- **Feedback on every try.** Exact, close (within 10 points or 5%, whichever is larger), or far, each with the signed distance.
- **Tap-to-build expression builder.** It includes Undo, Clear and Submit, plus full keyboard support.
- **Shareable emoji grid**, along with stats, streaks, a solve distribution, and a countdown to the next puzzle.
- **Progress saved in `localStorage`**, so a refresh doesn't lose today's game.

## Tech

Everything lives in one static file, `public/index.html`, with vanilla HTML, CSS and JavaScript. There are no dependencies and no build step. It is hosted on Netlify. 
## Run locally

Open `public/index.html` in a browser, or serve the folder:

```bash
npx serve public
# or, with Netlify emulation
netlify dev
```

This is something that is more for myself, but I would love if other people used it. If you want to connect, email me at pcy@umich.edu 
