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
| `style` | a skin name (`pencil`, `riso`, `hologram`, …) | — | restyles the whole cast; `palette` names one of its palettes |
| `who` | a maxcot cast name | the actor | recasts it (the design morphs) |
| `manner` | `{ weight, idle, gaze, rest }` | the actor | how it moves: 0 light and springy, 1 heavy and slow |
| `set` | a design dial (`"body.w"`), with `to` a number | the actor | one dial; a seek snaps it rather than easing the morph |
| `say` | a line | the speaker | **the stage's own**: the bubble over the speaker's head, or the line under the picture |
| `end` | `{ card: "logo", text: "DUET" }` | — | **the stage's own**: the end card |

Modifiers, which qualify a command and are never commands themselves: `at`,
`on`, `to`, `from`, `palette`, `cut`. A command the stage does not know is
reported once and ignored; a command it knows with a value it does not is
dropped (no pose that the rig cannot draw, no skin that does not exist).

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
| `skin` | `skinsByName()` |
| `palette` | passed through to the skin |

Anything else is ignored. A payload is never a command list: the six names
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
