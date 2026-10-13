# Testing RawAlanBattleRoyale

Everything is static files. ES modules do not load from `file://`, so serve the folder first.

## 1. Serve the game

```
node tools/serve.mjs 8123
```

Open <http://localhost:8123/>. (`.claude/launch.json` has a `game` configuration that does the same.) Any static server works
(`python -m http.server 8123`, `npx http-server`), there is no build step.

## 2. Practice mode (you vs the dummy)

Open the page and press **PRACTICE VS DUMMY**. Controls: `A`/`D` move, `W`/`Space` jump (wall-jump off walls), mouse aims,
left click shoots (hold), right click blocks, `Esc` opens a small menu. After you lose a round: answer the quiz with the mouse or
keys `1`-`4` (never A-D, those are movement keys), `Enter`/`Space` or a click continues, then take a card (click or keys `1`-`5`).
When the dummy loses, its question, answer, the explanation and the card it took are replayed on the same screens (click / Enter steps through).

## 3. Online, two tabs on one machine (the real WebRTC path)

1. Open <http://localhost:8123/> in a window. Optionally type a name. Press **CREATE ROOM**. A 5-character code appears
   (plus **COPY CODE** and **COPY INVITE LINK**) and the lobby says *Waiting for opponent*.
2. Open a **second window** (a second tab works too, but put it next to the first: see the warning below) at the same address.
   Either type the code and press **JOIN ROOM**, or paste the invite link (`http://localhost:8123/index.html#join=ABCDE`),
   which joins automatically.
3. Both windows switch to the match. The host (first window) is the Ember player, the guest the Tide player.
4. Things to try: lose a round on purpose and answer the quiz while the other window watches; close the second window
   (or kill its network) and see *OPPONENT DISCONNECTED - waiting*; reload the second window with the same `#join=` link within 30 s
   (it rejoins and the match continues); at the match end both players must press **PLAY AGAIN**.

This uses the public PeerJS broker (`0.peerjs.com`) only to find the other tab, then WebRTC data channels. It needs internet access
to the broker. **Warning:** a hosted match keeps running when its tab is in the background (the host loop runs in a Web Worker),
but the *drawing* of a hidden tab pauses, so keep both windows visible while you watch.

### Offline variant (no internet, no broker)

Add `?local=1` to **both** addresses, e.g. <http://localhost:8123/?local=1>. The two tabs then talk through a `BroadcastChannel`
(same browser only). You can also add network conditions to test lag: `?local=1&latency=80&jitter=20&loss=2`
(one-way ms, ms, percent of lost snapshots / inputs). The same flags exist for the unit tests below.

## 4. Debug panel

Toggle with `` ` `` (backquote), `F1` or `F2`; or open with `?debug=1`. Practice: everything (give cards to yourself or the dummy,
pick a map, show hitboxes, FPS and ping, pause / single step, dummy on/off/passive, heal both, restart round, invulnerability,
jump to quiz / dummy turn / card pick (right or wrong) / match end, win or lose the round now, set the score, show any question by id,
next/previous question for proofreading).
Online: the **host** can use the same cheats (they act on the shared match); the **client** panel is read-only (FPS, ping, the hitbox toggle).
Ping shows `-` in practice and the measured round-trip time online (also in the bottom-right corner of the game).

## 5. URL test parameters

| Parameter | Meaning |
|---|---|
| `autostart=1` | skip the lobby, start practice |
| `demo=1` | skip the lobby; a bot also drives your player and both sides answer / pick by themselves |
| `debug=1` / `hitboxes=1` | open the debug panel / show hitboxes |
| `cards=a,b` `dcards=a,b` | card ids for you / the dummy (`hairtrigger pinball thickskin tightguard scramble featherweight powderkeg pepperpot prismshot returnpolicy`) |
| `map=id` `seed=n` `dummy=active\|passive\|off` | map, RNG seed, dummy mode |
| `stopAfter=N` `warmup=N` `time=N` | freeze after N ticks / run N ticks before the first frame / start the round clock at N s |
| `scenario=explosion\|hazard` | scripted test situations |
| `scenario=glide\|climb\|arc` | physics pictures (small variants of the real map, registered on demand): gliding down a tall wall, climbing it by tapping jump (`stopAfter=N` picks the moment), a stream of bullets along one aimed arc |
| `predict=0` | online client: turn own-movement prediction off (to feel the difference); the debug panel shows PRED on / off |
| `screen=quiz\|quizreveal\|cardpick\|dummy\|matchend` | jump straight to a screen. Extra: `answer=right\|wrong`, `quiz=right\|wrong`, `qid=a-007`, `offer=a,b,c,d,e`, `score=3-1`, `round=N`, `step=0\|1\|2` (dummy turn), `winner=1` |
| `dump=1` | print a JSON summary of the state at the bottom of the page |
| `selftest=1` | with `screen=quiz`: drives answer click, Enter and a card click with synthetic events and prints the result |
| `local=1` `latency=` `jitter=` `loss=` | offline BroadcastChannel network and simulated network conditions |
| `#join=ABCDE` (in the address) | join that room automatically |

## 6. Automated tests

```
npm test                  # or run the files one by one:
node tests/sim.test.mjs   # movement, shooting, blocking, hazards, sudden death, out of bounds, maps (38 tests)
node tests/physics.test.mjs # the physics pass (preset R): wall grip needs input, glide speed, regrab lockout, one-wall climb, stored jump charge,
                          # ledge pop / head-bump nudge, momentum carry, bullet drop at 300 / 600 / 900, the aim solver, bot arc aim (18 tests)
node tests/match.test.mjs # the 10 cards, the caps, the quiz / card pick / match state machine (28 tests)
node tests/net.test.mjs   # the online layer over a loopback network with a virtual clock and simulated latency / jitter / loss (19 tests)
node tests/predict.test.mjs # own-movement prediction (10 tests): press-to-movement at 60 / 100 / 150 ms RTT, convergence with no drift over long
                          # runs (wall jumps, platform rides, knockback, out of bounds, round restarts, bad links), correction size, the host's input queue
node tests/maps.test.mjs   # every map of the rotation (30 tests): spawns safe, ids, overlaps, moving things never pass through solids, mirror image, hazard size, reachability from both spawns (prints what needs wall climbing), the rotation rule, a 60 s bot game on each map
node tests/reach.mjs      # map reachability by single jumps / lifts / wall climbing (prints anything unreachable)
node tests/jumpreach.mjs  # measures the real jump reach (max gap, step-up table) from the sim
node tests/stuck.mjs      # the dummy bot: counts the times it stands still for too long (every map, or: node tests/stuck.mjs 120 4 old-plaza)
node tests/shots-physics.mjs # headless Edge: the pictures in screenshots/physics/ (needs the server; waits for the animated backdrop)
node tests/shots-final.mjs   # the final screenshot set in screenshots/final/ (--only=name, --shot="name|query|ticks|width|height" for extra pictures at another window size)
node tests/soak.mjs 8     # two bots play whole matches with the maps rotating (add --chaos for random card builds, --map=old-plaza to pin a map): crashes, NaNs, runaway bullets, round lengths per map
node tests/bot-sim.mjs 180
```

### Real browser test of the online path

With the server from step 1 running:

```
node tests/two-tab.mjs --local     # two windows of headless Edge over the BroadcastChannel loopback
node tests/two-tab.mjs             # the same over the REAL PeerJS / WebRTC path (needs the PeerJS broker)
```

It drives two Edge windows with the DevTools protocol: create room, join through the invite link, input, a played round,
quiz as answerer and as watcher, reveal, hover, card pick, scores on both sides, a disconnect with automatic rejoin, leaving.
Screenshots of both sides land in `screenshots/phase2/`. The "host simulates at about 60 ticks per second" check measures the host page's real tick rate and dips below 45 when the machine is busy (other browsers running): rerun it before suspecting the code. Set `EDGE=path/to/browser` if Edge or Chrome is somewhere unusual, `--base=http://host:port` for another server.

## 7. Two houses (what only a human can test)

The tests above run both players on one machine. Before relying on it, try it with a friend on another network:
create a room, send the link, check that you connect, that movement feels OK (see `docs/DESIGN.md` section 5 for the numbers),
that the quiz and card pick are visible on both sides, and what happens when one of you closes the tab or the Wi-Fi drops.
If it fails to connect, the lobby says so; two strict NATs without a TURN server cannot connect: try a phone hotspot.

## 8. Deploying to GitHub Pages

The game is plain static files and uses only relative paths (`css/`, `vendor/`, `src/`), the invite link is built from
`location.origin + location.pathname`, and the host timer worker is loaded relative to its module, so it works under a sub-path such as
`https://<user>.github.io/RawAlanBattleRoyale/`. Publish the repository root (branch `main`, folder `/`). Needed files:
`index.html`, `css/`, `src/`, `vendor/peerjs.min.js` (+ `vendor/PEERJS-LICENSE.txt`). Not needed: `tests/`, `tools/`, `mockups/`, `docs/`, `screenshots/`, `.stable/`.

Test it under a sub-path before publishing (the same way Pages serves it): `node tools/serve.mjs 8124 --prefix=RawAlanBattleRoyale`
(leave the other server alone), then `node tests/two-tab.mjs --local --base=http://localhost:8124/RawAlanBattleRoyale`: create, join through the invite
link (it keeps the path), play a round. A `.nojekyll` file at the root makes Pages serve everything as it is. To publish only what the game needs,
copy `index.html`, `css/`, `src/`, `vendor/` and `.nojekyll`; everything else (docs, tests, tools, screenshots) can stay in the repository without hurting.
