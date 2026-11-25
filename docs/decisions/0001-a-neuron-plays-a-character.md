# Decision record 0001: a neuron plays a character (2026-11-24)

**Status: decided by Kevin on 2026-11-24 and built as the first pass.** His idea:
bring maxcot into an agent-neuron-like studio, so that networks can create
characters and interactions — "perhaps a character is a neuron or neuron
network". This record is the shape that came out of it, and what was built.

## The problem

maxcot is a character studio with no notion of agents deciding anything: its
scores are written ahead of time. agent-neuron is a network of agents with no
face: its answers are JSON, its record is a trace. Bringing the two together
could mean a new protocol (a "stage" neuron kind, a stage event in the trace),
a fork of maxcot with a network renderer, or a bridge that treats a run as a
performance. Only the last one can be built without changing either side — and
only the last one is worth building, because both sides are already the
authority on their half.

## The decision

1. **A neuron is an actor, and the network file is the cast sheet.** Nothing is
   added to the network format: `id` names the character, `description` is its
   note, the kind decides its manner, `threshold` makes it heavier (it waits
   for a group), and the links are the blocking and the gaze. `at` was already
   a descriptive field for tools like this one (agent-neuron decision 0011);
   the *trace* does not carry it, so the stage blocks the cast in layers taken
   from the links — the network's own shape. No engine change, no new field.
2. **A composed neuron is a character with a mind.** agent-neuron's composed
   neuron (SPEC 2.6) makes a network one neuron and seals its inside. On the
   stage that is a character: one body, one voice, and an inside the audience
   cannot see. "A character is a neuron network" therefore needed a drawing,
   not a concept.
3. **The trace is the script; the compiler is a pure function.** `compileTrace`
   turns a trace into a maxcot score — a documented, inspectable document, not
   a renderer. The page plays that score; nothing else in the app decides what
   happens on a beat.
4. **A payload may direct its own performance, through one whitelist.** An
   answer's JSON may carry `say`, `pose`, `look`, `shot`, `skin`, `palette`
   (flat or under `stage`), each checked against maxcot's own tables. A payload
   is data: it can name a pose the rig has, never a command.
5. **The stage never parses a network.** The inputs are a trace and a score.
   The engine remains the only authority on a network; a second opinion here
   would drift.
6. **Time is linear.** The film is the run on one clock (`t` ms → bars and
   beats); nothing is quantized or invented, and playback speed is the
   audience's. A run that wants air waits for it in the run.
7. **The output stays maxcot's.** The score is written in maxcot's own syntax
   and round-trips through its parser, so a show can leave this app for
   maxcot's studio. `say` and `end` are the only two commands that are ours.

## What was built, and what it proved

- The library: tracing (`src/trace.ts`), casting (`src/cast.ts`), the compiler
  (`src/fromtrace.ts`), the score reader/writer (`src/show.ts`,
  `src/fromscore.ts`), and a thin host over maxcot's `Stage` and `Conductor`
  (`src/host.ts`), with 47 tests including a real show played through maxcot's
  conductor in Node and scrubbed two ways to the same state.
- The example: `examples/duet/` — one network, three characters, two of them
  composed networks with a three-neuron mind each (hear → feel → speak, speak a
  threshold-2 join). Run by the Rust engine, its trace is committed at
  `src/traces/duet.json`. The argument in it is not scripted: the characters
  answer each other because the engine forwards an answer along every outgoing
  link, and it stops because `maxHops` 3 refuses the ninth line.
- The second door: the page plays any maxcot score, including a JSON score
  document — the form a program neuron can answer with. `examples/writer/` is
  that door taken: one source into one program, whose answer is a scene with
  two characters who were not there before. Its answer is kept as
  `examples/writer/scene.score`, and a test re-runs the program from the same
  brief and compares.
- maxcot itself is vendored unmodified (MIT), because its workspace publishes
  nothing to npm yet; `vendor/VENDORED.md` pins the commit.

## Not decided here

- Whether the cue becomes part of agent-neuron's documented payload convention
  (it needs no engine change either way).
- A character sheet as a file format; a writer network that emits one.
- A `stage` pane inside agent-neuron-studio instead of this app.
- How to film a long wait, and whether a character's mind should be a `serve`
  neuron so it remembers. Both are in `docs/DESIGN.md` §9, as questions with
  recommendations.

## How it is checked

`npm run check` (tsc, 47 vitest tests, vite build). The tests compile both
committed traces, pin that every pose and every command the compiler emits is
one the stage can draw, round-trip a show through maxcot's score parser, and
play the duet end to end through maxcot's conductor. The run that made the
trace is reproducible with `sh scripts/run-duet.sh`.
