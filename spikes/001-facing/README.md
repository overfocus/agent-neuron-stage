# Spike 001 — can two characters face each other?

**2026-11-24. Throwaway.** Run `npm run dev`, open
<http://localhost:5210/spikes/001-facing/>, and `node spikes/001-facing/measure.mjs`
for the numbers.

**Question (Given/When/Then).** Given two characters on one stage who hear each
other, when the show says they look at each other, then are their *bodies*
actually turned toward one another — and if not, what does it take?

## What maxcot gives

Three facts, from the vendored source:

| Where | What it says |
|---|---|
| `character.ts:54` | `yaw = P['view.yaw'] + C.twist` — a figure is oriented by exactly two things: a **design dial** (`view.yaw`, default 0.38) and an **animation channel** (`twist`) |
| `character.ts:131` | `cheat = eyes.cheat * sin(yaw) * -W * 0.14` — the face's features are shifted in proportion to `sin(yaw)`, so the face follows the body: mirror the yaw and the face mirrors with it |
| `stage.ts:163-165` | `look(id, target)` sets `eyes.lookX = ±0.85` and does `F.C.twist = F.C.twist - dir * 0.22` |
| `vendor/maxcot/README.md:52` | the documented promise: `look('kid','max').look('max','kid')  // they turn to each other` |

`sin(yaw)` is the x of the face normal after the projection, so **yaw > 0 means
the face points screen-right** and yaw < 0 screen-left. That is the only
orientation fact the rest of this note needs.

## Measurements

`measure.mjs` plays a two-actor stage (max at x = -1.9, kid at x = +1.9) through
maxcot's real `Stage` in Node and reads the rig back:

```
as it is (no look)
  left  yaw= 0.38 (design 0.38, twist  0.00) face→right  0.371  eyes.lookX= 0.00
  right yaw= 0.38 (design 0.38, twist  0.00) face→right  0.371  eyes.lookX= 0.32
  → both faces point right: they do NOT face each other

look(), as the stage does it
  left  yaw= 0.16 (design 0.38, twist -0.22) face→right  0.159  eyes.lookX= 0.85
  right yaw= 0.60 (design 0.38, twist  0.22) face→right  0.565  eyes.lookX=-0.85
  → the eyes arrive, the bodies turn away: they do NOT face each other

view.yaw by side (facing)
  left  yaw= 0.38 (design 0.38, twist 0.00) face→right  0.371
  right yaw=-0.38 (design -0.38, twist 0.00) face→left  -0.371
  → they FACE each other

facing + look()
  left  yaw= 0.16 (design 0.38, twist -0.22) face→right  0.159  eyes.lookX= 0.85
  right yaw=-0.16 (design -0.38, twist 0.22) face→left  -0.159  eyes.lookX=-0.85
  → they FACE each other, a little less squarely (the twist eats 0.22 of the turn)

look(), then the pose 'turn-to' on both (twist -0.36)
  left  yaw=-0.20 … face→left ; right yaw= 0.24 … face→right
  → they turn away from each other: a pose is not a per-relationship tool
```

## What the numbers say

1. **A cast never faces itself by default.** Every actor is drawn with the same
   `view.yaw` 0.38, so in a pair both faces point the same way. Whatever the
   staging, one of them is looking at the other's ear.
2. **`look()` is a glance, and its body twist has the wrong sign.** The eyes go
   to the target (±0.85) but the body twists *away* from it: -0.22 for a target
   on the right, +0.22 for a target on the left. So `look` can never be what
   makes two characters face each other, and it contradicts the line in
   maxcot's own README. Either the sign is a bug or "look" is deliberately a
   glance *back* over the shoulder — the README says the former.
3. **Facing is already possible, through the design yaw.** Setting
   `view.yaw = dir * 0.38` per actor (dir = the direction to the partner) makes
   both faces point at each other. It is a design dial, so the stage can do it
   today with `set('view.yaw', ±0.38)`: no engine change, and because a `set`
   morphs, the turn eases like a body turning.
4. The face follows for free: because the features are shifted by
   `sin(yaw)`, mirroring the yaw mirrors the face too. That is what makes the
   pair read as "facing" rather than "two heads rotated in the same direction".

## Options

| # | Approach | Where | Cost | Result |
|---|---|---|---|---|
| A | as it is | — | 0 | wrong half the time, and `look` makes it worse |
| B | `set('view.yaw', ±0.38)` per actor from the direction to the partner (or to the one addressed) | this repo: `compileTrace` emits it on `enter`, and again when a character starts answering someone on its other side | ~5 lines + a test | they face each other; the turn eases; a character who changes partner turns around |
| C | fix the sign in `stage.ts:165` (`+ dir * 0.22`) and let `look` also set a yaw target | maxcot (upstream) | one character + a design decision | `look` would do what its README says; every maxcot user gets it |
| D | a `stage.face(id, target)` API upstream: yaw from the relative x, `look` kept as the glance | maxcot (upstream) | a small API | the cleanest split: turning the body and flicking the eyes are two verbs, and a show can use either |

## Verdict: PARTIAL

Facing each other is possible today and cheap — but **not through `look`**, and
not with maxcot's defaults: it needs the design yaw set per actor, which is a
host/compiler decision. The rig is not the limit; the stage's `look` is.

### Recommendation for the real build

- Do **B** now: in `compileTrace`, emit `set: 'view.yaw', to: dir * 0.38` for
  every actor on `enter` (dir from where it stands relative to the middle of
  the cast), and re-emit it when a character answers someone on its other side.
  0.38 is the design's own three-quarter turn and reads well; the spike's
  slider shows 0.9 as near-profile and 0 as the flat "camera" look.
- Report **C** upstream with this note's numbers: maxcot's README promises
  turning, the code turns away, and the fix is one sign. Do **D** only if
  maxcot wants the two verbs separated.
- Do not use poses for facing: a pose applies to whoever it is given, and
  `turn-to`/`lean-in` turn everyone the same way (measured above).

### What the spike did NOT settle

- Whether a character should face *what it is answering* (the signal's sender)
  or *what it is about to speak to* (its outgoing links). In the duet both are
  usually the same actor; in a fan-out they are not, and the stage would have
  to pick one and hold it. That is a staging rule, not a rig question.
- Crowds: with three or more characters, "face the middle of the cast" is
  wrong (two of them should face each other, and the middle one turns to
  whoever spoke). The rule probably has to be "face the actor you are
  addressing, else the last one who spoke to you", which is a per-line
  decision the compiler can make — untested here.
