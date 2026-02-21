# Firefox pan/zoom profiling checklist

Goal: confirm panning/zooming stays ≥50fps and CPU usage drops ~30% compared to pre-optimization, using Firefox (latest) on macOS with dark theme + aurora enabled.

## Capture a 15s profile
1) Open the app locally or on prod; pick a large map. Set theme to Dark and ensure aurora is on (any map with `atmosphere=aurora`).
2) Open Firefox DevTools → Performance.
3) Click the gear icon and enable:
   - Screenshots
   - JavaScript sampling (1 ms)
   - “Enable advanced timings”
4) Press Record, then continuously pan/zoom the map for ~15 seconds (try diagonal pans + quick zooms).
5) Stop recording; save the profile as JSON (`Save All Profiles`).

## What to look at
- **FPS graph**: target average ≥50fps, no long drops below 40fps.
- **CPU**: compare “CPU %” lane vs a pre-change profile (baseline) over the same 15s action; aim for ≥30% reduction.
- **Raster/paint**: ensure “Paint” blocks shrink; expect fewer long tasks from CSS effects.
- **GC/JS**: verify no new GC spikes from starfield or animation loops.

## Comparing before vs after
- Use the two saved JSON profiles in the Performance panel (“Import profile…”), then compare FPS/CPU lanes side by side.
- Note peak “Long Task” durations; expect fewer >50ms tasks in the after profile.

## Reporting
- Record: hardware, Firefox version, map id, theme, atmosphere mode, and whether reduce-motion was on.
- Summarize: avg FPS, CPU delta %, any regressions in interactivity (popups/markers).
