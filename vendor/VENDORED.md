# Vendored: maxcot

`vendor/maxcot/` is a copy of the `packages/maxcot` library from
[shibli21/maxcot](https://github.com/shibli21/maxcot), MIT, so this repo builds
with plain npm and no bun: the upstream workspace publishes nothing to npm yet.

- commit copied: `0668f32784bfccb3714e9d93b18585bc91126e3a` (2026-11-25,
  "Actor manner: weight, idle habit, gaze habit, rest pose")
- copied: `packages/maxcot/src/`, `LICENSE`, `README.md`
- left out: the upstream tests, `dist/`, the studio app

The copy is unmodified. `vite.config.ts` and `tsconfig.json` alias the package
specifiers `maxcot`, `maxcot/skins`, `maxcot/film` and `maxcot/score` to the
sources, so the library is read as TypeScript, not as a build.

To re-pin: copy `packages/maxcot/src` again over `vendor/maxcot/src`, update the
commit above, and run `npm run check`. Do not edit files under
`vendor/maxcot/src` — a fix belongs upstream.
