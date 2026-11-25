# spike 003 — mixed skins, and how many characters fit

Two questions, one page: can a cast be drawn in a different skin per character,
and how many characters does a stage hold before the picture stops working?

Run it: `npm run dev`, then `/spikes/003-mixed-and-many/`. Buttons set the cast
size (1, 4, 8, 12, 16, 24, 32) and switch between the mixed pass and one skin.

## What maxcot gives

- `Stage.draw` paints the **merged** cast in one skin: `paint(this.ctx,
  mergeScenes(scenes), this.skin, …)` (`vendor/maxcot/src/stage.ts`). That is
  what makes whole-frame effects possible (glitch, feedback, trails) and what
  makes per-character looks impossible in the stage itself.
- Each actor's own scene survives the merge: `mergeScenes` keeps `actors:
  scenes`, and `scene()` has already placed every part in stage pixels. So a
  per-actor pass is possible from outside: `paint(ctx, actorScene, itsSkin, …)`
  with maxcot's exported `paint`.

## The pass

After the stage has built the frame, paint each actor's scene with the actor's
own skin into a scratch canvas and composite it back. Two things it needs:

1. **A box-sized scratch, translated.** Painting the whole frame per actor cost
   8 full-canvas paints a frame: 8 characters ran at 30.8 ms. A scratch the size
   of the actor's body (plus a margin), with the context translated by
   `-box.x, -box.y`, brought the same cast to 18.4 ms.
2. **A clip, or the last actor wins.** Several skins paint the whole frame
   (gigposter's burst, hologram's grid, neon's glow). Composited unclipped, each
   one erases the cast drawn before it. The scratch is drawn through a clip of
   the actor's box, which cuts those effects at the body — and looks deliberate:
   a cut-out cast on one ground.

The ground is the show's own skin (one stage, many hands); the characters are
composited over it. `src/host.ts` does this in `paintMixed()`, and only when a
scene names a character's look (`style` with `on`), so every other show still
takes the single-skin path.

## Numbers (a laptop, 1920×1080 backing store, Chromium, 3 s a cell)

| cast | mixed | one skin |
|---|---|---|
| 8 | 56 fps · 18.0 ms | 148 fps · 6.8 ms |
| 12 | 27 fps · 37.7 ms | 84 fps · 11.9 ms |
| 16 | 17 fps · 57.4 ms | 49 fps · 20.3 ms |
| 24 | 11 fps · 90.0 ms | 18 fps · 55.5 ms |
| 32 | 7 fps · 136.9 ms | 12 fps · 86.3 ms |

Reading it:

- **A mixed cast costs about 2.5× the same cast in one skin.** The stage paints
  the whole cast once (it has to: it is what builds the frame), and then every
  actor is painted again for the composite. Box-sizing the scratch cut the pass
  from 30.8 ms to 18.0 ms at eight; the remaining cost is the second paint.
- **8 is comfortable** (56 fps), **12 playable** (27 fps), **16 choppy** (17 fps):
  below ~30 fps the stage still advances by real time, so the motion is right and
  the picture stutters.
- **24 and up is for stills, not motion.** The wide camera has to fit them, and
  the faces go under ~40 px.
- **Legibility**: at 8 the skins read as different hands; at 12 they still do;
  at 16 they read as different *colours*; at 24 they read as a crowd of blocks.

## Verdict

Adopted. A score says `style: "riso", on: "ann"` and that character is drawn in
riso for the rest of the show; a cue's `skin` (a network's answer) does the same
for the neuron that answered. `scenes/11-mosaic.score` is eight characters in
eight skins, and `examples/troupe` is the same thing arriving from a real run.

Not adopted: per-actor **palettes**. A palette belongs to a skin's paint call and
the stage holds one; a mixed pass would need a second map and a reason.

## Open

- A wide shot of 16+ leaves the top of the frame empty: the stage's group camera
  fits height to `0.85 + body height`, so a long line of small bodies sits low.
  A "fill the frame" framing would be a maxcot change, not a stage one.
- Effects that sample the whole canvas (datamosh, feedback, trails) do not
  survive the clip: in a mixed cast they are cut at the body. They are absent
  from the mix on purpose.
