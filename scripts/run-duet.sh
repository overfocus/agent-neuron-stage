#!/bin/sh
# Run the duet with the engine and write the trace the page plays.
#
#   sh scripts/run-duet.sh
#
# Needs the Rust engine: $NEURON_ENGINE, or the debug binary next to the
# agent-neuron checkout. The trace it writes is src/traces/duet.json, which the
# page loads as "duet"; a run takes about 4 seconds.
set -eu

here=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
engine=${NEURON_ENGINE:-$here/../agent-neuron/rust-engine/target/debug/neuron-engine}

if [ ! -x "$engine" ]; then
  echo "no engine at $engine: set NEURON_ENGINE, or build agent-neuron's rust-engine" >&2
  exit 1
fi

cd "$here"
"$engine" check examples/duet/duet.network.json
"$engine" run examples/duet/duet.network.json \
  --inputs examples/duet/duet.inputs.jsonl \
  --trace src/traces/duet.json
echo "wrote src/traces/duet.json"
