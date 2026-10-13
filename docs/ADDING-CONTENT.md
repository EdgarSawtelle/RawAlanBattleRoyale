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

A map is one file in `src/maps/` plus one import and one array entry in `src/maps/index.js`. It joins the round rotation by itself.

`src/maps/rooftops.js`:

```js
import { mirrored, mirroredBlocks, mirroredHazards } from './mirror.js';   // write the LEFT half only, it is mirrored for fairness

const solids = [
  ...mirrored([
    { x: 60, y: 480, w: 400, h: 30 },       // spawn roof (x, y = top-left corner, y grows downward)
    { x: 220, y: 380, w: 120, h: 16 },      // a ledge: 100 up from the roof (rule: steps up <= 100)
  ]),
  { x: 590, y: 300, w: 100, h: 16 },        // a centre piece is its own mirror image: write it once
];
const crates = [{ id: 'cr1', x: 300, y: 448, w: 32, h: 32, hp: 50 }];           // destructible: shoot it away
const barrels = [{ id: 'ba1', kind: 'barrel', x: 400, y: 450, w: 24, h: 30 }];   // explodes when destroyed
const hazards = mirroredHazards([
  { id: 'sp1', type: 'spikes', x: 100, y: 440, w: 60, h: 20, face: 'up' },       // spike strips: at least 48 x 18 so they are easy to see
]);
const platforms = [                                                              // moving platform: its position is a function of the round tick
  { id: 'lift', w: 100, h: 16, path: [{ x: 480, y: 480 }, { x: 700, y: 480 }], speed: 90, pause: 1.0, mode: 'pingpong' },
];

export default {
  id: 'rooftops', name: 'Rooftops',
  background: 'overgrown-downtown', backgroundVariant: 0,   // one of the scene ids in src/client/background.js
  hazardStyle: 'rust',                                      // optional hazard colours: rust | thorn | iron | brick
  spawns: [{ x: 200, y: 465 }, { x: 1080, y: 465 }],       // body CENTRE: standing 15 above the roof (mirror images of each other)
  solids, destructibles: [...mirroredBlocks(crates), ...mirroredBlocks(barrels)], platforms, hazards,
};
```

`src/maps/index.js`: add `import rooftops from './rooftops.js';` and `rooftops,` in the `MAPS` array.

The arena is open: nothing surrounds the 1280 x 720 screen, a player who leaves by the sides or the bottom is hurt and thrown back, the top is free.
Rules the tests enforce (`tests/maps.test.mjs`, run it, it prints what fails): spawns free of terrain and away from hazards (80 units) and
barrels (140), unique ids, nothing overlapping, moving platforms and saws never pass through solids, the map is its own mirror image,
spike strips are big enough, at least 8 platforms and 8 blocks, and EVERY platform is reachable from both spawns.
Reach rules (measured with `node tests/jumpreach.mjs`): gaps up to 190, steps up to 100 (120 at most), a wall of any height can be climbed
(hold into it and tap jump, about 68 per hop) as long as nothing overhangs its face. A saw is `{ type: 'saw', r: 14, path: [{x,y},{x,y}], speed, pause, mode }` (path = blade centre); an ember grate is `{ type: 'grate', ..., solid: true }`.

Look at it: `http://localhost:8123/?map=rooftops&autostart=1&hitboxes=1` and `node tests/stuck.mjs 120 4 rooftops` (do the bots get stuck?).
`node tests/soak.mjs 6 --chaos --map=rooftops` plays whole bot matches on it.

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
