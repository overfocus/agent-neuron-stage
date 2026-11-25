# A stage for agent-neuron — design note

**What this is.** An exploration, built far enough to watch: agent-neuron
networks played as character film by maxcot. The claim under test is that the
two fit without a new protocol, because a network file already describes a
cast and a trace already describes a performance.

---

## 1. The two halves

**maxcot** is a character animation studio drawn entirely in code: one rig (a
rounded, tapered box with a face mapped on its front and two floating hands),
26 skins that paint the same rig, 8 actors that are overrides of one design
table, 95 poses across six layers (body, feelings, eyes, mouth, hands), a film
player, and a score you write in bars and beats. A skin never sees 3D: the rig
flattens each pose into tagged polygons, and the skin paints them. Everything
is deterministic and dependency-free, and it runs in Node as well as a browser.

What maxcot has no notion of: *two agents deciding anything*. It has a
timeline, not a plot. Its scores are written by a person (or a program) ahead
of time.

**agent-neuron** is a network of neurons that exchange payloads. A neuron is a
program (or a person, or an endpoint, or a whole network); a link says who can
hear whom; a threshold neuron waits for several senders; `maxHops` bounds a
chain; a run writes a trace, which is designed to be replayed without running
anything. What agent-neuron has no notion of: *a face*. Its agents answer in
JSON.

The fit: **agent-neuron decides what happens; maxcot shows it.**

## 2. The mappings

| agent-neuron | the stage | why it is not a stretch |
|---|---|---|
| a neuron | an actor | the trace header names every neuron, with a kind and a description: a cast list |
| `id` | the character's name | it is what the panes, the score and the captions call it |
| `description` | its character note | the header already carries one line per neuron |
| kind (`source`, `run`, `serve`, `http`, `human`, `composed`) | the cast member and the manner | a source is light and sways, a character is heavier and waits; `composed` and `human` earn a close frame |
| `threshold` | weight | a neuron that waits for a group carries itself heavily |
| links | blocking and gaze | the cast is laid out in layers from the neurons nothing reaches; a signal is who turns to whom |
| answer payload | a line, and optionally a face | `{ say, pose }` is all a performance needs |
| `quiet` | a shrug | it chose to say nothing, and that is a choice, not an error |
| `drop` (`replaced`, `expired`, `hops`) | a refusal, a tired look, a shrug | three different reasons not to hear a line |
| `error`, `unknown` | anger, fear | a failed call and an unaccountable effect are not the same thing |
| reply chain (`trace`, `replyTo`, `cause`) | an exchange; two characters share a frame | the chain is the conversation |
| `maxHops` | how long an argument lasts | the engine ends the scene, not the compiler |

Two of these are load-bearing.

**The cast is already in the file.** Decision 0011 in agent-neuron made `at` a
descriptive field "for people and tools, never for an engine". The stage is
exactly such a tool. The trace does not carry `at` (a trace records what
happened; a position never makes anything happen), so the blocking is read
from the links instead: layers from the roots, one actor beside another inside
a layer. That is not a lesser choice — it is the *network's shape* as
blocking, and it is stable: the same trace always casts the same way.

**A character can be a network.** agent-neuron's composed neuron (SPEC 2.6)
makes a whole network one neuron: its `entry` receives the payload, its
`exit` answers, and sealing means inner ids, inner signals and inner errors
never reach the outer trace. On the stage that is a proscenium: one body, one
voice, and a mind nobody in the audience can see. So "a character is a neuron
or a neuron network" needed no new concept — only the drawing.

## 3. The duet, which is a real run

`examples/duet/` is one network and three characters:

```
cue (source) ──→ max (composed) ──→ kid (composed)
     └────────→ kid (composed) ──→ max (composed)
```

Each character is a folder with its own network and its own three programs:

```
hear  →  feel  →  speak        speak waits for both (threshold 2)
  └──────────────→
```

`hear` keeps the words, `feel` decides what they did to it, and `speak` — which
fires only with both in hand — answers `{ say, pose }`. The lines are a small
table in `speak.mjs`, standing in for a model: a model neuron would answer the
same two fields and the stage would draw it the same way.

The committed trace (`src/traces/duet.json`) is one take, ~4 seconds, 24
events. What the page shows:

| t | who | what |
|---|---|---|
| 0 ms | cue | "You're late." — both characters turn to hear it |
| 712 ms | kid | "You always say that." (feel-sulking) |
| 841 ms | max | "The tide kept me." (deal) |
| 1383 ms | max | "And you always keep score." (fedup) |
| 1383 ms | kid | drops it: `hops` 4 above its `maxHops` 3 → a shrug |
| 1533 ms | kid | "The tide is not an excuse." (feel-angry), then max drops it |

Then the second cue ("I brought the moon back.") plays the same shape warmer.
None of that is scripted anywhere: the two characters answer each other
because the engine forwards an answer along every outgoing link, and the
argument ends because `maxHops` refuses the ninth line. **The topology is the
plot.** A different set of links is a different scene, and the stage needs no
change to show it.

## 4. A payload may direct its own performance

The one extension, and it is a convention, not a schema: an answer's JSON
value may carry

```json
{ "say": "The tide kept me.", "pose": "deal" }
```

or, nested and richer,

```json
{ "say": "…", "stage": { "pose": "feel-sulking", "look": "max", "shot": "close", "skin": "riso", "palette": "red" } }
```

`say` is the caption, `pose` one of maxcot's 95, `look` another actor's id,
`shot` a framing, `skin`/`palette` a change of visual style. Everything else
is ignored. The compiler checks each name against maxcot's own tables, so a
payload cannot hand the stage a pose that draws nothing, a skin that does not
exist, or a command at all. **A payload is data.** That is the whole security
model, and it is why nothing here needs to run, parse or trust a program.

Without a cue, the stage still performs the answer (a speaking mouth), the
quiet (a shrug), the drop (a refusal) and the failure (a face). A network that
says nothing about how it looks is still watchable; a network that cares can
direct itself.

## 5. Three doors for authorship

The user's question was whether networks could *create* characters and
interactions. There are three levels, and the repo has the first two:

1. **The network file is the cast sheet.** Nothing to author: neurons, kinds,
   descriptions and links are enough to cast, block and play a run. (Built.)
2. **A run can cast.** The page plays any maxcot score, including a JSON score
   document — which is exactly what a program neuron can answer with. A
   "writer" network (a source, a program, an exit) whose answer is
   `{ title, bpm, events: [{ at, enter: … }] }` therefore produces a show, and
   the stage plays it without knowing a network was involved. (Built as a
   door: `parseShow` + the file input. The example writer network is the next
   thing to add, and needs no new code.)
3. **A network can write another network.** A program that emits a
   `.network.json` is already possible in agent-neuron (a program's answer is
   just JSON, and a `may.write` path lets it write a file); the studio can then
   check and run it. Character creation as a network's output is a small step
   from here, and this repo would not need to change: it plays whatever the
   next run records. (Not built. The interesting design work is what a
   character sheet would hold, not the transport.)

## 6. Time

The film is the run on a **linear** clock: `t` ms → bars and beats at the
show's tempo (100 bpm by default, one bar of cast entrances before the run
starts). Nothing is quantized, nothing is invented: a run that wants air waits
for it in the run (a `within`, a timeout, a human neuron), and playback speed
(1×, ½×, 2×) is the audience's choice, not the compiler's.

The cost is visible: a machine run is a short film. The duet's 3.7 seconds of
run is an eleven-second film (one bar of entrances, the run, two beats for the
card, the tail), and the alert storm's 261 events land in 12.8 seconds — a
dense piece where captions flicker. A long wait would be worse: a human
neuron's hour-long `within` would be an hour of film. **This is the sharpest
open question in the design** (see §9).

## 7. What this repo refuses to do

- **It never parses a network.** The inputs are a trace and a score. The engine
  stays the authority on a network; a second opinion here would rot.
- **It never invents a beat** (see §6).
- **It never re-implements maxcot.** One host, one `Stage`, one `Conductor`;
  the commands are a switch. Everything about *what* happens is a compiler
  decision with a test.
- **It never renders text itself on the canvas.** A caption is an HTML line
  under the stage, and the end card is maxcot's `card` command; maxcot has no
  text primitive, and inventing one here would be the wrong layer.
- **It never runs anything it is given.** A payload, a score, a trace: data.

## 8. What maxcot does not have yet, and what that costs

| Missing | Cost today | Where the change belongs |
|---|---|---|
| text on the canvas (a speech bubble) | captions live outside the picture; a screenshot of the stage alone has no dialogue | maxcot (a skin-level primitive) |
| per-actor skins | one skin paints the whole cast, so a cue's `skin` restyles everyone | maxcot (`Stage` holding a skin per member) |
| a text/word pose vocabulary | the 95 poses are posture and face, not speech; a line and a pose can agree but never *perform* the words | maxcot, or a stage-side animation of the mouth while a caption holds |
| state that survives a line | a `run` neuron is a fresh process per signal, so each character answers from scratch; a character with a memory needs a `serve` mind | agent-neuron (`serve` exists; the mind programs would change) |
| audio | maxcot's studio has a WebAudio drum machine; the stage has no sound, so the "score" in the name is visual only | this repo (a run's ms → hits) if it ever matters |
| a cast larger than 8 | extra neurons reuse maxcot's 8 actors | maxcot (`cast()` is public; a design table per character) |

None of these blocks the idea. The first two are the ones I would ask for.

## 9. Open questions (numbered for a decision)

1. **Does the cue belong in the SPEC?** Today `{ say, pose }` is a convention of
   this repo. Making it official would mean one paragraph in agent-neuron's
   docs (a payload *may* carry stage direction) and no engine change at all.
   Recommendation: keep it a convention until a second tool wants it.
2. **A character sheet?** A file that holds a character's name, its design, its
   mind and its lines (today: a folder holding a network and three programs).
   A sheet would be the thing a network writes to create a character.
   Recommendation: build the writer network first; a sheet only if two
   characters' folders feel repetitive.
3. **Separate app, or a pane in agent-neuron-studio?** The studio already opens
   a trace and replays it as a table. A `stage` pane there would put the film
   where a person already is, at the cost of a second renderer inside a repo
   whose rule is "one engine, one opinion". Recommendation: keep this repo
   separate until the studio's trace pane and this one agree on a shape.
4. **Long waits.** A run that waits an hour should not be an hour of film.
   Options: compress every gap over *n* seconds to a beat (and say so on screen,
   the way a film says "three hours later"), or leave it and let the audience
   scrub. Recommendation: compress with a visible cut card, once a real network
   of ours has a wait worth filming.
5. **A `serve` mind per character?** A character that remembers the last line
   is a better actor and a heavier engine process. Recommendation: yes, as soon
   as a scene needs a grudge.
