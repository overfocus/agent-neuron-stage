# writer — a scene a network wrote

One source, one program. The brief goes in, and the program answers with a
whole scene: two characters who were not there before, their blocking, their
lines, a style change and a card. The answer is a maxcot score document, which
is why the stage can play it without knowing a network was involved.

```
call (source) ──→ write (run)          write's answer is the run's stdout
```

```sh
sh ../../scripts/writer-scene.sh       # check + run, writes scene.score
```

`scene.score` is committed: it is what `write.mjs` answered for
`brief.inputs.jsonl`, written out in maxcot's score syntax. A test runs the
program again from the same brief and compares — same brief, same scene, no
randomness.

The page lists it as **writer**; "open a file" opens any score the same way.
This is the "a run can cast" door in `docs/DESIGN.md` §5: the network creates
the characters, the stage draws whatever it answered.
