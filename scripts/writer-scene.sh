#!/bin/sh
# Ask the writer network for a scene, and keep the answer as a score.
#
#   sh scripts/writer-scene.sh
#
# The program's answer is the run's stdout (it is the neuron with no outgoing
# links), and the answer is a score document: characters, blocking, lines, a
# style change, a card. It is written out as maxcot score text, so
# examples/writer/scene.score is both readable and playable - in the page, and
# in maxcot's own studio.
set -eu

here=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
engine=${NEURON_ENGINE:-$here/../agent-neuron/rust-engine/target/debug/neuron-engine}

if [ ! -x "$engine" ]; then
  echo "no engine at $engine: set NEURON_ENGINE, or build agent-neuron's rust-engine" >&2
  exit 1
fi

cd "$here"
"$engine" check examples/writer/writer.network.json
"$engine" run examples/writer/writer.network.json \
  --inputs examples/writer/brief.inputs.jsonl \
  | node scripts/score.mjs - \
  > examples/writer/scene.score
echo "wrote examples/writer/scene.score"
