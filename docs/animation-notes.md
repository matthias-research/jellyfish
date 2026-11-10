> This document records the local investigation. Large REA bundles, snapshots, native executables, and desktop captures referenced below are intentionally not distributed. Runtime inputs are in `data/`; retained regression captures are in `tests/fixtures/`.

# Checker animation and timing

The previous browser version redrew checkers at their destinations and waited 140 ms before computer search and 180 ms after each computer move. There was no interpolated checker travel.

Native static evidence in `rea-animation-evidence.json`:

- `0x40dc70` registers Animation settings Blink, Delay, Seconds, Speed and Slide. Speed bounds are 1–3, with default 1. The Seconds field has declared bounds 0–300; its unit conversion has not been traced here. Evidence `ev_7170e62ef503b6d829525a2e7cbcb214a5d8e2a8ed423cda37ecd447be2ea7b4`.
- `0x404fa0` sequences checker movement, hits (moving checker, then struck checker to the bar), and bearing off. It uses a speed-dependent delay factor of 0.2 times the setting. Evidence `ev_4f9e61dd026df0bf682fa9ea322061d4d65548d93c586e44e9106102e81ee532`.
- `0x405270` draws successive intermediate positions when Slide is enabled and uses GetTickCount to pace each step by `(speed + 1) * 5` ms. Some x87 interpolation expressions are missing from decompiled pseudocode. Evidence `ev_9dfdd67f7515f05fae5f42aa70e4789172bd1f15aaaddcf06f08e529bbb01f60`.

The browser uses frame-scheduled SVG movement and user-facing duration settings. These reproduce sliding and adjustable pacing, but exact native step geometry and timing are not claimed. Static inspection does not establish native runtime animation timing.
