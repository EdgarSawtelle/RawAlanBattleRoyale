# RawAlanBattleRoyale

A tiny two-player arena duel that runs in the browser, no install. Shoot, block, jump around a ruined open arena, and
when you lose a round answer a quiz question: the better you answer, the better the card you pick. There are **30 cards** (bouncing and exploding bullets, parries, wall clinging, air jumps, barrels, slabs, ring-outs and more) in a handful of build styles that combine
(see [docs/CARDS.md](docs/CARDS.md)). The cards stack up over the match (first to 5 rounds). Play against a dummy, or against a friend over a direct peer-to-peer connection.

**Play:** https://edgarsawtelle.github.io/RawAlanBattleRoyale/

## Play with a friend

1. Open the link, choose a name, press **CREATE ROOM**. You get a 5-letter code and an invite link.
2. Send the link (or the code) to your friend. They open it (or type the code under **JOIN A FRIEND**).
3. Keep your tab open: you are the host and the game runs in your browser. If the friend drops out, the game waits 30 seconds for them to come back.

Both of you can watch the quiz and the card pick of the loser live. If the two of you cannot connect (strict company or
school networks), try a phone hotspot: the game uses WebRTC without a relay server.

## Controls

| | |
|---|---|
| **A / D** | move |
| **W / Space** | jump. In the air next to a wall, hold towards the wall and tap jump again and again to climb it |
| **Mouse** | aim (bullets drop with distance: aim a little above far targets) |
| **Left click** | shoot |
| **Right click** | block (destroys bullets for a moment, then a cooldown) |
| **1-4 / click, Enter** | answer the quiz, continue |
| **Esc** | help and menu |
| **\` / F1 / F2** | debug panel (map, cards, cheats; cheats work for the host only) |

Falling off the sides or the bottom costs 15% of your health and throws you back in; the top of the screen is free. Thirty maps
rotate (a new one every round, all of them before any repeat).

## Run it locally

No build step, only static files.

```
node tools/serve.mjs 8123          # then open http://localhost:8123
node tools/serve.mjs 8124 --prefix=RawAlanBattleRoyale     # serve under a sub-path like GitHub Pages does
```

Any static server works (`python -m http.server`, ...), the game is plain ES modules. Tests (Node 18+, no dependencies):

```
npm test                  # simulation, physics, cards and match flow, netcode, prediction, maps
npm run soak              # bots play whole matches on every map (add --chaos for random card builds)
npm run test:browser      # two headless browser windows play each other (needs Edge or Chrome, see docs/TESTING.md)
```

## Add content

A card, a map and a quiz question are each one small piece of data: see [docs/ADDING-CONTENT.md](docs/ADDING-CONTENT.md).
Design, physics numbers and netcode notes are in `docs/DESIGN.md`, `docs/PHYSICS.md`, `docs/CARDS.md`; how to test is in `docs/TESTING.md`.

## Credits

- Networking: [PeerJS](https://peerjs.com/) 1.5.4 (MIT licence), vendored in `vendor/`.
- All art (pixel characters, backgrounds, icons, the pixel font) is original and drawn procedurally in code, no image files.
- The quiz questions are original.
- [ROUNDS](https://landfall.se/rounds) (Landfall) was a mechanical inspiration only (short duels, loser picks a card). No assets, names or card names are taken from it.
