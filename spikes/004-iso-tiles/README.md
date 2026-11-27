# spike 004: an isometric tile room in three.js

Three questions, one page: can the stage's characters live in a 3D tile room,
walk across it by real paths, and be drawn either by maxcot or as a 3D model?

Round two (below) asks the same of a big room with scenery, a rigged model,
and a scene written by hand: **the shadow**, the seven stations of the Porch's
Jung piece as one walk.

Run it with `npm run dev`, then open `/spikes/004-iso-tiles/`. The page has:

- a show picker: `the shadow` (the written scene, 36×28), then `lab` (walks), `duet` and `troupe` (stand and talk) in the small room
- play, restart and a scrubber
- four looks: `as written` (the score's own), `maxcot`, `mixed` and `models`
- `whole room`, and a `wander` button that sends everyone to a random tile.

Click a character and then a tile to walk it there. Drag to look around (the
camera is yours until the score's next shot). The wheel zooms.

To remake the neuron model, run `node spikes/004-iso-tiles/make-model.mjs`.

## What it is

- **`grid.ts`** (pure, with no three.js or DOM):
  - The room is rows of text: `.`/`0`..`3` is floor at a height, `#` is a wall and `~` is water.
  - A* runs eight ways. It never cuts a wall's corner and climbs at most one step per tile.
  - A goal that isn't open becomes the nearest open tile.
  - `along()` gives the position at a fraction of the path, smoothstepped, with the step up taken mid-move.
- **`main.ts`**:
  - Camera: three.js with an orthographic camera down the (1, 1, 1) diagonal, which is true isometric.
  - Tiles: one box per tile.
  - Playback: a compiled show (`src/fromtrace.ts`, unchanged) played through maxcot's `Conductor`.
- **`models/neuron.gltf`**: a real glTF file. It is built from three.js primitives by `make-model.mjs` and loaded through `GLTFLoader`, as a model from Blender would be.

## Verdict

**1. A maxcot character survives as a billboard. Yes.**
- Each actor gets its own maxcot `Actor` and a 256×320 canvas.
- It paints with `render(…, { ground: false, cam })`. The skin's paper is left off, so the background is transparent.
- The result is a `CanvasTexture` on a `THREE.Sprite`.
- Two details matter:
  - **The maxcot camera is fixed once from the rest pose.** If maxcot reframed every frame, a pose that moves the body would slide the feet off the tile.
  - **`sprite.center` is set to the feet** (the bottom of `Scene.body`), so the billboard stands on its tile rather than being centred on it.
- Per-character skins work for free (lab: felttip, riso, ballpoint side by side) because each body paints itself. The whole compositing pass in `host.ts` (spike 003) is unnecessary here.
- Facing: a billboard turns *in the drawing* (maxcot's `view.yaw`, ±0.38), chosen by which way the target lies **on screen**. It works, but a billboard can only face left or right. It never faces into or out of the picture.

**2. `move` becomes a walk across tiles without inventing time. Yes.**
- A `move` updates the character's stage position (`sx`, `sz`), as it does today.
- That position maps to a tile (`STAGE_X` 1.5, `STAGE_Z` 2.2), and the walk follows the A* path to that tile.
- The walk takes the score's own `over` beats. A detour makes the walk faster; it doesn't make it longer.
- A seek lands mid-walk because the walk's clock is song time.
- Paths through the probe room: through the gap in the wall, up the dais one step at a time (0, 1, 2), and from a goal in the pool to the nearest shore. The same path comes back every time.
- Tiles other bodies stand on are avoided, and a walk reserves its goal tile.
- With the lab's 64 moves, nobody walks through a wall or into the pool.
- The click-to-walk and `wander` walks are the audience's toys, not the show's. They run on the wall clock and a seek clears them.

**3. A 3D model is a skin. Yes, as a named table entry.**
- `MODELS` maps a name to a loader:
  - `neuron` is the glTF file, cloned per character with its own materials.
  - `glass` is built in code.
- If a payload named a model, it would name a key in this table, never a path. This keeps the rule "a payload is data".
- A model has no face, so a pose is read as a gesture of the whole body:
  - a speaking soma glows
  - an angry pose (`angry`, `furious`, `fedup`) runs hot red
  - a shrug or a sulk tilts the model
  - every pose bobs it once.
- The model turns in the room toward where it walks or whom it addresses. A model can face any direction, which a billboard can't.

**Numbers:** 8 characters in the lab (4 billboards, 4 models) take about 3.2 ms a frame, measured on the page's own counter. Spike 003's 2D stage took 18.4 ms for 8 mixed skins. Only the maxcot paint is CPU work, and it runs at the skin's own fps.

## What it did not answer, or answered badly

- **Bubbles collide.** The lab's lines pile up over the room. The real stage places bubbles so they avoid each other (`src/bubbles.ts`). The spike pins each bubble to its head with no placement.
- **`shot` is ignored.** The iso camera never moves. Framing in iso is a pan and zoom of an orthographic camera, which is a decision to make, not a port of maxcot's shot.
- **The mapping from the stage to tiles is a guess** (`STAGE_X`, `STAGE_Z`, the centre of the room). It is fine for a spike and wrong for a design. If this is adopted, a show's cast is placed on tiles by the compiler, and a cue names a tile or a character, not a stage x.
- **A model can't take a maxcot skin, and a pose has no real 3D counterpart.** The gestures are a stand-in. A rigged model with animation clips (`AnimationMixer`, a clip per pose family) is the real answer and needs a model that has them.
- **The compiler drops model names today.** `cueOf` checks `skin` against maxcot's 26 skins, so a payload saying `skin: "neuron"` is filtered out before the stage sees it. The looks here are chosen by the page buttons, not by the run.

## If it is adopted

These are written down here and not built:

1. Move `grid.ts` into `src/` with tests: A*, `along`, and placing the cast on tiles. Where a body goes is the compiler's decision.
2. A tile goal in the cue: `move: { to: [c, r] }` or `move: { to: "max" }` (walk to stand beside a character). This extends `move`. It doesn't add a new top-level key, but it is still a change to the payload vocabulary, and that is Kevin's call.
3. A model name in `skin`, checked against the page's model table the way maxcot skins are checked. That table becomes the stage's own, beside maxcot's.
4. A decision record (0003). `three` moves from a dev to a runtime dependency only when `src/` imports it.

## Round two: a big room, a rigged model, a written scene

**What was added**

- **`rooms.ts`**: a room is its rows, its **marks** (named places a score can send someone to) and its **props**.
  - `LAB` is the first room.
  - `SHADOW` is 36 × 28. West of the river is lit: grass, a stage, hedges, a plaza, lamps. East of it is dusk: earth, a pass between two walls, a black pool, a raised ring. The bridge is the only way over.
  - The marks A to G are the seven stations of kevinferron.com/porch/jung-shadow.
- **`grid.ts`**:
  - **Surfaces**: `,` grass, `:` earth, `=` path, `b` wood, `^` hedge, `*` black water.
  - **`block()`** closes the tiles props stand on.
  - **`besideOf()`** gives the tile to stand on when walking up to someone.
- **`props.ts`**: eight props built in code. Columns, pines, dead trees, a lamp (with a real point light that flickers), a mirror (three's `Reflector`, a real reflection), the persona's mask, a black sun (nigredo) and an ouroboros (wholeness).
- **`models.ts`**: the model table and `Rig`.
  - **`robot`** is three.js's own RobotExpressive (CC0, `models/robot/README.md`, 464 KB, downloaded from three.js at r187). It has 14 clips and three face morphs.
  - **`shadow`** is the same file with every material black.
- **`scenes/shadow.score`**:
  - About 2½ minutes at 84 bpm: 7 stations, 5 characters, 2 kinds of character.
  - Written in maxcot's score syntax and read by `src/fromscore.ts`, unchanged.
  - The lines are the scene's own, not quotations.

**Verdict**

1. **A big room costs nothing.**
   - 36 × 28 tiles are one `InstancedMesh` per surface (nine draw calls), and picking reads `instanceId` back to a cell.
   - With 5 characters, 2 reflecting mirrors and 4 point lights, a frame takes 3 to 6 ms. The first frames, while the robot file decodes, are slower.
2. **A rigged model plays maxcot's poses. This answers round one's open question.**
   - `clipFor` reads a pose by family:
     - `wave`/`cheer` → Wave, `thumbsup`/`deal` → ThumbsUp, `bow` → Yes, `point-you`/`stop` → No
     - `fists`/`feel-angry` → Punch, `recoil`/`surprised` → Jump
     - `collapse` → Death (held), `sit` → Sitting (held), `excited` → Dance
   - A clip's own name also works (`pose: 'Standing'`).
   - `faceFor` puts Angry, Sad or Surprised on the robot's face morphs.
   - Under every clip, the legs follow the walk: Walking, or Running when a score asks for more than about 2.8 tiles a second (the shadow's dash over the bridge).
   - Everything is a function of song time. A seek into the blackening lands the self lying down (Death, held at its last frame). A seek into a wave lands it half done.
   - **Two traps, both fixed:**
     - A skinned model must be cloned with `SkeletonUtils.clone`, or every copy shares one skeleton.
     - A fresh clone must `updateMatrixWorld()` before it is measured. The robot's armature scales its centimetre meshes ×100; without the update it measured 100× too small, was scaled up 100×, and vanished off screen.
3. **Marks and "beside" make a scene writable.**
   - `enter: { tile: 'A' }`, `move: { to: 'B' }` and `move: { to: 'self' }` are all the walking the scene needed. It never names a coordinate except to stage the meeting in the pass.
   - "Beside" needed one staging rule: **beside as the audience sees it.** Without the rule, the shadow came up behind the self on the camera's own diagonal and disappeared. `besideOf(…, depth)` now prefers a side across the picture.
   - Every walk in the score was probed for a path and a speed before it was played. All are 1.5 to 2.2 tiles a second, except the shadow's 3.2 (a run, on purpose).
4. **Iso needs a cutaway.**
   - In the pass, the near wall hid both characters completely.
   - Any wall or hedge tile one or two steps toward the camera from a character is now lowered to a stub, by swapping its instance matrix. The meeting is seen through a notch in the wall.
   - This is the standard iso fix, and it would have to be in any real version.
5. **`shot` follows.**
   - A shot names who to frame (`full`, `medium` or `wide` on one or several bodies). The camera eases to where they are *now*, so `shot: 'full', on: 'self'` at the start of a walk follows the whole walk.
   - `shot: 'wide'` with nobody frames the room.
   - Dragging takes the camera until the score's next shot.

**What round two did not answer**

- **Bubbles still collide** when a crowd talks (the plaza). A bubble can also cover the character behind it.
- **The dusk is all colour.** The east side is dark because its tiles are; there is no fog and no real night. A light that changes over the scene (the sun setting as the self crosses the river) would need a `light` command, and that is a new command.
- **The mapping from poses to clips is one robot's.** Another rigged model has other clip names, so the table is per model, and a model with no clip for a pose just stands.
- **The commands are the spike's.** These are new vocabulary that would need the decisions below:
  - `tile` in `enter`
  - `to` in `move`
  - model names in `style`
  - clip names in `pose`

  `fromscore.ts` passes them through untouched, which is why the scene plays. Nothing checks them.

**If it is adopted, the decisions grow by two:**

5. **Marks.** A room's named places, and whether a payload may name them (`move: { to: 'B' }`). A room becomes something the stage owns, beside maxcot's skins and the model table.
6. **A clip table per model.** Pose families to clips, checked the way skins are, so a payload's `pose` stays one of maxcot's names and each model says how it plays it.

## Round three: life, with a mind per character run by the engine

Kevin's call (2026-11-26): each character gets an inner network, run for real by `neuron-engine`, not
simulated in the page. A character with a grudge is DESIGN §9.5's trigger ("a `serve` mind when a
scene needs a grudge"), and `resentment` is that grudge.

Run it with two processes:

```sh
npm run dev
node spikes/004-iso-tiles/life/bridge.mjs     # five live engine runs, one per character
```

Then pick **life** in the show picker.

**What was added**

- **`life/cast/<who>.network.json`**: one network per character (mara, kes, tobin, wren, oli), each
  passing `neuron-engine check`.
  - `senses` is a source: what the stage tells the character.
  - Seven drives are `serve` neurons, so they remember: `hunger`, `loneliness`, `anger`, `resentment`
    (a grudge per person, the audience included as `you`), `fear`, `happiness`, `desire` (for one
    place in the room).
  - Links between drives carry influence: hunger feeds anger, resentment feeds anger and anger feeds
    resentment, and everything pulls on happiness.
  - `will` hears every drive and answers only when the intention changes, with a cue in the stage's
    own vocabulary (`say`, `pose`), an intent and the drive that caused it.
  - **The traits are the character**, written as arguments in the network file (`temper=1.6`,
    `forgive=0.35`, `place=E`, `friend=mara`). The folder is still the character (§9.2).
- **`life/mind/`**: `drive.mjs` (one program for all seven drives), `will.mjs` and `serve.mjs` (the
  level 1 contract, written once).
- **`life/bridge.mjs`**: the live producer (agent-neuron decision 0020).
  - It runs `check`, then `run --inputs - --stream /dev/fd/3` for each character, and relays the
    stream to the page as server-sent events.
  - It decides nothing about a mind. It gates what the page may inject: a closed list of senses, each
    rebuilt field by field.
  - It listens on 127.0.0.1:5292 only.
- **`life.ts`**: the body and the world.
  - Once a second it tells every mind the time that passed, who is within 3 tiles, which mark it
    stands on and whether it is on the dark side.
  - It acts out each intent: **eat** (walk to a table, sit, then `ate`), **seek** (walk to the friend,
    `kind` both ways, or a snub), **confront** (walk up, `hurt` to them, `vented` to self), **flee**
    (run to a far, lit tile), **go** (to the place it longs for), **celebrate** (`kind` to everyone
    near), and **sulk**, **mope** and **idle**.
  - **The panel**: the cast with each intent, the chosen character's drives and grudges, its network
    drawn live, five pokes (feed, be kind, insult, scare, apologise: from `you`) and its story.
  - **The camera**:
    - **director** follows whoever's story has the most drama (a confrontation over a meal), holds it
      for a while, and frames who it is with.
    - **follow** stays on the character you pick.
    - **free** leaves the camera to you.

**Verdict**

1. **A live engine network per character works, and it is cheap.**
   - Five runs, 45 `serve` processes and a tick a second each.
   - The page holds 4–5 ms a frame.
   - The engine forgets every finished trace (a tick is one trace), so a long run does not grow.
2. **The page never reads a network file.** It learns each network's shape from the stream: a signal
   names its sender and receivers, so the drawing in the panel is the network as it has been seen to
   work. This keeps "the engine is the authority on a network".
3. **The memory is the engine's, not the page's.** Reload the page and the grudges are still there;
   stop the bridge and they are gone. This answers §9.5 in the small. The next question is a mind that
   survives the engine: agent-neuron's durable state (its issue #30), not something this repo can do.
4. **Feuds needed a way to start.** A confrontation needs a grudge, and a grudge needed a hurt, so
   only the audience could start one. **A snub** fixes it: whoever reaches out to someone sulking, angry
   or fleeing gets "Not now. Go away.", and that is a hurt the mind keeps.
5. **Influence is remembered, not answered.** A drive that hears another drive's level stores it and
   weighs it on the next tick, and is quiet. Without that, the anger ↔ resentment ring would echo until
   `maxHops`.

**What round three did not answer**

- **Time is the wall clock.** Life is not a show: nothing is scheduled and nothing can be scrubbed.
  Filming a life means recording the stream as a trace, which the engine already does without
  `--inputs -`, and compiling that. Not built.
- **The will is a table.** Its lines are a few per intent, and it does not know who it is talking
  to. A model behind `will` (as in the lab) is the obvious next step, and it costs a model call for
  each change of intent.
- **Tuning is by eye.** At 4× hunger comes back every half minute or so; at 1× every two minutes.
  Nobody has watched a long run yet.
- **The audience is a person in every mind (`you`)**, but it has no body. A grudge against you is
  shouted at the camera.

## Where it went

Round three became its own project: `../agent-neuron-life` (2026-11-26). It holds a procedurally generated
city, a crowd mind with followed networks derived from it, and places as neurons. That project's decision
0001 says what came over from here and what did not.
