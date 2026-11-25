# AGENTS.md

agent-neuron-stage: a stage for agent-neuron networks, drawn by maxcot. A
network is a cast, a run is a performance. Sibling of agent-neuron,
agent-neuron-studio and agent-neuron-viz.

- Run `npm run check` before you finish (tsc, vitest, vite build). The tests
  need no engine; `scripts/run-duet.sh` does, and is how a trace is remade.
- **The engine is the authority on a network.** Nothing here reads a network
  file: the input is a trace (or a score), and the only verdict on a network
  comes from `neuron-engine check` / `run`. If the page needs something a trace
  does not carry, add it to the trace in agent-neuron with its tests, docs and
  a decision record — never guess it here.
- **A payload is data, never a script.** The stage's whole vocabulary for a
  payload is `say`, `pose`, `look`, `shot`, `skin`, `palette` (flat or under
  `stage`), each checked against maxcot's own tables before it is used. Do not
  add a key that reaches the DOM, the filesystem or `eval`.
- **The compiler is pure and tested; the host is thin.** `src/fromtrace.ts`
  and `src/fromscore.ts` are functions from a document to a `Show`, and every
  decision about a show lives there. `src/host.ts` only turns score commands
  into calls on maxcot's `Stage` and `Conductor`, and `src/main.ts` only wires
  the page. A new behaviour belongs in the compiler with a test, not in the
  renderer.
- **The score is maxcot's.** Emit the syntax maxcot's own parser reads (bars
  and beats, `at` first, one event per line), so a show can leave: it must
  round-trip through `parseScore`, and a test pins that. `say` and `end` are
  the stage's two own commands; everything else is maxcot's.
- **Do not invent time.** The film is the run on a linear clock; a run that
  wants air waits for it. Playback speed is the audience's, not the compiler's.
- `vendor/maxcot/` is upstream, unmodified, MIT. A fix belongs upstream; to
  re-pin, see `vendor/VENDORED.md`.
- Relative imports carry their extension (`.ts`).
- Tests use made-up data and the two committed traces; a test writes only
  inside a temporary directory. A fixture that is a real trace is copied, never
  fetched.
- Every text surface renders through the same escape (`escapeHtml` in the page)
  and nothing from a trace or a payload is ever set as HTML.
- This is a local tool: not deployed, and no push to `main` without Kevin's
  go-ahead. Nothing from `agent-neuron-kftcda` (names, lists, prices, tokens)
  goes in here.
