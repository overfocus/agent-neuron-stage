# Spike 002 — speech bubbles

**2026-11-24. Throwaway.** Run `npm run dev`, open
<http://localhost:5210/spikes/002-bubbles/>, and see `probe-shots.mjs` for the
camera anchors.

**Question (Given/When/Then).** Given a speaker and its head on screen, when
the camera cuts, then does a bubble stay on the head — and should it be drawn
by the page or by the canvas?

> **Adopted (Kevin, 2026-11-24): DOM bubbles in the page, with the bottom
> caption behind a switch — `docs/decisions/0002`.** This note stays as the
> evidence and as the design of a canvas bubble if a still needs one.

## What the scene gives

maxcot has no text anywhere: no bubble, no caption, no `say` field on a Scene.
What it does have is the geometry a bubble needs:

| Where | What it gives |
|---|---|
| `character.ts:127` | `S.body = K.bbox(sil)` — each actor's silhouette box, in canvas pixels, hands excluded |
| `character.ts:448-460` | `mergeScenes` keeps `actors: scenes` (each with its own `body`, `handL`, `handR`) and adds a merged box for the cast |
| `Stage.draw` → `this.S` | the merged scene of the frame just drawn |

So the anchor is **`(body.x + body.w/2, body.y)`** — the top-centre of the
block — read after `stage.step()` and correct by construction on every frame,
including while the camera is easing.

## Measurements

`probe-shots.mjs` (two actors, 960×600, `view.yaw` mirrored so they face each
other):

```
wide          left  cam.cx= 211 unit=146 body=134..286  top=204
              right cam.cx= 766 unit=146 body=700..830  top=222
full on right left  cam.cx=-954 unit=377 body=-1151..-759
              right cam.cx= 480 unit=377 body= 308..648 top= 96
close on left left  cam.cx= 480 unit=600 body= 169..788 top= -23
```

The page then reads the anchor live and places a bubble against it:

| When | Head (canvas px) | Bubble | Tail on the head |
|---|---|---|---|
| wide, left speaks | 210, 204 | 109, 147 · 203×47 | ±0.0 px |
| cut to full on left | 341, 147 | 240, 90 · 203×47 | ±0.0 px |
| mid-ease toward full on right (head leaving the frame) | 975, 121 | 710, 53 · 242×58 | **36.8 px** (clamped) |
| settled full on right, two-line line | 715, 98 | 594, 30 · 242×58 | ±0.0 px |

Both renderers hit the tail on the head exactly while the head is inside the
frame, and both clamp the bubble to the frame when it is not (the tail then
leans as far as it can, 14 px from the edge — that is the 36.8 px row).

## The two renderers

| | DOM div over the canvas | canvas, drawn after `stage.step()` |
|---|---|---|
| text layout | free: wrapping, kerning, any font, `max-width` | hand-rolled `measureText` + word wrap (~25 lines) |
| crispness | perfect at any DPR | needs a DPR-scaled pass, or it softens |
| follows the camera | yes: recompute the anchor each frame, convert canvas px → CSS px | yes: same anchor, drawn in canvas px |
| survives `canvas.toDataURL()` / a canvas capture | **no** — it is outside the picture | yes |
| survives a page screenshot | yes | yes |
| selectable / accessible | yes: real text, `aria-live` on a wrapper | no |
| z-order, clipping | CSS (`overflow: hidden` on the stage box) | canvas clip |
| cost | ~40 lines | ~60 lines |

## Verdict: VALIDATED, for both

A bubble anchored to the speaker's head works today, with no maxcot change, on
either side of the canvas. The anchor is free and exact; the only real work is
layout (wrap, clamp, flip, tail) and the staging rule for *when* a bubble is
showing.

### Recommendation for the real build

- **DOM bubbles** in this app: the text is free, it wraps, it can be selected,
  it can be announced, and the stage is already an HTML page with the canvas
  centred inside it. `place()` in `bubble.ts` is the pure part worth keeping
  (anchor, clamp, tail) and it is unit-testable without a DOM.
- **A canvas bubble** when the picture must be self-contained: a still for a
  README, a capture, a video. The same anchor and the same `place()` feed a
  `roundRect` and a triangle.
- **No upstream change needed for either.** A bubble *inside a skin* (so that
  every skin styles its own speech) would need a text field on `Scene`/`Frame`,
  which maxcot does not have — that is the one thing to ask maxcot for, and it
  is what the DOM route makes unnecessary for us.

### Caveats the prototype already showed

- The bubble must hide on `reset`/`seek` past its beat, and when the end card is
  up; it is state, like the caption.
- Measure after fonts are ready (`document.fonts.ready`), or the first bubble
  is sized on a fallback font.
- Two speakers need collision handling (this spike shows one at a time).
- A close-up puts the head near the top edge, so the "no room above → go below"
  branch matters; the spike's `place()` has it.
- The anchor is the *silhouette* box, so a raised pose or a prop changes it —
  which is right, and means the bubble will not sit inside a tall hat.
