# riemann — seven mathematicians, seven neurons, one conversation

A network, not a score. One cue asks the table about the Riemann hypothesis;
`ada` answers it, her answer goes to `rosa`, hers to `bruno`, and so on round
the arc to `jules`, whose answer is turned away at the hops limit. Every one of
the seven is a `run` neuron whose program asks a cheap model for a line, and
every one answers with **its own voice, its own face and its own hand** — and
stands at its own place in the room, so the stage draws depth rather than a line
of people.

```
examples/riemann/
  riemann.network.json     the cue, seven run neurons with their places, the chain
  riemann.inputs.jsonl     one cue: the question the table is asked
  mind/glm.mjs             the seven voices, and the call to the model
  mind/ada.mjs … jules.mjs seven three-line files, one per character
```

```sh
sh scripts/run-riemann.sh        # check + run, writes src/traces/riemann.json
```

The page lists it under **a run, compiled**: eight actors (the cue asks), seven
of them in their own skins, 17 trace events, a conversation of about eight
seconds.

## The model

`glm-5.3-flash:cloud`, through the ollama daemon on `127.0.0.1:11434` this
machine is signed in to — a cloud flash model, so a turn costs about a second
here. `RIEMANN_MODEL` overrides it. Two details matter:

- **`think: false`.** GLM is a thinking model: with thinking on it spends the
  token budget reasoning and answers with an empty string, which reads as a
  blank line, not as an error.
- **`format: "json"`**, and the program parses the JSON, repairs a fenced or
  chatty answer, clips the line, and checks the pose against the character's own
  list before it answers. A pose outside that list falls back to the character's
  signature face; a line that is not there at all is an error, not a made-up
  line, so the run records a failure rather than inventing dialogue.

The program answers `{ say, pose, skin }` — three of the six names a cue may
carry (`docs/SCORE.md`). Nothing in it can reach the stage beyond those fields.

## The seven voices

Each character's prompt is in `mind/glm.mjs`: a temperament, a way of talking,
and the poses it is allowed to wear. The words in the committed trace are the
model's own, unedited apart from whitespace and the stage's 160-character cap.

| character | role | voice | skin | place (x, z) |
|---|---|---|---|---|
| ada | the analyst | precision as a moral position; will not let "probably" stand | sketch | 0.4, −1.0 (nearest) |
| rosa | the computationalist | counts and bounds; bored by philosophy | pixel | 3.3, −0.6 |
| bruno | the romantic | hears the zeros as a chord; overclaims cheerfully | riso | 4.7, 1.1 |
| iris | the historian | dates every claim; corrects the record | inkpunch | 1.9, 1.7 |
| otto | the physicist | random matrices, spectra, analogy over proof | manga | −1.0, 1.6 |
| lea | the formalist | asks what "true" means; mentions independence | felttip | −2.5, −0.4 |
| jules | the outsider | asks what it pays for; plain, impatient | stencil | −3.9, 1.2 |

The seven ids land on seven different maxcot bodies by the cast's own stable
rule (`src/cast.ts`: id -> a face), so the table really is seven people and not
one person printed seven ways.

## Why the room has depth

The places are the network file's `at` — descriptive, nothing in the run acts
on them — and the trace now carries them (decision 0025 in agent-neuron), so the
stage stands each character at `at[0]` and `at[2]`. maxcot scales a member by
`1 / (1 + z * 0.25)` and lifts it by `z * unit * 0.12`: `ada` at z −1.2 is the
largest figure in the frame, `otto` at z 2.6 is about two-fifths her size and
higher up, and the wide camera frames the span. That is the depth.

## What a neuron cannot know

No character is told who the others are, and none is given the conversation:
a program receives one input — the line before it. Each voice is the file the
network runs (`mind/ada.mjs` is three lines), which is the same rule `troupe`
uses. The chain is the memory: every answer says something about the line it
just heard.

## Notes

- A turn is one process and one HTTPS call, so the run is the sum of seven
  model latencies (~9 s here) and the film is that, on one clock.
- The committed trace is a recording of one conversation. Running the script
  again produces a different one — that is the point of a network.
