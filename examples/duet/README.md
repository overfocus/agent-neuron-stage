# duet — two characters, each a network

One network, three characters. `cue` is a source: the line both characters
hear. `max` and `kid` are composed networks (SPEC 2.6), each one character from
the outside and a mind on the inside.

```
cue (source) ──→ max (composed) ──→ kid (composed)
     └────────→ kid (composed) ──→ max (composed)
```

Each character is a folder:

```
characters/max/
  max.character.network.json     entry: hear, exit: speak
  mind/hear.mjs                  keeps the words
  mind/feel.mjs                  decides what they did to it
  mind/speak.mjs                 answers { say, pose } once it has both
```

`speak` is a threshold-2 join of `hear` and `feel`: a character does not speak
until it has both what was said and how it felt about it. `mind/lib.mjs` holds
the three lines of vocabulary they share (reading stdin, finding the line,
reading a feeling off it). The lines in each `speak.mjs` are a table standing
in for a model: a model neuron answers the same two fields.

`maxHops: 3` on each character is why the exchange ends. An answer is forwarded
along every outgoing link, so the characters keep answering each other until
one of them refuses an input at hop 4 — a `drop` with reason `hops`, which the
stage draws as a shrug.

## Run it

```sh
sh ../../scripts/run-duet.sh          # check + run, writes src/traces/duet.json
```

Needs `neuron-engine` (`$NEURON_ENGINE`, or the debug build in the agent-neuron
checkout beside this repo). One run takes about four seconds and the trace has
24 events; the page plays it as an eleven-second film.

## Make another character

Copy a folder, change the network's `name`, its `mind/speak.mjs` table and its
`description`, add it to `duet.network.json` with an `at` and links both ways.
Nothing else: the stage casts it by its id, gives it a maxcot actor, and puts
it one layer past the `cue`.
