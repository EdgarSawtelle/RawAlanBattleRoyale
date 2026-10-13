# Adding content: a card, a map, a quiz question

Everything is plain data in one file each, no build step. After any change run `npm test` (it checks cards, maps and the
match flow) and reload the page.

---

## 1. A card (example: "Quick Draw")

Cards live in `src/cards.js`, one object each. Add this object to the `CARDS` array:

```js
{
  id: 'quickdraw', name: 'Quick Draw', rarity: 'common', maxStacks: 2, icon: 'hairtrigger',
  description: 'Shoot faster, but you hit softer.',
  lines: [{ t: '+30% fire rate', good: true }, { t: '-15% damage', good: false }],
  mods: { fireRate: { mul: 1.3 }, damage: { mul: 0.85 } },
}
```

- `id` must be unique and never change (it is sent over the network). `rarity` is `common`, `uncommon` or `rare` (how often it is offered).
- `lines` are the green / rust lines on the card; write them to match `mods`.
- `mods` change base stats (list of stat keys at the top of `src/cards.js`; base values and the hard limits are in `src/config.js`). Percentages of different cards add up.
- `icon` is the name of a pixel icon in `src/client/icons.js`. An unknown name draws a "?" box, so a new card works before it has art; to draw one, add an entry to the `ICONS` object there (12 x 12 pixels).
- For effects that are not a stat (explosions, bouncing, reflecting) give the card `hooks`: `onShoot`, `onBulletHit`, `onBounce`, `onBlock`, `onDamaged` (`ctx.lethal` = this hit kills you), `onDealt` (what your attack really dealt), `onHazard`, `onRingOut`, `onBarrel`, `onRoundEnd`, `onTimer`, `onKill`. The Powder Keg card in the same file is a short example. Inside a hook use only the `ctx` API (`spawnBullet`, `explode`, `heal`, `hurt`, `addTimed`, `removeCard`, `schedule`, `spawnSlab`, `fx`, `rng`, a per-card `store`); never `Math.random` or the state directly.
- For modifiers that follow a state (low HP, clinging to a wall, seconds into the round) add `dynamic: { key: (p, state) => integer, mods: (key) => ({ damage: { mul: 1.4 } }) }`: the stats are recomputed whenever the key changes (0 = off). See Cornered, Limpet and Late Bloomer.
- New stats you can edit besides the usual ones: `airJumps`, `wallGlide` (0 = hang on walls), `hazardTaken` (0 = hazards do no damage), `blockDamage`. A card that changes how the body moves must keep every number the movement step uses in the snapshot's movement state (`moveState` in `src/net/snapshot.js`) or the online client's prediction will show corrections: the 3 tests in `tests/predict.test.mjs` for movement cards show how to check it.
- Give the card a **visible effect**: the opponent must see what just happened. Emit it through `ctx.fx(kind, data)` (a `cardFx` event; add a case in `src/client/fx.js`) or use the automatic ones (`buff`, `heal`, `slab`, `cardLost`). Check the card on the pick screen: description at most 84 characters and text plus stat lines at most 168 characters fit the card (`tests/cards.test.mjs` checks this).
- Tell the offer logic nothing: it never offers a maxed card or a card that would change nothing (`cardUseful`). `maxStacks: 2` is only for cards whose second copy is still interesting below the caps.
- Add a test next to the others in `tests/match.test.mjs` (build a state, give the player the card with `setCards(...)`, check the stat or the effect). `node tests/soak.mjs 6 --chaos` plays bots with random builds and flags NaNs or runaway bullets.
- The numbers should follow `docs/CARDS.md` (rules for power and caps); `src/config.js` `caps` / `statLimits` clamp anything that is too much.

---

## 2. A map (example: "Rooftops")

A map is one file in `src/maps/` plus one import and one array entry in `src/maps/index.js`. It joins the round rotation by itself (all maps appear, shuffled, before any repeats). There are 30 now (see the table in `docs/DESIGN.md`); copy the one that is closest to what you want and change the numbers.

`src/maps/rooftops.js` (you write the LEFT half only, x from 0 to 640: the builder in `build.js` mirrors it, names every piece and builds both spawns):

```js
import { buildMap, slab, stairs, crateRow, crateStack } from './build.js';

export default buildMap({
  id: 'rooftops', name: 'Rooftops', family: 'staircase',          // id never changes; family is a free label for the docs
  description: 'Two roofs with a stair up to a plank in the middle.',   // one line
  background: 'overgrown-downtown', backgroundVariant: 0,         // one of the four scenes, variant 0 or 1 (see src/client/background.js)
  hazardStyle: 'rust',                                            // optional hazard colours: rust | thorn | iron | brick
  spawn: { x: 250, top: 520 },                                    // LEFT spawn: x of the body centre, top = y of the surface it stands on
  left: {                                                         // mirrored to the right half
    solids: [
      slab(130, 520, 270),                                        // slab(x, y, w, h = 16): x, y = top-left corner, y grows DOWNWARD
      ...stairs({ x: 400, y: 450, steps: 2, w: 60, rise: 70, base: 546 }),   // two solid steps (tops 450 and 380), no overhangs
    ],
    crates: crateStack(290, 456, 1, 2),                           // 32 x 32 destructible crates, [x, y] each; row / stack helpers
    barrels: [[412, 420]],                                        // 24 x 30 explosive drum (on the first step)
    platforms: [{ w: 70, h: 14, path: [{ x: 40, y: 520 }, { x: 40, y: 330 }], speed: 70, pause: 1.0, mode: 'pingpong' }],   // a lift (top-left corners)
  },
  centre: {                                                       // things on the middle line, written once (write them symmetrical yourself)
    solids: [slab(560, 380, 160)],
    crates: [[608, 348], [640, 348]],
    hazards: [{ type: 'saw', r: 14, path: [{ x: 540, y: 640 }, { x: 740, y: 640 }], speed: 80, pause: 0.3, mode: 'pingpong' }],   // a saw deep in the pit (spikes: { type: 'spikes', x, y, w, h, face }, at least 48 x 18)
  },
});
```

`src/maps/index.js`: add `import rooftops from './rooftops.js';` and `rooftops,` in the `MAPS` array.

The arena is open: nothing surrounds the 1280 x 720 screen, a player who leaves by the sides or the bottom loses 15% of max HP and is thrown back, the top is free. (A map can also be written without the builder as a plain object with `solids`, `destructibles`, `platforms`, `hazards`, `spawns`; `mirror.js` has the mirror helpers: the four original maps were like that.)

**Design rules** (the tests enforce them; run `node tests/maps.test.mjs` or just `node tests/maplint.mjs rooftops`, which prints every finding):

- **Room to move.** At least **120 units of free air above anything you can stand on** (slabs, crates, grates). To go up, use a staircase of side-by-side steps or solid blocks (`stairs(...)`), a wall (a block next to the floor, 60+ high is a cover, any height can be climbed by holding into it and tapping jump as long as nothing overhangs its face), or a lift. Never stack thin platforms 60-80 above each other. A deliberate low tunnel (crawl space, 80 or more high) must be listed in `tunnels: [{ x0, x1 }]`.
- **No wedge slots.** No gap of 30 to 60 between two facing sides that overlap by 40 or more vertically (the Thick Skin body is 48 wide). Gaps under 30 are fine (nobody enters), 60 and more are lanes.
- **Sparse.** 0-3 hazard pieces (a mirrored pair counts 2), 4-10 crates / barrels, at least one moving platform or hazard, and nothing hazardous in the straight jump arc between two platforms or on the main walking lines. Put hazards and crates on the periphery and on optional risk / reward routes.
- **Fair.** The map is its own mirror image; spawns stand on solid ground, 80+ from any hazard and 140+ from any barrel, and the two spawns do not see each other along a flat line (cover in between) or are 760+ apart.
- **Reachable.** Every surface can be reached from both spawns: steps up to 105 (the sim's real table, `node tests/jumpreach.mjs`: flat gap up to 215, comfort 190; step 60: 190; step 90: 175; step 115: 150), lifts and moving platforms, or a wall climb (listed by the test). Wide pits need something that catches a fall (a slab, a slow raft or lift): the test drops a player into the pit at 31 positions and wants a safe landing after one fall in at least half.
- Moving platforms and saws never pass through terrain or blocks; ids are unique (the builder makes them).

Look at it: `http://localhost:8123/?map=rooftops&autostart=1&hitboxes=1` (the debug panel F2 lists every map, grouped by backdrop), `node tests/stuck.mjs 120 4 rooftops` (do the bots get stuck?), `node tests/soak.mjs 6 --chaos --map=rooftops` (whole bot matches with random cards on it) and `node tests/shots-maps.mjs --only=rooftops` (a picture in `screenshots/maps/`).

---

## 3. A quiz question

Questions live in `src/questions.js`, one object each; the game shuffles the answers every time. Add this to the `QUESTIONS` array:

```js
{ id: "a-900", category: "Excel",
  q: "Which shortcut inserts today's date into a cell?",
  answers: ["Ctrl+;", "Ctrl+T", "F4", "Ctrl+Shift+L"],
  correct: 0,
  why: "Ctrl+; enters the current date. Ctrl+T creates a table, F4 repeats the last action or cycles reference types, Ctrl+Shift+L toggles filters." },
```

- `correct` is the position (from 0) of the right answer in `answers`. `id` and `category` are optional but keep ids unique.
- Keep the question under about 120 characters and each answer under about 60, so they fit the screen. `why` is shown after the answer; a sentence or two works best (it is wrapped to short lines).
- Wrong answers cost the loser three of the five offered cards, so make the three wrong answers plausible but clearly wrong.
- Nothing else needs changing. `node tests/match.test.mjs` checks that every question is well formed (four answers, a valid `correct`, unique ids).
