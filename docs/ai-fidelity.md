> This document records the local investigation. Large REA bundles, snapshots, native executables, and desktop captures referenced below are intentionally not distributed. Runtime inputs are in `data/`; retained regression captures are in `tests/fixtures/`.

# Recovered JellyFish evaluator and search

The browser reads the supplied numeric files directly. It does not replace the original networks with a positional heuristic. The reconstruction targets `original/JFL3532.exe`, JellyFish Light 3.5 build 268, SHA-256 `b6c64b3116d545c50eaaa2fb5ecd520c3f46cb68de12339cf1c4cea6dad605c9`.

## Recovered computation

`src/ai.js` implements the native 72-integer board representation, integer network arithmetic, activation interpolation, phase selection, terminal results and six-checker bearoff lookup. `src/ai-features.js` implements all 359 contact inputs. Networks jf301/jf302/jf303 contain 77 hidden nodes and 359 inputs; jf304 contains 51 hidden nodes and 87 inputs. Node zero is the bias. Native signed 32-bit multiply/add overflow and truncation are retained. Activation uses the original 401-node sigmoid interpolation, integer output scale and clamps. Probabilities are cumulative: gammon includes backgammon, and win includes all wins.

`src/ai-cheap.js` recovers the jf300 small network: 294 features, eight hidden nodes and six independent outputs. Its loader consumes the first 2,400 integers of the supplied file, matching the executable; the remaining values are unused by that loader. Levels 1 and 2 add the original random-error formula, level 3 uses this network directly, and level 4 uses it to prune before full-network scoring. The same cheap pruning appears in levels 6 and 7 replies. `src/ai-search.js` recovers the race, closed-board and trap candidate filters. Level 6 keeps at most three candidates within 0.06 direct equity; level 7 uses the original 0.12 window, 99-candidate ceiling and legal-successor-count work budgets (7,000 and 3,000 at the observed default setting 10). Match weights are reversed and negated at each side switch, as in `0x4247e0`.

The 54,264-entry `longbear.dat` indexing and lookup are recovered, with five native lookup comparisons. This table participates in optional higher-level race candidate filtering, not the leaf evaluator. The running original's `0x49957c` flag was zero, so the browser leaves that filter option disabled by default as well. The table is loaded and can be enabled programmatically with `setLongbearEnabled(true)`.

| Native address | Recovered behavior |
| --- | --- |
| `0x426020` | Initialize data loaders |
| `0x426220` | Evaluation dispatcher, terminal/phase/bearoff corrections |
| `0x42ec80`, `0x42de60`, `0x42ee90` | Contact input building paths (shared equivalent side logic) |
| `0x42bed0`, `0x42c420` | Race network loading/evaluation |
| `0x426ff0` | Complete-turn move generation |
| `0x426440` | Best direct-network candidate |
| `0x427610` | Level 6 weighted enumeration of all 21 rolls and equity variance |
| `0x427940` | Level 7 selective deeper replies for 5-1, 3-2 and 6-4; correction weight 0.25 each |
| `0x4213f0` | Level-dependent move-selection dispatcher |
| `0x424960`, `0x424e00` | Money-game and match doubling/taking policy |
| `0x425740`, `0x425c50` | Original 11-by-11 match-equity table and recube adjustment |
| `0x425e60` | Match-dependent checker-play gammon weights |

Cube advice follows the original policy, including uncertainty, special race/contact cases, too-good tests, the one-away/two-away cases and its fallback beyond 11-away. The API gives `offer` and `take` from the requested player's perspective; native `take` is originally the opponent's response to an offer, so the wrapper evaluates both perspectives. Crawford prevents offers. Jacoby defaults off. Money-game beaver advice is exposed by the evaluator but the browser's ordinary take/drop interaction does not implement a beaver sequence.

## Controlled native comparisons

REA/Frida attached to PID 56568 running the preserved executable. Initialization `0x426020` returned success. Caller-created native buffers were passed to the original functions, and outputs were read back. These are controlled native-function calls, not recordings of full games or successful native GUI interaction.

| Retained fixture | Coverage |
| --- | --- |
| `native-ai-corpus.json` and `native-ai-extra-corpus.json` | 142 positions spanning contact, borne-off contact, backgames, racing, terminal and bearoff; all evaluator outputs agree within `1e-10` and all 359 contact feature integers agree exactly |
| `native-moves-corpus.json` | All 21 rolls for 26 positions: 546 resulting-board sets agree exactly |
| `native-level5-corpus.json` | 546 direct best-choice comparisons: every best equity and selected board agrees; native descending-point scan ordering resolves the observed equal-equity tie |
| `native-cube-corpus.json` | 312 money/match policy calls across 26 boards and 12 cube/away contexts agree exactly on offer and take codes |
| `native-lookahead-corpus.json` | Three positions at levels 6 and 7; all six probability vectors and variances agree within `1e-10` |
| `native-cheap-corpus.json` | All 294 feature integers and six small-network outputs agree for 26 positions |
| `native-levels-corpus.json` | 312 selected boards across levels 3, 4, 6 and 7 agree exactly, including outer filters and work budgets |
| `native-match-search-corpus.json` | 160 selected boards across levels 3 through 7 and four asymmetric match/cube contexts agree exactly |

Input boards accompany the fixtures. Tests compare saved native outputs with current JavaScript. This establishes the stated cases, not exhaustive equivalence or identical tournament strength.

The runtime evidence envelopes report `subject: null` and unavailable artifact identity. Provenance is linked explicitly rather than silently treating those envelopes as self-authenticating: `native-ai-provenance.json` records Frida's PID, absolute module path, IA-32 architecture and image base `0x400000`; `native-position.json` independently records the same PID/path and executable SHA-256 using `tools/read-native.py`; `original-inventory.json` records the preserved artifact hashes. Early files named `native-contact-start.json`, `native-contact-features.json`, `native-contact-output.json` and `native-position.json` captured idle buffers and are not evaluator parity fixtures.

## Scope of equivalence

All seven playing levels, the observed default search limits and their candidate filters are reconstructed. The initial level-7 contact discrepancy disappeared after recovering its small-network pruning, and is now covered by an exact regression test. The original executable uses x87 extended intermediate precision; JavaScript uses IEEE-754 binary64. Captured evaluator results agree at the stated tolerance, but untested close decision boundaries can still differ. Levels 1 and 2 retain the original error distribution formula, but browser randomness is not synchronized with the Windows CRT seed/sequence. The controlled corpus does not establish exhaustive equality across all positions, settings or complete games.

Full dossiers, assembly, static references and runtime evidence are retained in `rea-ai-evidence.json`. The user's unspecified original bug has not been identified or deliberately changed.


### Cube-decision feedback

The status and horizontal score field assess a human double or no-double decision
from the position before rolling or changing the cube. The opponent's response
is the minimum of double/take and double/pass values, independent of the response
actually chosen. Opening rolls, Crawford and opponent-owned cubes have no
no-double assessment. The feedback is replaced by completed checker-play feedback.

This numerical feedback is a new approximation, not a recovered native score.
It blends dead and live cube equity with fixed efficiency 0.68 (Janowski-style
piecewise interpolation), using JellyFish's evaluated probabilities, conditional
gammon/backgammon rates and recovered match-equity table. Match cash/take points
are calculated recursively through successive cube values. Match losses are
normalized by half the difference between winning and losing a single game at
the current cube. Beyond the native table's range, its existing linear match
approximation is used. Conditional gammon rates and cube efficiency are held
constant; future dice and future Crawford transitions are not explicitly searched.
The recovered computer cube policy is unchanged and can disagree with this model.
The numerical feedback is not XG-equivalent analysis or a rollout.

Model reference: [GNU Backgammon manual, Cubeful equities](https://sources.debian.org/data/main/g/gnubg/0.90%2B20091206-4/doc/gnubg/gnubg.html).
