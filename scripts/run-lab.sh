#!/bin/sh
# Run the lab with the engine and write the trace the page plays.
#
#   sh scripts/run-lab.sh
#
# Needs the Rust engine ($NEURON_ENGINE, or the debug binary next to the
# agent-neuron checkout) and the cheap model: GLM through the ollama daemon on
# 127.0.0.1:11434 (`glm-5.3-flash:cloud`; override with LAB_MODEL). The run is
# random - who takes the floor is a die, so two runs are two conversations.
# The trace it writes is src/traces/lab.json.
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
"$engine" check examples/lab/lab.network.json
"$engine" run examples/lab/lab.network.json \
  --inputs examples/lab/lab.inputs.jsonl \
  --at-once 3 \
  --trace src/traces/lab.json
echo "wrote src/traces/lab.json"
