# video — the demo take

The film on the portfolio page is rendered, not screen-recorded: a composition
page steps the real host one frame at a time, so the stage's springs, camera
eases and score clock behave as they do in the app, and the take is the same on
every render (the random seed is pinned in `composition.html` before any module
loads).

```
video/
  composition.html   the 1920x1080 frame: the stage, the bubble layer, the lower band, the score inset, the card
  main.ts           the timeline (two shows, one cut), the overlay beats, window.renderFrame(t)
  render.py         Playwright steps 60 fps into frames/, ffmpeg encodes out/stage.mp4
  frames/ out/      generated (gitignored)
```

## Render it

```sh
npm run dev                                    # the composition serves from Vite: /video/composition.html
./.venv/bin/python video/render.py --smoke     # 3 s, 180 frames: look before committing to the take
./.venv/bin/python video/render.py --mux --poster
```

`render.py` needs Playwright with Chromium and `ffmpeg` on PATH. Any venv with
`playwright` works; this family's is
`agent-neuron-demos/video/.venv/bin/python`.

The take is 25.6 s at 60 fps: the duet from its real trace at 0.7x (slow enough
to read a line), then the writer network's scene at 1.0x, each with a lower
band naming what the frame is doing; the compiled score appears beside the duet
while it ends.

## What must stay true

- A frame is a **step**, not a seek: `renderFrame(t)` ticks one fixed 1/60 s and
  throws if frames arrive out of order. Seeking would snap the poses and cut the
  camera, and the film would look like a slideshow.
- `Math.random` is pinned in the page's `<head>`, before maxcot loads: blinks
  are seeded, so two renders match.
- The film plays the **committed** trace and the **committed** writer scene.
  Remake either, and the film is a different film (captions here are about
  staging, not about numbers, so a remake rarely needs a new script).
