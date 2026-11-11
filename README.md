# JellyFish Light in the browser

JavaScript reconstruction of JellyFish Light 3.5 Build 268, using recovered native logic, the supplied neural-network data, and original embedded dice/logo artwork.

## Run

Requires Node.js 22.14 or newer. Local play requires no dependency installation or build step:

```sh
npm start
```

Open http://127.0.0.1:4181. All required numeric AI data is included in `data/`. A fresh clone runs without the original installation or any Windows executable. Serve over HTTP rather than opening index.html as a file.

White moves from point 24 toward point 1. Roll to determine the opening player. Select a checker and a highlighted destination, or double-click a checker for an available move. Pick up the dice when finished. Clicking the board also rolls or picks up dice when that action is available. Undo changes the current uncommitted turn. The right-hand tray bears checkers off.

Settings (F9) includes **Pause after JellyFish rolls** (0ï¿½5 seconds) and **Checker animation duration** (0ï¿½1500 ms per checker). Defaults are a 1-second pause and 350 ms sliding animation. Lower duration means faster movement; 0 disables animation. Both settings persist locally and in browser saves; older saves receive the defaults. The pause is a minimum after the dice appear, so longer AI calculations can extend it. Checker slides cover normal moves, hits, bar entry, and bearing off; the browser timing controls are reconstructed rather than exact copies of the native timing values.


Implemented controls include human/computer or two-player matches, money play, cube take/drop, Crawford games, resignation, position editing, pip counts, hints, ranked moves, evaluation, whole-turn takeback/step-forward, board reversal, JSON saves, printing, text logs, statistics, and seeded cubeless rollouts. Computation runs in a Web Worker to keep the page responsive. Levels 1â€“7 use the recovered small/full evaluators and lookahead patterns. Levels 1 and 2 include the original style of evaluation noise, with a fresh browser random stream.

Space rolls or finishes a turn. F2 opens a new game, F4 statistics, F9 settings. Ctrl+Z undoes all checker moves in the current uncommitted turn; Ctrl+K/Ctrl+T step backward/forward through recorded turns. The menus list the remaining actions.

## Deployment

Hosted on Cloudflare Workers at **https://jellyfish.matthi3010.workers.dev**, in the same account as `sws-platinum`.

```sh
npm ci
npx wrangler login
npm run deploy
```

`npm run deploy` builds and publishes only `dist/`: HTML, CSS, JavaScript, the logo, and required AI data. Original executables, analysis, tests, and local files are excluded. `npm run deploy:preview` runs the Cloudflare preview locally. Deployment is manual; pushing to GitHub does not publish updates.

## Validation

```sh
npm test
```

The browser smoke tool requires a separate Chrome debugging instance on port 9238 and the preview server. Run `node tools/browser-smoke.mjs`. Screenshots are retained in `analysis/browser/`.

The evaluator tests replay 142 positions against results captured by calling the original executable's routines. The seven outputs agree within 1e-10 on that corpus; contact input features agree exactly. This covers the tested positions, not every possible position or all search/cube decisions.

The recovered money-game and match-play cube calculations also match 312 controlled native decisions across different positions, cube values, and scores. The original match-equity table is included.

Further native comparisons cover 546 legal-result sets, 546 level-5 choices, and 312 choices across levels 3, 4, 6, and 7; selected boards match throughout those corpora. The small network matches its 26-position corpus, and sampled level-6/7 lookahead probabilities and variances agree. See `docs/ai-fidelity.md` for addresses, fixture provenance, numerical tolerances, and remaining limits.

Another 160 native selection cases verify score-dependent match weighting across levels 3â€“7, including one-away/two-away scores and a doubled cube.

## Provenance and scope

`src/RULES.md` describes the board and match APIs. `data/manifest.json` records the required numeric inputs and hashes; `assets/manifest.json` records the included artwork. `tests/fixtures/` contains the retained regression captures. The original installation, large REA bundles, snapshots, screenshots, and local investigation helpers are deliberately excluded.

`docs/compatibility.md` documents disabled menu commands in this Light executable. Its Open/Save, editor, replay, and sampled analysis handlers are empty. Their browser implementations are additions; legacy `.pos/.gam/.mat` files are not supported. Rollout statistics, JSON persistence, and browser printing are browser implementations. The original dice/logo artwork is preserved; the remaining interface is reconstructed and has not passed a pixel comparison against a visible native window.

The native program and browser are separate implementations. Numerical parity, search behavior, cube decisions, native file compatibility, and pixel fidelity must be assessed separately; a passing rules test does not establish full original-program equivalence. The reported original bug remains unspecified and has not been deliberately fixed.
