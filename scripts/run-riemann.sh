#!/bin/sh
# Run the riemann table with the engine and write the trace the page plays.
#
#   sh scripts/run-riemann.sh
#
# Needs the Rust engine: $NEURON_ENGINE, or the debug binary next to the
# agent-neuron checkout, and the cheap model it answers with: GLM through the
# ollama daemon on 127.0.0.1:11434 (`glm-5.3-flash:cloud`; override with
# RIEMANN_MODEL). The trace it writes is src/traces/riemann.json.
set -eu

here=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
engine=${NEURON_ENGINE:-$here/../agent-neuron/rust-engine/target/debug/neuron-engine}

if [ ! -x "$engine" ]; then
  echo "no engine at $engine: set NEURON_ENGINE, or build agent-neuron's rust-engine" >&2
  exit 1
fi

curl -s --max-time 5 http://127.0.0.1:11434/api/version >/dev/null 2>&1 || {
  echo "the model's daemon is not answering on 127.0.0.1:11434: start ollama" >&2
  exit 1
}

cd "$here"
"$engine" check examples/riemann/riemann.network.json
"$engine" run examples/riemann/riemann.network.json \
  --inputs examples/riemann/riemann.inputs.jsonl \
  --trace src/traces/riemann.json
echo "wrote src/traces/riemann.json"
