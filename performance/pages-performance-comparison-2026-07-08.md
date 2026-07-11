# GitHub Pages Performance Comparison - 2026-07-08

## Method

- Browser: Playwright Chromium 140, headless.
- Viewport: 1280x720.
- Runs: 5 per cold-load map, 5 switch-sequence runs.
- Service workers: blocked for both local and live runs.
- Local implementation: `dist/` served from `http://127.0.0.1:4177/` after `scripts/build_pages.js`.
- Live comparison: `https://maps.hiraeth.wiki/`.
- Raw local result: `/private/tmp/hiraeth-perf/local-results.json`.
- Raw live result: `/private/tmp/hiraeth-perf/live-results.json`.

## Deployment State Checked

- Local rebuilt Pages bundle generated `15,739` tile files across `23` maps in `dist/tile/`.
- Live `site.config.json` reported asset version `0.1.31`.
- Local implementation reported asset version `0.1.32`.
- Live tile URL check: `https://maps.hiraeth.wiki/tile/main_continent/1/0/0.webp` returned `404`.
- Live tile manifest check: `https://maps.hiraeth.wiki/tile/manifest.json` returned `404`.

## Cold Direct-Map Loads

| Map | Local loader hidden | Live loader hidden | Live / local | Local visual payload | Live visual payload | Local visible tiles | Live visible tiles |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Fair | 138.2 ms | 3,091.0 ms | 22.4x | 112.8 KB | 29,534.3 KB | 12 | 0 |
| IceBeach | 134.9 ms | 969.3 ms | 7.2x | 144.4 KB | 5,888.9 KB | 12 | 0 |
| Southern Thalassia | 130.5 ms | 7,249.8 ms | 55.6x | 176.0 KB | 59,772.7 KB | 12 | 0 |

## Map Switches

Switch sequence started on Fair, then loaded IceBeach, Fair, and Southern Thalassia.

| Target map | Local switch elapsed | Live switch elapsed | Live / local | Local visual payload | Live visual payload | Local visible tiles | Live visible tiles |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| IceBeach | 65.8 ms | 1,196.6 ms | 18.2x | 179.2 KB | 5,923.7 KB | 12 | 0 |
| Fair | 25.3 ms | 407.8 ms | 16.1x | 112.8 KB | 130.7 KB | 12 | 0 |
| Southern Thalassia | 49.3 ms | 5,579.4 ms | 113.2x | 205.5 KB | 59,802.2 KB | 12 | 0 |

## Finding

The local implementation is substantially faster when the Pages bundle includes generated tiles. The live site is slower primarily because its tile files are not deployed: the app requests tile URLs, receives `404`, and falls back to full map images. This makes large maps such as Southern Thalassia load roughly `55x` slower on direct load and `113x` slower on map switch in this benchmark.

The implementation changes that fade the preview and preload direct-map JSON are working in the local Pages simulation, but the biggest live deployment blocker is publishing `dist/tile/` along with the shell files.
