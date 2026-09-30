MEMORY FRAGMENTS — V4

HOW TO RUN
1. Keep index.html, style.css, script.js and the assets folder together.
2. Open index.html in Chrome / Edge / Safari.
3. Click anywhere once to enable the looping soundtrack. Browser autoplay rules require this first user interaction.
4. Every click recalls a new memory fragment and triggers a short digital recall sound.

V4 CHANGES
- The four C4D base scenes now change automatically.
- Scene order is randomised in shuffled cycles: every C4D scene appears before a new order is generated, with no immediate repeat.
- Background changes every ~18–28 seconds with a crossfade instead of a hard cut.
- Added the supplied soundtrack as a continuous loop. It fades in after the first click.
- Added a procedural digital click / recall sound on every pointer click.
- The archive status now displays the current base-memory name and audio state.
- All memory fragments remain hard-edged rectangles and continue shrinking before disappearing.

AUDIO
Soundtrack: assets/background-music.mp3
Target playback volume: 34% so it remains behind the visual interaction and click sounds.

BACKGROUND TIMING
BG_MIN_HOLD_MS and BG_MAX_HOLD_MS can be edited near the top of script.js.
Current range: 18–28 seconds.

V5 update: click interaction sound changed to a short synthesised system-error / failed-operation alert.
