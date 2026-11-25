# agent-neuron-stage

A stage for [agent-neuron](../agent-neuron) networks, drawn by
[maxcot](../maxcot): a network is a cast, a run is a performance.

A neuron becomes a character. Its `id` names it, its `description` is what it
is, its kind decides how it carries itself, and a link is who it turns to. Run
the network, and its trace is the script: every answer is a line and a face,
every quiet is a shrug, every dropped line is a refusal, and the reply chain is
the scene. A character can be one neuron or a network of its own (a composed
neuron), so a character with a mind inside it is a file this repo already
knows how to draw.

## Run it

```sh
npm install
npm run dev            # http://localhost:5210
```

The page opens on **duet**: two characters, each a three-neuron mind, meeting
on a stage. The run behind it is real (`examples/duet/`, four engine
processes), and its trace is committed at `src/traces/duet.json`. **writer** is
a network's answer: one program that writes a scene and answers with it
(`examples/writer/`). **alerts** is a recording shipped with agent-neuron: a
network with six neurons and 261 events, compiled the same way.

- **play / pause** (space), **scrub**, **½×** and **2×**: the film is the run
  on one clock, and the speed is yours.
- **bubbles | caption**: a line hangs over the speaker's head, tail on the head,
  and follows the camera through a cut; switch to one line under the picture for
  a dense run. The switch is remembered.
- **cast**: every neuron as an actor, with the maxcot actor that plays it, its
  kind, its weight and its line of description. Click a row, or a character on
  the stage.
- **score**: the show as a maxcot score, which is the record of the
  compilation. It is what `node scripts/score.mjs <trace.json>` prints to
  stdout, and maxcot's own studio plays it.
- **events**: the trace, event by event, with the line each one carried.
- **open a file**: a `.json` trace is compiled and played; a `.score` (or a
  JSON score document) is played as it is. That second door is how a network
  that answers with a score becomes a show.

## The idea, in four lines

1. **A neuron is an actor.** The header of a trace is a cast list already
   (id, kind, description); the links are the blocking.
2. **A composed neuron is a character with a mind.** Its inside is a network
   the engine seals: the stage sees one body and one voice.
3. **Interactions are the links.** A signal is who looks at whom; a reply
   chain is an exchange; the body turns to whoever it addresses, and `maxHops`
   is how long an argument lasts.
4. **A payload may direct its own performance.** An answer that carries
   `{ say, pose, look, shot, skin }` — the line, and the face to say it with —
   is drawn that way. Anything else in a payload is ignored.

`docs/DESIGN.md` is the longer version, including what maxcot does not have
yet, what that costs, and the five questions it answered on 2026-11-24.
`docs/SCORE.md` is the command reference.

## Make a trace, or a show

```sh
sh scripts/run-duet.sh             # check + run examples/duet, write src/traces/duet.json
sh scripts/writer-scene.sh         # check + run examples/writer, write examples/writer/scene.score
node scripts/score.mjs src/traces/duet.json > duet.score
node scripts/score.mjs - < a-score.json > a-score.score
```

Both `run-*` scripts want a `neuron-engine` binary: `$NEURON_ENGINE`, or the
debug build next to this repo. The trace committed here was written by
`neuron-engine 0.0.0 58d184e2b1a6` from [agent-neuron](../agent-neuron) `main`.

## What is where

| Path | What it is |
|---|---|
| `src/trace.ts` | reads an agent-neuron trace (format v1), tolerantly |
| `src/cast.ts` | the header as a cast: actor, manner, place, from the links |
| `src/bubble.ts` | where a speech bubble goes: above the head, inside the frame, tail on it |
| `src/bubbles.ts` | the bubble itself, as page text over the canvas |
| `src/fromtrace.ts` | the compiler: trace → show, and the cue protocol |
| `src/fromscore.ts` | a score document → show (maxcot's syntax, or JSON) |
| `src/show.ts` | what a show is, and how it writes itself back out as a score |
| `src/host.ts` | the thin host: commands → a maxcot `Stage` and `Conductor` |
| `src/main.ts` | the page: canvases, transport, panes, file input |
| `examples/duet/` | the two-character network, its minds, its inputs |
| `examples/writer/` | one program that answers a whole scene, and the scene it answered |
| `spikes/` | throwaway experiments with a verdict: facing, speech bubbles |
| `vendor/maxcot/` | maxcot's library, unmodified, MIT (see `vendor/VENDORED.md`) |

## Check

```sh
npm run check          # tsc, vitest (59 tests), vite build
```

The tests compile both committed traces, play a show through maxcot's real
conductor and stage in Node, and scrub it two ways to the same state. They also
pin the two rules that keep this honest: every pose the compiler emits exists
in maxcot's rig, and every command it emits is one the stage knows.

## It is a local tool

Nothing is deployed, nothing is uploaded, and no trace is fetched from
anywhere: the page reads the two bundled traces or a file you pick. No push to
`main` without Kevin's go-ahead.
