#!/bin/sh
# Run the troupe with the engine and write the trace the page plays.
#
#   sh scripts/run-troupe.sh
#
# Needs the Rust engine: $NEURON_ENGINE, or the debug binary next to the
# agent-neuron checkout. The trace it writes is src/traces/troupe.json, which
# the page loads as "troupe": six characters, six neurons, six skins.
set -eu

here=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
engine=${NEURON_ENGINE:-$here/../agent-neuron/rust-engine/target/debug/neuron-engine}

if [ ! -x "$engine" ]; then
  echo "no engine at $engine: set NEURON_ENGINE, or build agent-neuron's rust-engine" >&2
  exit 1
fi

cd "$here"
"$engine" check examples/troupe/troupe.network.json
"$engine" run examples/troupe/troupe.network.json \
  --inputs examples/troupe/troupe.inputs.jsonl \
  --trace src/traces/troupe.json
echo "wrote src/traces/troupe.json"
