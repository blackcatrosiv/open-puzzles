# Open-Puzzles

Open-Puzzles is a daily math puzzle site in the spirit of Wordle and the Countdown numbers game. 



## Operdle: 

Each day everyone gets the same four small numbers (2–12; 2–6 can repeat any number of times, 7–12 at most twice) and the same target under 500. Players have six tries to build an arithmetic expression (+ − × ÷ and brackets) that uses all four numbers and hits the target exactly. 

## Features

- **Deterministic daily puzzle.** The local date (`YYYY-MM-DD`) seeds a Mulberry32 PRNG, so every player sees the same numbers and target. Every value reachable with all four numbers is enumerated and the target is picked from the ones with the fewest solutions, so every puzzle is solvable but tricky.
- **Use-all-four rules.** Every number must be used exactly once per try. Division must be exact and every intermediate result must stay positive.
- **Feedback on every try.** Exact, close (within 10 points or 5%, whichever is larger), or far, each with the signed distance.
- **Tap-to-build expression builder.** It includes Undo, Clear and Submit, plus full keyboard support.
- **Shareable emoji grid**, along with stats, streaks, a solve distribution, and a countdown to the next puzzle.
- **Progress saved in `localStorage`**, so a refresh doesn't lose today's game.

## Mental Math

WIP: Everyday everyone gets the same mental math problems, seperated into three categories (hard computation, "gimmicky" computation, and manual entry (Sundays)) Players are scored on how fast they solve the question, irrespective of accuracy. 

## Features

- **Deterministic daily puzzle.** The local date (`YYYY-MM-DD`) seeds a Mulberry32 PRNG, so every player sees the same problem everyday. 

This is something that is more for myself, but I would love if other people used it. If you want to connect, email me at pcy@umich.edu 
