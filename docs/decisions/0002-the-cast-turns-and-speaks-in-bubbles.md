# Decision record 0002: the cast turns, and a line hangs over its speaker (2026-11-24)

**Status: decided by Kevin on 2026-11-24 ("do both") and built.** Two spike
verdicts were taken up together: characters facing each other by orientation,
and speech bubbles anchored to the head.

## The problem

The stage had two staging gaps that a viewer notices before any of the rest:

1. **Nobody faced anybody.** A figure is oriented by `view.yaw` (a design dial,
   default 0.38) plus `twist` (a channel) — `vendor/maxcot/src/character.ts:54`.
   Every actor was drawn with the same 0.38, so in a duet both faces pointed
   screen-right. maxcot's `Stage.look()` looked like the answer, but it moves
   the eyes to ±0.85 and twists the body **away** from the target
   (`stage.ts:165`, `twist - dir * 0.22`), which is the opposite of what its own
   README promises ("they turn to each other", README:52). Measured in
   `spikes/001-facing`: with `look` both bodies stayed turned right.
2. **A line was a caption under the picture.** It named the speaker in a strip
   at the bottom, which is legible and wrong: a line belongs to a face. maxcot
   has no text anywhere, so nothing in the rig could carry it.

## The decision

1. **The compiler turns the cast; the host stays geometry.** A trace's compiler
   emits `set: "view.yaw"` per actor: on the way on, each character faces the
   middle of the people it can reach (the mean x of its outgoing links), and
   when it answers someone on its other side it turns to that addressee — the
   target of the answer's *forward*, not the router's reply, because a composed
   character's reply goes back to its caller. 0.38 is the turn: maxcot's own
   three-quarter view. The host needed one change: a `set` on a seek `snap()`s,
   or scrubbing would land mid-morph.
2. **A score gets the same two rules on the way in.** `parseShow` inserts the
   same `set` events ahead of an `enter` (face the middle of the cast) and a
   `look` (turn to whoever you look at), so a score a person writes, a score a
   network answers, and a trace all stage alike. A score can still override it
   by setting `view.yaw` afterwards.
3. **A line is a bubble over the speaker's head**, anchored to the actor's body
   box from the last frame (`ShowHost.actorBox`/`headOf`), so it follows the
   camera by itself, and drawn by the page (a `div` in a layer over the canvas)
   rather than the canvas: real text, real wrapping, selectable, `aria-live`.
   The pure part — anchor, clamp inside the frame, tail offset, above or below —
   is `src/bubble.ts`, tested without a DOM. The page keeps the old bottom
   caption behind a switch (`bubbles` | `caption`, remembered in localStorage),
   because a dense run (the alert storm: 534 score events) reads more calmly as
   one line than as a flicker of bubbles.
4. **maxcot is not forked.** The vendored copy stays untouched; the sign at
   `stage.ts:165` and a possible `stage.face(id, target)` API go upstream as a
   report with the spike's numbers, not as a patch in this repo.

## What was built

- `src/bubble.ts` (placement, 6 tests) and `src/bubbles.ts` (the DOM bubble).
- `src/host.ts`: `actorBox(id)` / `headOf(id)` off the merged scene, and `set`
  snapping on an instant seek.
- `src/fromtrace.ts`: entrance facing and the turn on an answer; the yaw is
  `FACING` in `src/cast.ts`.
- `src/fromscore.ts`: the same twice, for scores.
- The page: a bubble layer, the `bubbles | caption` switch, and the bubble
  following the speaker through camera cuts.
- Tests: 59 (was 47). The new ones pin the facing values for the duet and for a
  score, the turn when an addressee is on the other side, `actorBox` matching
  the scene the stage actually drew (the order is far-to-near, which is easy to
  get wrong), and the bubble geometry at the edges and under a close-up.

## Not adopted

- The **upstream sign fix** (and a `face()` API): reported, not patched here.
- **Canvas bubbles** as the default: kept for a still that must be
  self-contained (a capture, a README image); the DOM bubble wins for the page.
- **Crowd staging**: with three or more characters, "face the middle of the
  people you can reach" is a first rule, not a solved one. Two characters with
  the same reach can still both face the same way. A real rule would pick, per
  line, the addressee and then fall back to the last speaker; untested.
- Facing on a *signal* (the delivery), as opposed to on an answer (the speech).
  The duet would flip-flop between the narrator and the partner if both did.

## How it is checked

`npm run check` (tsc, 59 tests, vite build), and in the browser against the real
trace: at 3.3 s of the duet the cue faces the pair, max faces kid, kid faces
max, and "MAX / The tide kept me." hangs over max's head with the tail on it;
cutting to a full shot moves the bubble with the head; the end card clears it;
switching to `caption` puts the same line back under the picture.
