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


## Stills

`stills.py` is the still camera: it opens the app page, selects a scene from the
list, scrubs to a named bar and beat, waits for the springs and the camera to
settle, and shoots the canvas (page chrome cropped out) at 2x.

```sh
./.venv/bin/python video/stills.py                     # every scene -> media/stills/*.jpg (1920x1080)
./.venv/bin/python video/stills.py --only duel,party   # the ones you want
./.venv/bin/python video/stills.py --social            # + media/social/*.jpg (1200x630)
```

Two things make a still readable that a page render does not need: the bubble
type is scaled up for the capture (the page sizes it for a laptop canvas, and at
1920 the line would be small), and the beat is chosen where the framing holds
the whole head — a `close` frames the eyes of a body taller than the canvas, so
the still list picks `full`, `medium` and `wide` moments.

The list of stills lives at the top of `stills.py`: scene, bar and beat, name,
and the sentence it is a picture of. Add a scene to `scenes/index.ts` and a line
there, and the README's grid can grow.

## What must stay true

- A frame is a **step**, not a seek: `renderFrame(t)` ticks one fixed 1/60 s and
  throws if frames arrive out of order. Seeking would snap the poses and cut the
  camera, and the film would look like a slideshow.
- `Math.random` is pinned in the page's `<head>`, before maxcot loads: blinks
  are seeded, so two renders match.
- The film plays the **committed** trace and the **committed** writer scene.
  Remake either, and the film is a different film (captions here are about
  staging, not about numbers, so a remake rarely needs a new script).
