# troupe — six characters, six neurons, one run

A network, not a score. One cue reaches six characters; each answers with a
line, a face and **its own hand** (`{ say, pose, skin }`); every answer is sent
round the ring, and `maxHops: 2` stops the exchange. Run it and the trace is a
scene in six skins — the compiler gives each character's look to that character
(`style … on`), and the stage composites the mixed cast (`spikes/003`).

```
examples/troupe/
  troupe.network.json     the cue, six run neurons, the ring of links
  troupe.inputs.jsonl     two cues: a question, then "Then it is pink"
  mind/tell.mjs           one table: each character's skin, pose, claim, retort
  mind/ann.mjs … fay.mjs  six three-line files that name a character to that table
```

```sh
sh scripts/run-troupe.sh          # check + run, writes src/traces/troupe.json
```

The page lists it under **a run, compiled**: seven actors (the cue speaks first),
six of them in their own skins, 147 score events.

## Why a network and not a scene file

A score says what happens; a network decides it. The troupe is the second kind:
the words each character says are computed from what it heard, so the scene is
different if the cue changes. `ann` retorts only when someone says "pink"; `bo`
only when it is "screentone". Change the second cue to "Then it is light" and
Ed answers instead.

## The one thing a neuron cannot know

A program gets the payload and nothing else: no neuron id, no cast, no stage. So
"who am I" is which file the network runs — `mind/ann.mjs` is three lines long
and the table does the rest. A model neuron would answer the same four fields
(`say`, `pose`, `skin`, `look`) and the stage would draw it the same way.
