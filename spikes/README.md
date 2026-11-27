# spikes

Throwaway experiments, one directory each: a question, a built thing that
answers it, a verdict. They are not part of the build (`vite build` does not
see them) and nothing in `src/` may import from them; `tsc` does typecheck them,
so the code quoted in a verdict is code that compiles.

- `001-facing` — can two characters face each other by orientation? What
  maxcot's `look` actually does, and what it takes to turn a body.
- `002-bubbles` — a speech bubble anchored to the speaker's head: geometry,
  two renderers, and what follows the camera.
- `003-mixed-and-many` — a skin per character, and how many fit on a stage.
- `004-iso-tiles` — an isometric tile room in three.js: maxcot characters as
  billboards, `move` as an A* walk across tiles, and 3D models as skins. Round
  two: a 36×28 room with props, a rigged robot whose clips play maxcot's poses,
  and "the shadow", a written scene through the Porch's seven Jung stations.
  Round three: "life", five characters with no script, each with an inner
  network (seven drives and a will) run live by `neuron-engine` through
  `life/bridge.mjs`, and a camera that follows whose story is happening.

Both are pages: `npm run dev`, then `/spikes/001-facing/` and
`/spikes/002-bubbles/`.
