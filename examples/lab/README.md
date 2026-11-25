# the lab — seven scientists, one question, nobody taking turns

A network, not a score. The question goes out to the whole lab at once; every
answer goes to the two or three people that scientist actually talks to; and
each of them decides for itself whether it wants the floor. So the conversation
wanders: three people answer the same line, one of them cuts in on a line that
was not for it, somebody changes the subject to the instrument in front of them,
and the branch that nobody picks up simply dies.

```
examples/lab/
  lab.network.json     the question, seven run neurons with their places, the mesh
  lab.inputs.jsonl     one cue: the question the room is asked
  mind/glm.mjs         the seven voices, the die, the moods, the step, the call
  mind/ada.mjs … lea.mjs   seven tiny files, one per scientist
```

```sh
sh scripts/run-lab.sh            # check + run, writes src/traces/lab.json
```

The page lists it under **a run, compiled**: eight actors (the cue asks), seven
of them in their own skins, in a room that has depth. Its **net** pane draws the
mesh - every neuron where the file puts it, every link an arrow - with one badge
under the room for the model all seven ask: `glm-5.3-flash:cloud`.

## The room

The lab is a bigger floor than a table: x from −5.6 to 5.2, z from −1.2 (the
bench the camera stands at) to 3.7 (the shelves at the back). A place is the
network file's `at` and the trace carries it, so the stage stands each scientist
there, and maxcot's own rule does the rest — `1 / (1 + z*0.25)` scales a member
and lifts it by `z * unit * 0.12`. The near bench is drawn large, the back of the
room small and high, and that is the depth.

## Nobody takes turns

- The cue is linked to all seven: everyone hears the question.
- The rest is a mesh, not a ring — each scientist is linked to two or three
  others, and the links are not symmetric (`ada ⇄ bruno`, but `rosa → jules` and
  not back). There is no order to fall into.
- Every program rolls a die before it calls the model: **0.8** it takes the
  floor, and a word it cares about (`proof`, `chord`, `model`, `pay`…) always
  gets it talking. When it does not, it prints nothing — the engine records a
  `quiet` answer and forwards nothing, so that branch of the argument stops
  where nobody picked it up.
- `maxHops: 2` is the room's limit, not a character's reaction: a line that
  reaches the end of the mesh is dropped, and a drop for that reason is not
  played as a shrug (`docs/SCORE.md`).

Two runs are two conversations. The committed trace is one of them.

## The chat

Every call adds a random mood from a list in `mind/glm.mjs` — tired and blunt,
distracted by the instrument, sure the last speaker is wrong, wanting to change
the subject — and the model is asked to interrupt, doubt, ask, or wander as that
character. Temperature is 0.85–1.0. The words are the model's; only whitespace
and the stage's 160-character cap are the repo's.

## They walk

Every answer carries a step: a half-pace of its own in body units (with a little
jitter), turned by the compiler into the stage's `move` command. The near ones
give ground, the back of the room comes down toward the benches, and because the
host turns a body to whoever it is looking at, the room keeps re-facing itself as
it moves. A scientist that answers twice has walked twice.

## The seven

| character | role | voice | skin | place (x, z) |
|---|---|---|---|---|
| ada | the analyst | precision as a moral position | print | −3.2, −1.2 (nearest) |
| jules | the outsider | asks what it pays for | ballpoint | 0.4, −1.0 |
| rosa | the computationalist | counts and bounds | manga | 3.4, −0.9 |
| bruno | the romantic | hears the zeros as a chord | riso | 5.2, 1.3 |
| iris | the historian | dates every claim | sketch | 3.2, 3.2 |
| otto | the physicist | random matrices and analogy | felttip | −0.4, 3.7 (furthest) |
| lea | the formalist | asks what "true" means | inkpunch | −4.2, 2.7 |

The show's ground is `stencil` (concrete), and the scientists are composited
over it in their own hands: seven hands on one wall.

## Notes

- A turn is one process and one cloud call, so the film is the sum of those
  latencies on one clock (~7 s here). The model refuses too many turns at once
  (HTTP 429), so the run holds it to three at a time (`--at-once 3`) and each
  program retries a refusal, a few hundred milliseconds later.
- No character is told who the others are or what was said before: a program
  receives one line. Personality is the file it runs.
