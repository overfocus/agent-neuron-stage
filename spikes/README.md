# spikes

Throwaway experiments, one directory each: a question, a built thing that
answers it, a verdict. They are not part of the build (`vite build` does not
see them) and nothing in `src/` may import from them; `tsc` does typecheck them,
so the code quoted in a verdict is code that compiles.

- `001-facing` — can two characters face each other by orientation? What
  maxcot's `look` actually does, and what it takes to turn a body.
- `002-bubbles` — a speech bubble anchored to the speaker's head: geometry,
  two renderers, and what follows the camera.

Both are pages: `npm run dev`, then `/spikes/001-facing/` and
`/spikes/002-bubbles/`.
