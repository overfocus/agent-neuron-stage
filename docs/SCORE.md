# The stage score

A show is a maxcot score: bars and beats, `at` first, then one or more
commands. It is written in maxcot's own score syntax (comments, unquoted keys,
single or double quotes, trailing commas; never evaluated), so the text this
repo prints is text maxcot's studio plays.

```
{
  title: "duet",
  bpm: 100,
  tail: 3.6,
  events: [
    { at: [1, 1], enter: { id: "cue", who: "professor", x: -1.387, z: 0.12 } },
    { at: [2, 1], look: "cue", on: "max" },
    { at: [2, 1], say: "You're late.", on: "cue" },
    { at: [2, 2.187], pose: "feel-sulking", on: "kid" },
  ]
}
```

A JSON document with the same `{ title, bpm, beatsPerBar?, tail?, events }`
shape is read too — that is the form a program neuron can answer with.

## Time

- `bpm` (default 100) and `beatsPerBar` (default 4) set the grid.
- `at: [bar, beat]`, both counted from 1, beats fractional to three places.
- Compiling a trace: `beats = leadIn + t_ms / 1000 / (60 / bpm)`, where
  `leadIn` is one bar by default (the cast walks on during it). So the run's
  `t = 0` lands on bar 2 beat 1.
- `tail` (seconds, default 3.6) is what the stage holds after the last event.

## Commands

| command | value | `on` | what it does |
|---|---|---|---|
| `enter` | `{ id, who?, x?, z?, pose? }` or `"id"` | — | puts an actor on the stage; `who` is a maxcot cast name |
| `create` | `"who"` | — | one actor whose id and cast are the same name |
| `exit` | `"id"` | — | takes an actor off (never the last one) |
| `pose` | one of maxcot's 95 pose names | the actor | springs that pose's layer only (a `mouth-*` leaves the body alone) |
| `look` | another actor's id, `"us"` (the audience), or `"none"` | the actor looking | turns its eyes and a little of its body |
| `shot` | `"wide" \| "full" \| "medium" \| "close"` | an id or a list of ids | the camera; `wide` frames everyone or the group in `on` |
| `style` | a skin name (`pencil`, `riso`, `hologram`, …) | — or one actor | restyles the whole cast; **with `on`, that character's own hand** (see *Mixed looks*); `palette` names one of its palettes |
| `who` | a maxcot cast name | the actor | recasts it (the design morphs) |
| `manner` | `{ weight, idle, gaze, rest }` | the actor | how it moves: 0 light and springy, 1 heavy and slow |
| `set` | a design dial (`"body.w"`), with `to` a number | the actor | one dial; a seek snaps it rather than easing the morph |
| `move` | `{ x, z }` or `{ dx, dz }`, with `over` in beats | the actor | **the stage's own**: walks there, absolute or a step from where it stands (see *Walking*) |
| `say` | a line | the speaker | **the stage's own**: the bubble over the speaker's head, or the line under the picture |
| `end` | `{ card: "logo", text: "DUET" }` | — | **the stage's own**: the end card |

Modifiers, which qualify a command and are never commands themselves: `at`,
`on`, `to`, `from`, `over`, `palette`, `cut`. A command the stage does not know is
reported once and ignored; a command it knows with a value it does not is
dropped (no pose that the rig cannot draw, no skin that does not exist).

## Mixed looks: one stage, many hands

`style` with `on` draws that character in that skin for the rest of the show:

```
{ at: [1, 2], style: "riso", on: "ann" }     // ann is printed from here on
{ at: [1, 2], style: "pencil" }              // everyone else, the old way
```

maxcot's Stage paints a cast in **one** skin by design (`Stage.draw`:
`paint(mergeScenes(scenes), this.skin, …)`), which is what makes whole-frame
effects possible. A score that mixes looks is drawn by the host instead: after
the stage has built the frame, each actor's own scene is painted again in its
own skin and composited back through a clip of that actor's body
(`src/host.ts`, `paintMixed()`; `spikes/003` measured it). The ground stays the
show's skin: one stage, many hands.

What it costs, measured on a laptop at 1920×1080 (spike 003): 8 characters in 8
skins run at 56 fps, 12 at 27, 16 at 17, 32 at 7 — about 2.5× the same cast in
one skin. Eight is comfortable, twelve plays, sixteen is for stills and slow
scenes, and past twenty the faces are gone.

Two rules that follow:

- A mixed cast is a **cut-out** cast. Effects that paint the whole frame
  (datamosh, feedback, trails, a gigposter burst) are clipped at the body, so
  they read as collage rather than as film. The skins that mix well are the
  ones that draw inside the figure.
- Skins that are absent from the mix on purpose: `stylemosh`, `datamosh`,
  `databend`, `feedback`, `trails`, `pixelwind`. One of them repaints the frame
  from the previous one, and a composite has no "previous frame" of its own.

## Facing: which way a body points

A figure is oriented by `view.yaw` (a design dial) plus `twist` (a channel), and
yaw > 0 points screen-right. Every actor is born turned the same way, so a cast
only faces itself if something turns it — and `look` is not enough: maxcot's
`look()` flicks the eyes and twists the body 0.22 *away* from the target
(measured in `spikes/001-facing`).

- A **trace** is compiled with the turn: `set: "view.yaw", to: ±0.38` on the way
  on (each character faces the middle of the people it can reach) and again when
  it answers someone on its other side.
- A **score** gets the same two rules when it is read: facing the middle of the
  cast at `enter`, and turning to whoever a `look` names.
- A score that wants another orientation sets `view.yaw` itself, after the
  enter; the last one wins.

## Depth: where a character stands

`enter` takes `x` and `z`. `x` is the floor, left to right, in body units; `z` is
into the picture. maxcot scales a member by `1 / (1 + z * 0.25)` and lifts it by
`z * unit * 0.12`, so a character further back is smaller and sits higher. That is
the whole of depth: a nearer figure is larger because it is nearer, and there is
no separate size dial to keep in step with it.

A trace carries the network file's own `at` for each neuron — three numbers,
`[x, y, z]` (decision 0025 in agent-neuron) — and the compiler enters each actor
at `at[0]` and `at[2]`. `y` is the network file's business; the stage ignores it.
A trace with no `at`, including every recording made before that field, still gets
the layout from the links (layers away from the neurons nothing reaches), so an
old show plays as it did.

```
{ at: [1, 1], enter: { id: "ada", who: "child", x: 0.4, z: -1 } }   // near: large
{ at: [1, 1], enter: { id: "iris", who: "oldman", x: 1.9, z: 1.7 } } // back: small
```

## Walking: how a body crosses the stage

`move` gives a place (`x`, `z`) or a step (`dx`, `dz`), and `over` says how many
beats the walk takes:

```
{ at: [2, 1], move: { x: -0.6, z: 1.2 }, over: 2, on: "ann" }   // a place
{ at: [4, 1], move: { dx: 0.9 }, over: 1.5, on: "ann" }         // a pace from here
```

maxcot's `Stage` can place a member but not walk one (`place()` sets `x` and `z`
outright), so the walk is the host's: every frame it stands the member where
score time says it has got to, eased in and out, and a seek lands in the middle
of a step rather than at its end. Depth is part of the walk — `z` in the same
command moves a character into or out of the picture, and its size follows.

Two consequences. Facing is decided when something turns the body, not while it
walks, so a long walk can leave a body facing the wrong way: set `view.yaw`
after it. And the camera only moves on a `shot`, so a walk toward the camera
does not zoom in by itself.

## Speech: where a line is drawn

`say` puts the line in a bubble over the speaker's head, anchored to the actor's
body box from the last frame, so it follows the camera through a cut. The page
keeps the older one-line caption under the picture behind a switch
(`bubbles | caption`, remembered per browser): a dense run reads more calmly as
one line than as a flicker of bubbles.

A bubble is page text over the canvas, not canvas paint: a page screenshot has
it, a `canvas.toDataURL()` capture does not (`spikes/002-bubbles`).

## The cue: how a payload directs its performance

An answer's JSON payload may carry, flat or under `stage`:

| field | checked against |
|---|---|
| `say` | a string; cut to 160 characters on one line |
| `pose` | maxcot's own pose table (`POSES`) |
| `look` | an id in this show's cast |
| `shot` | `wide`, `full`, `medium`, `close` |
| `skin` | `skinsByName()` — the look of the character that answered |
| `palette` | passed through to the skin |
| `move` | `{ x?, z?, dx?, dz?, over? }`, numbers only: a place in body units, a step of at most 6, `over` 0 to 8 beats |

Anything else is ignored. A payload is never a command list: the seven names
above are the whole vocabulary, and each is validated before it is used.

## What a trace compiles to

| trace event | the score |
|---|---|
| `signal` from a source | every receiver `look`s at it, the source `say`s the payload's line, the camera goes `wide` |
| `signal` from anyone else | the sender `look`s at the first receiver; two characters talking share one `wide` frame, one character gets a `full` |
| `answer` | `pose` (from the cue, else a speaking mouth), `say` (from the cue, else the payload's line), `look` (unless the forwarding signal on the same beat says it) |
| `quiet` | `mouth-shut` + `shrug` |
| `drop` | `replaced` → `fedup`, `expired` → `eyes-sleepy`, `hops` → `dunno`, on the neuron that dropped it |
| `error` / `unknown` | `eyes-furious` / `eyes-terrified` |
| `note` with `what: "retry"` | `eyes-suspicious` |
| the last moment | a `shot: wide`, then `end` with the show's title |
| anything else (`ground`, `finished`, an unknown type, an unknown field) | nothing |

The camera moves at most once every two beats, so it follows the scene rather
than every line.

## Round trip

`formatScore(show)` writes the document above; `parseShow(text)` reads it back
into the same show (a test pins the round trip event for event). So a show can
leave: `node scripts/score.mjs <trace.json> > duet.score`, then open that file
in the page, or paste it over a score in maxcot's studio.
