> This document records the local investigation. Large REA bundles, snapshots, native executables, and desktop captures referenced below are intentionally not distributed. Runtime inputs are in `data/`; retained regression captures are in `tests/fixtures/`.

# JellyFish Light Build 268 compatibility findings

Inspected executable: `original/JFL3532.exe`, SHA-256 `b6c64b3116d545c50eaaa2fb5ecd520c3f46cb68de12339cf1c4cea6dad605c9`.

## Several visible menu commands are stubs in this edition

The captured menu is not a reliable list of implemented features. `native-command-map.json` records aligned MFC `WM_COMMAND` message-map entries matched to the captured menu, their virtual addresses, file offsets, and the first 16 handler bytes. The scan is bounded to application `.rdata` addresses `0x472000..0x474000`; it is not a complete call-graph audit.

For Open, Save Position, and Save Position As, the application handlers consist of a single x86 `C3` (`RET`), followed by NOP alignment. Their map entries use message `0x111`, notification code 0, matching first/last command IDs, signature 12, and the handler pointer below.

| Command | ID | Message-map VA | Handler VA | Handler file offset | First bytes |
| --- | ---: | --- | --- | ---: | --- |
| Open | 57601 | `0x472fa0` | `0x419a10` | 101904 | `c3 90 90 90` |
| Save Position | 57603 | `0x472f58` | `0x4199b0` | 101808 | `c3 90 90 90` |
| Save Position As | 57604 | `0x472f40` | `0x4199e0` | 101856 | `c3 90 90 90` |
| Edit Position | 32893 | `0x472e50` | `0x419ca0` | 102560 | `c3 90 90 90` |
| Takeback | 109 | `0x472fd0` | `0x419020` | 99360 | `c3 90 90 90` |
| Step Forward | 33022 | `0x4733c0` | `0x419050` | 99408 | `c3 90 90 90` |

Other immediate-return application handlers include Player 1/2 editing, On Roll editing, Reset position, Match Score editing, Insert Position, and Print Log File. Their exact locations are preserved in `native-command-map.json`. A generic MFC Open implementation also exists elsewhere, but the application map provides its own empty handler. No original `.pos` layout was recovered from these empty command implementations.

Runtime corroboration: in process 56568, posting Save Position As command 57604 to the JellyFish main window produced no Save dialog. Posting New command 57600 did produce the New dialog with three list entries. Selecting row 0, notifying `LBN_SELCHANGE`, and pressing OK closed that dialog. Save Position As still produced no dialog. This observation is consistent with the static stub; it does not establish every possible routing path or another edition's capabilities.

The browser JSON save/load and position editing/replay, where present, are browser additions. They should not be described as a translation of functional `.pos` support in this supplied Light executable. Historical `.pos/.gam/.mat` compatibility remains unimplemented; another edition or a real sample file would be needed to investigate those formats.

## Analysis commands and play levels

Evaluate (`0x41a0c0`), Lookahead (`0x41a110`), and 2 Ply (`0x41a160`) acquire a device context and call `0x410050`. That routine calls `0x411df0`, which returns 0, then performs `RET 12`. Thus these sampled analysis command paths do not perform position evaluation, despite the real AI evaluator being present for game play. The native Best Moves handler `0x41a200` calls `0x414080`, whose bytes are `c2 08 00` (`RET 8`) followed by NOPs. Browser hint/evaluation features use the recovered game evaluator and are additions relative to these empty analysis UI paths.

REA evidence IDs in `rea-compatibility-evidence.json`:

- Evaluate handler: `ev_77364b77e3bcd5003454d751ae57228c944f905fca8302c9b5b3e04aa56e48aa`.
- Lookahead handler: `ev_9082f0caf29b5e05386f7202c90c3ec1adf7ffe6b98f98cb6fe77904e37dc4d4`.
- 2 Ply handler: `ev_f38e04a22ff0bbc163e41f3178639210715bd67222e787fb5966f593ca0da37f`.
- Best Moves handler: `ev_e3486f95c0770cbc832761b2782c0cb2c9484413f6b6a702413f5579c7e09b91`.
- Common analysis helper returning zero: `ev_0cd7128790f0f9374730d68828d03a1300e418bd2e1eaf380cf4acfb4e5c0007`.

Level 1 through Level 7 commands have real wrappers that push the respective level and call `0x418a40`. This setter has substantial native instructions, but Ghidra's existing function inventory did not define it, so its full behavior remains unverified here. The existence of the level menu wrappers does not prove browser lookahead matches the original selection/search algorithm.

Statistics reaches `0x412e00`, which constructs a statistics dialog and opens it; it is not an immediate-return stub (`ev_23e2b30da2328160c384a6195653e9617f02742367d4a782a352182d0b92b36b`). Exact statistics calculations/fields remain outside this focused audit. Rollout strings and internal routines exist, but no rollout menu command was present in the captured menu; rollout availability in this edition is unresolved.

## Contact inputs and cube helper recovery

`src/ai-features.js` implements the 359 integer contact inputs recovered from `0x42cb60` / `0x42cd70`. All 359 starting-position entries match the native Frida function-call capture in `native-contact-fixture.json` exactly; the corresponding regression test checks every entry. Three side-feature variants (`0x42cd70`, `0x42de60`, `0x42ee90`) have identical pseudocode after normalizing global/label addresses and the declaration name. Extended x87 intermediate precision remains a possible boundary difference for other positions until measured.

`src/match-equity.js` translates `0x425740` and `0x425c50`. The former contains an 11×11 match-equity percentage table built by immediate stack writes, which Ghidra omitted from its pseudocode. Assembly recovers every table value. Mode 0 uses clipped score-distance difference rather than the table. The match-cube caller chooses table mode only when both distances are below 12; it uses mode 0 beyond that range. Helpers preserve this mode distinction.

Evidence: `ev_eccf5c5ef18a63b7e304f1674e94ff655004892769f6df9f5321dd37e0046f08` (equity), `ev_a2156c96703e7e0af87e05db2a10c648baee81ab75726bedbe74f31e467ccf9c` (recube adjustment). Unit tests cover table symmetry/monotonicity, terminal boundaries, mode 0, and hand-calculated recube examples; native runtime parity for these helpers is tracked separately by the AI work.

## Levels 1–4 and the small network

`src/ai-cheap.js` translates the small evaluator `0x426580`, builder `0x42fc50`, and loader `0x42f960`. The loader consumes only the first 2,400 integers of the 6,301-integer `jf300.dat`: eight rows of 294 input weights and six output weights. The complete original file is retained. Hidden unit zero is a fixed 1,000 bias; output calculation multiplies the final hidden contribution by 14, preserving the original instruction sequence. All 294 inputs and all six outputs match the native evaluator exactly on 26 captured positions (`native-cheap-corpus.json`); tests compare every entry.

Levels 1 and 2 add the native four-component noise, `(3-level) * (rand() % 2000 - 1000) * 0.00005`, including its modulo bias. JavaScript supplies uniform 15-bit random integers by default and accepts an injected integer generator for reproducible tests. It preserves the distribution, not the Windows CRT random stream. Level 3 uses this network without noise. Dispatcher `0x4213f0` sends level 4 through the cheap-score candidate filter before the full network, while level 5 skips that filter. Higher-level search also uses the same cheap filter internally. Details and assembly are preserved in `rea-cheap-evidence.json`.
