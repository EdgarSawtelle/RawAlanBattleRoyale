# CARDS: the 30-card set, as implemented (RawAlanBattleRoyale)

Status: **implemented and playable** (`src/cards.js`, 30 cards: 11 common, 12 uncommon, 7 rare). Ten cards shipped in version 1; the other twenty were added afterwards
(fifteen of them were designed in the first version of this document, five are new designs). Numbers here are the numbers in the code; they are starting values
for playtesting, not final. The rules every card inherits (self-damage, open arena, out of bounds, knockback, caps) are in "Rules and caps" at the end.

A card is ONE plain object in `src/cards.js`: `id, name, rarity, maxStacks, icon, description, lines` (the green / rust stat lines on the card), `mods` (stat modifiers),
`hooks` (code the simulation calls at the right moment), optional `dynamic` (modifiers that follow a state) and optional `tags` / `preview`. How to add one: `docs/ADDING-CONTENT.md`.

## 1. What the research says (and what we took from it)

Sources actually read for this extension are listed at the end of this section. Several are community guides or mod notes, so each finding is stated with its strength.

1. **Enablers, payoffs and bridges.** Slay the Spire players describe good decks as a foundation of solid picks that is then steered into a synergy, and say a deck that follows no archetype tends to
   "end up dead in the water" (strength: forum opinion). Enter the Gungeon has items that exist mainly to enable others (a passive "only useful as a part of synergies"), pairs where one item changes how
   the other behaves, one gun with several valid partners, and a "universal enabler" that switches all synergies on (strength: fan lists). ROUNDS players call Scavenger the best single card
   "because it combos with practically everything" (strength: one 2023 thread). **We took:** every archetype has enablers (they change what a bullet or the body does) and payoffs (they reward the result),
   and a few bridge cards that feed two archetypes (Bricklayer: parry and bounce; Pepperpot: spray and explosive; Kickback: mobility and explosive; Salamander: mobility and map hazards).
2. **Stand-alone value first.** Because a player only gets four picks (first to 5 rounds), a card that does nothing without its partner is a dead pick. In the Slay the Spire advice the early picks are the
   foundation; in the Brotato balance guide a niche item may skip its downside because needing a build is the cost (earlier research, kept). **We took:** every card is useful alone (a stat change or a clear effect)
   and has a visible trade-off; the combo is a bonus.
3. **Not everything stacks: override and negative interactions.** The Isaac wiki records every item pair as positive, neutral, negative or override (one item's effect replaces the other's). **We took:** every card section below
   lists anti-synergies as well as combos (Anchor against Kickback's target, Cornered against Tithe's healing, Vendetta against Late Bloomer, Gravedigger needs shoves).
4. **Non-linear combos beat plain stat stacking.** Isaac's Tear Detonator with Ipecac, Gungeon's gun + item transformations and ROUNDS' Spray + Mayhem + Explosive Bullets are fun because the result is a different play pattern,
   not +20%. **We took:** most new cards change a verb (hang on walls, build stone, lob shells, set off barrels, knock people out) instead of adding a percentage.
5. **Proc chains need limits.** Risk of Rain 2 gives every effect a proc coefficient (a chain lightning at 0.2 can only trigger other on-hit items at 20%, some effects at 0) and the ProcSolver mod caps chain length at 3 for
   skills and 1 for items, because chains cascade (strength: community mod notes; the rationale is inferred). Isaac's runaway cases come from items that multiply projectiles that inherit the parent's damage (earlier research).
   **We took:** anything a card spawns is "generation 1" and cannot spawn or split again (Porcupine shards, Prism children), a reflected bullet cannot be reflected again, a barrel chain shares one trigger-pull
   damage cap (Demo Permit), on-kill / on-round-end effects (Vendetta, Parting Gift) do not trigger other cards, and healing is capped per round.
6. **Every strong archetype needs an answer.** (Design judgement, supported by the Slay the Spire note that archetypes conflict inside a pool, and by ROUNDS' reputation for unanswerable stacks.) **We took:** each archetype in section 2
   names the cards that beat it.
7. **Avoid the unfun in a 1v1.** No stuns, slows, blinds, invisibility, unavoidable damage, one-shot kills, or effects that punish the opponent's quiz or pick (ROUNDS has several of those; we skip them). Hard limits come from the caps.

**Names.** All 30 names were compared with the 64-name ROUNDS card list (Abyssal Countdown ... Wind Up, fetched from magicgameworld.com) and with famous item names of the other games. There is an automated check
in `tests/cards.test.mjs` against the ROUNDS list. Closest neighbours of the older cards: Needle Rounds (ROUNDS has Fastball, Quick Shot), Porcupine (nothing similar), Bricklayer (ROUNDS has Saw and a few block cards, none builds stone), Sleight of Hand (ROUNDS has Tactical Reload and Scavenger).

**Sources used.**
- ROUNDS card list, 64 cards: https://www.magicgameworld.com/?p=126089 and bullet cards: https://www.magicgameworld.com/?p=126115
- ROUNDS combo remarks (Steam thread, search snippet): https://steamcommunity.com/app/2379780/discussions/0/4365754575402380019
- Risk of Rain 2 proc chains: https://rogueranker.com/risk-of-rain-2-ukulele/ and https://thunderstore.io/c/riskofrain2/p/RiskOfBrainrot/ProcSolver/
- Slay the Spire archetypes and deck advice: https://slaythespire.gg/guides/strategy and https://steamcommunity.com/app/646570/discussions/0/3377008022018975642
- Enter the Gungeon synergies: https://www.fandomspot.com/enter-the-gungeon-best-synergies/
- Binding of Isaac interactions: https://bindingofisaacrebirth.wiki.gg/wiki/Template:Interaction , https://bindingofisaacrebirth.wiki.gg/wiki/Tear_Detonator , https://bindingofisaacrebirth.wiki.gg/wiki/Habit
- Earlier research kept: Brotato balance guide https://brotato.wiki.spellsandguns.com/Modding/Balance_Guide , Isaac damage stacking https://bindingofisaacrebirth.wiki.gg/wiki/Damage , Gungeon developer Q&A https://www.gamedeveloper.com/design/q-a-the-guns-and-dungeons-of-i-enter-the-gungeon-i- , Vampire Survivors evolutions https://en.wikipedia.org/wiki/Vampire_Survivors , ROUNDS review https://www.gfinityesports.com/article/i-hate-1v1-competitive-games-but-rounds-is-the-unhinged-exception

Research limits, stated plainly: there is little first-party design writing for these games; the Isaac and Gungeon pages are the most solid, the ROUNDS and Steam material is anecdotal. The numbers and caps are our own design judgement.

## 2. Archetype map, bridges and counters

| Archetype | Enablers and members | Payoffs | Bridges | Answered by |
|---|---|---|---|---|
| **Spray / volume** | Hair Trigger, Pepperpot, Pinball | Tithe (many small heals), Prism Shot | Pepperpot (to explosive) | Return Policy (reflects the spam), Porcupine (rings punish close spray), a well-timed Tight Guard |
| **Bounce** | Pinball, Prism Shot, Bricklayer (slabs are bounce surfaces), Trebuchet (arcs land and bounce) | bank shots, Powder Keg (bombs that bounce) | Bricklayer (parry to bounce) | blocking (every bounced bullet is destroyed by the shield), Anchor / Thick Skin to survive self-hits, open maps with no surfaces |
| **Explosive / area** | Powder Keg, Demo Permit, Trebuchet, Parting Gift, Last Call, Pepperpot | blasts ignore blocks and evasion | Kickback (rocket jumps), Pepperpot | Anchor (no shove), Thick Skin, Needle Rounds (snipe the slow bomber), staying off barrels |
| **Parry** | Tight Guard, Return Policy, Sleight of Hand, Bricklayer | reflected bullets, refilled magazine, slabs | Bricklayer | explosions (a shield does not stop them), Needle Rounds (3000 u/s vs a 0.15 s window), waiting out the 4-6 s cooldown, Late Bloomer |
| **Mobility / ring-out** | Featherweight, Cloudstep, Limpet, Scramble, Salamander, Kickback, Wrecking Ball | Gravedigger (a ring-out pays), the open arena itself | Salamander (hazards), Kickback | Anchor (the hard counter to every shove), Cloudstep and Bricklayer slabs (recover), Limpet (cling to the wall you are thrown at) |
| **Tank / attrition** | Thick Skin, Anchor, Tithe, Porcupine | Late Bloomer, Gravedigger (heals) | Porcupine (tank that bites) | Late Bloomer and sudden death (long rounds), burst (Paper Dragon, Last Call), blasts (Powder Keg, Demo Permit), Needle Rounds |
| **Glass cannon** | Paper Dragon, Vendetta, Cornered, Hair Trigger | burst, Last Call | Cornered (low HP is its trigger) | Porcupine, Pepperpot, Parting Gift, simply being hit first (60 HP is three hits) |
| **Long arc / sniper** | Needle Rounds (flat), Trebuchet (lob), Limpet (hang on a wall), Last Call, Late Bloomer | the first hit | Limpet (mobility to sniper) | Featherweight and Cloudstep (evasion), Tight Guard, Pepperpot at close range, Salamander lanes |

**Cross-archetype bridges** worth knowing: Kickback + Powder Keg (rocket jumps), Bricklayer + Pinball (a slab you control to bank shots off), Limpet + Needle Rounds (a hanging sniper),
Salamander + Wrecking Ball (shove them into the saw, you ignore it), Tithe + Porcupine (every shard that lands heals you), Demo Permit + Trebuchet (lob shells onto barrels behind cover).

## 3. The 30 cards

Max = how many copies a player may take (the offer never shows a maxed card). "Gen" = generation: bullets spawned by cards cannot spawn more.

| # | Card | Rarity | Headline effect | Archetype | Max |
|---|---|---|---|---|---|
| 1 | Hair Trigger | common | fire rate x2, ammo x2, damage -40%, +4 deg spread | spray | 2 |
| 2 | Pinball | common | +4 bounces, +30% damage per bounce, -25% damage, bounced bullets hurt you | bounce | 2 |
| 3 | Thick Skin | common | max HP x2, size +30%, move speed -25% | tank | 2 |
| 4 | Tight Guard | common | block cooldown -75%, window -50% | parry | 1 |
| 5 | Scramble | common | after any hit: +100% speed, +50% fire rate (2.5 s); -20% max HP | mobility | 1 |
| 6 | Needle Rounds | common | bullet speed x2, no drop, +50% damage, -3 ammo | sniper | 1 |
| 7 | Cloudstep | common | +2 air jumps, -20% speed, -20% HP | mobility | 1 |
| 8 | Paper Dragon | common | damage x2, max HP -40%, -2 ammo | glass | 1 |
| 9 | Anchor | common | knockback taken -80% (hits, blasts, hazards), +30% HP, -15% speed and jump | tank / counter | 1 |
| 10 | Limpet | common | hang still on walls; clinging: +40% damage, -50% knockback; -15% HP | mobility / sniper | 1 |
| 11 | Salamander | common | hazards deal no damage, touching one: +50% fire rate +30% speed (3 s); -15% HP | mobility / counter | 1 |
| 12 | Featherweight | uncommon | size -40%, speed +40%, jump +15%, HP -40%, knocked back x2 | mobility | 1 |
| 13 | Powder Keg | uncommon | bullets explode (blast hurts you too), +25% damage, -20% bullet speed, +25% reload | explosive | 1 |
| 14 | Pepperpot | uncommon | 5 pellets per shot at 8 damage, short range | spray / explosive | 1 |
| 15 | Tithe | uncommon | heal 100% of damage dealt (70 per round), damage -45% | tank | 1 |
| 16 | Wrecking Ball | uncommon | bullets 3x size, 3x knockback, speed -25%, fire rate -40% | ring-out | 1 |
| 17 | Trebuchet | uncommon | shells arc 3x as steeply, +60% damage, +50% size, -3 ammo; aim preview | explosive / sniper | 1 |
| 18 | Kickback | uncommon | each shot pushes you back (380 u/s), your hits shove x2 | mobility / ring-out | 1 |
| 19 | Sleight of Hand | uncommon | a blocked bullet refills the magazine; +50% reload time | parry | 1 |
| 20 | Porcupine | uncommon | when hit: ring of 10 thorn shards (10 damage each, 1 s cooldown); -20% speed | tank / counter | 1 |
| 21 | Cornered | uncommon | at 40% HP or less: +60% damage, +50% fire rate, +30% speed | glass / tank | 1 |
| 22 | Demo Permit | uncommon | barrels you shoot blast +40% wider and spare you; crates and barrels take 2.5x; -15% damage | explosive | 2 |
| 23 | Late Bloomer | uncommon | -20% damage at the start, +8% per 6 s of the round (8 steps) | tank / counter | 2 |
| 24 | Prism Shot | rare | +2 bounces, first bounce splits the bullet in three | bounce | 1 |
| 25 | Return Policy | rare | blocked bullets return x1.5 speed and damage; +50% block cooldown | parry | 1 |
| 26 | Bricklayer | rare | a block conjures a stone slab (platform in the air, wall on the ground, 5 s); -0.1 s window | parry / bounce | 1 |
| 27 | Parting Gift | rare | when you die: 0.5 s fuse, then a 40 damage blast; a kill = draw | explosive / counter | 1 |
| 28 | Vendetta | rare | +50% damage, +20% fire rate, +2 ammo, -25% HP; gone when you win a round | glass | 1 |
| 29 | Last Call | rare | the last bullet of a magazine: 2x damage (40 cap), 2.5x size, 1.3x speed, 2.5x knockback; +25% reload | sniper / explosive | 1 |
| 30 | Gravedigger | rare | ring-outs you cause cost them +12 and heal you 25; +50% knockback; -15% damage | ring-out | 1 |

Duplicates: only **Hair Trigger, Pinball, Thick Skin, Demo Permit and Late Bloomer** may be taken twice (their second copies are listed below); everything else is 1, because a second copy of a dramatic card either hits a cap or breaks the design.

## 4. Card by card

Format: effect with final numbers, hooks / machinery, combos (at least two), counters (at least one), risks, stacks. Percentages on one stat add (see "Rules and caps"). "Burst cap" = fire rate x damage x pellets <= 130.

### Common

**1. Hair Trigger** - *Spray twice as many, half as strong.* Fire rate x2 (6/s), ammo x2 (10), damage x0.6 (12), +4 degrees of random spread. Stats only. Combos: Pepperpot (the burst cap trims it), Tithe (many small heals, capped), Sleight of Hand (a 10-round clip refilled by one block). Counters: Return Policy, Porcupine. Risks: bullet count (live-bullet cap 60). Stacks: 2 (fire rate 8/s cap, damage 8 floor).

**2. Pinball** - *Bullets bounce four times and hit harder every time, you included.* +4 bounces, damage x0.75 (15), lifetime +1 s; every bounce adds +30% of the launch damage (+60% with two). Hook `onShoot` (pale bullets), `onBounce`. Combos: Prism Shot (more bounces for the children), Bricklayer (a slab is a surface), Trebuchet (steep arcs land and bounce). Counters: any block (bounced bullets are destroyed), Anchor. Risks: self-hits (owner immunity ends at the first bounce). Stacks: 2 (6-bounce cap).

**3. Thick Skin** - *Twice the health, a bigger target, and a long fall.* Max HP x2 (200), size +30%, speed -25%. A fall costs 60 HP. Combos: Tithe, Porcupine, Late Bloomer. Counters: Powder Keg and Demo Permit (big target), Wrecking Ball (a big out-of-bounds bill). Stacks: 2 (HP cap 250, size cap 1.6). Sudden death bleeds a fraction of MAX HP, so the extra HP is a buffer, not a win condition.

**4. Tight Guard** - *Block whenever you like, but only for a heartbeat.* Block cooldown x0.25 (1 s), window x0.5 (0.15 s). Stats only. Combos: Return Policy (the parry build), Sleight of Hand (refill every parry), Bricklayer. Counters: explosions, Needle Rounds.

**5. Scramble** - *Getting hit lights a fire under you.* Max HP x0.8; after any damage +100% speed and +50% fire rate for 2.5 s (refreshes, does not stack). Hook `onDamaged` -> timed modifier (a buff ring and the card icon show). Combos: Featherweight, Cloudstep, Salamander (a hazard hit lights both). Counters: Powder Keg (the blast hits while it runs), Pepperpot.

**6. Needle Rounds** *(new)* - *Flat, blindingly fast bullets. Only two in the clip.* Bullet speed x2 (3000 u/s), bullet drop x0 (it is the answer to the arc), damage x1.5 (30), size x0.6, ammo -3 (2). Hook `onShoot` (steel bullets). Combos: Limpet (a hanging sniper), Last Call (the second shot is a 40-damage cannonball), Late Bloomer. Counters: Featherweight and Cloudstep (they dodge a read, not a 3000 u/s bullet but a small body), Tight Guard (a 0.15 s window still catches it if timed). Risks: 4 hits to kill; miss twice and you wait 2 s.

**7. Cloudstep** *(new)* - *Jump twice more in mid-air. The ground feels heavy.* +2 air jumps (each at 85% of the jump velocity), speed x0.8, HP x0.8. Machinery: stat `airJumps`, state `airLeft`, refilled on the ground and on a wall (so wall climbing still works). Combos: Featherweight, Limpet (a wall refills the jumps), Trebuchet (lob from height). Counters: Pepperpot and Powder Keg (area damage does not care that you float), Gravedigger. The air-jump ring under the feet shows each jump. Re-evaluated against wall climbing: kept, because the real gain is recovering after a knock-off.

**8. Paper Dragon** *(new)* - *Hits like a dragon. Breaks like paper.* Damage x2 (40), HP x0.6 (60), ammo -2 (3). Stats only. Combos: Cornered (low HP is its trigger), Vendetta, Hair Trigger (the burst cap trims it to 130/s). Counters: Porcupine, Pepperpot, any first hit. Risks: a mutual kill (draw) is likely and fine.

**9. Anchor** *(new, reworked)* - *Planted. Hits, blasts and hazards barely push you.* Knockback taken x0.2, HP x1.3, speed x0.85, jump x0.85. Machinery: hazard shoves now scale with `knockbackTaken` too (capped at 700). Combos: Thick Skin, Cloudstep (a firm landing), Salamander. Counters: Needle Rounds and Trebuchet (the slow body is a target). It is the hard counter to Wrecking Ball, Kickback, Gravedigger and every shove; against nothing else it is a mild tank.

**10. Limpet** *(new design)* - *Stick to a wall and you stop sliding. Clinging makes you mean.* HP x0.85, wall glide x0 (you hang still while gripping); while clinging (touching a wall in the air) damage x1.4 and knockback taken x0.5. `dynamic` modifier. Combos: Needle Rounds, Last Call (a perched sniper), Cloudstep. Counters: Powder Keg and Demo Permit (area hits the perch), Wrecking Ball (a ring-out from a perch), Pepperpot. The hang is part of the predicted step (stat `wallGlide` is in the movement state). Uses our wall grip, which the original 25 cards could not.

**11. Salamander** *(new design)* - *Spikes, saws and embers cannot hurt you. Touching them lights you up.* Hazard damage x0 (you are still shoved), HP x0.85; on a hazard hit +50% fire rate and +30% speed for 3 s. Hook `onHazard`. Combos: Scramble, Wrecking Ball (you ignore the saw they are shoved into), Kickback. Counters: plain gunfire and blasts (the card does nothing against them), and maps with few hazards (the plaza). Risk: on hazard-heavy maps it is a free 15 HP per touch you would not take.

### Uncommon

**12. Featherweight** - *A speck that darts around. Blown away by anything.* Size x0.6, speed x1.4, jump x1.15, HP x0.6, knockback taken x2. Hazards shove you at most 700 u/s. Combos: Scramble, Cloudstep, Kickback. Counters: Wrecking Ball, Powder Keg, Pepperpot (a small body is still hit by area), Gravedigger.

**13. Powder Keg** - *Every bullet is a bomb. Don't stand too close.* Damage x1.25, bullet speed x0.8 (1200), reload x1.25. Hook `onShoot` (explosive, ember), `onBulletHit` (blast radius 96, children 60%). The blast hurts you too. Combos: Pinball, Kickback (rocket jumps), Demo Permit. Counters: Anchor, Thick Skin, blocking the bullet before it detonates (a block destroys it without a blast), Needle Rounds.

**14. Pepperpot** - *Five pellets per shot. Get close.* +4 pellets (5) in a +-14 degree fan, damage x0.4 (8), lifetime 0.36 s (range about 540). Stats. Combos: Hair Trigger, Powder Keg, Prism Shot. Counters: Return Policy (five reflected pellets), Porcupine, distance.

**15. Tithe** *(reworked)* - *Every hit heals you for what it takes.* Damage x0.55 (11). Hook `onDealt`: heal 100% of what was really dealt (after the caps; bullets, blasts, Demo Permit blasts), 70 HP per round at most, no overheal. Combos: Thick Skin, Porcupine, Gravedigger. Counters: Late Bloomer and sudden death (long rounds), Paper Dragon (burst), blocking (a blocked bullet heals nothing). Anti-synergy: Cornered (a heal switches the bonus off). New hook `onDealt` replaces the old guess from `onBulletHit`.

**16. Wrecking Ball** *(reworked)* - *Huge, slow bullets that launch people off the map.* Size x3 (36 units), knockback x3 (a hit pushes 700 u/s at the cap), bullet speed x0.75 (1125), fire rate x0.6. The old -45% speed would have made the new arcs a mortar; -25% keeps it shootable. Combos: Kickback, Gravedigger, Salamander. Counters: Anchor, Cloudstep and Bricklayer (recover), Limpet.

**17. Trebuchet** *(reworked)* - *Lob heavy shells high over cover. Your aim shows the arc.* Bullet drop x3 (1500), bullet speed x1.25, damage x1.6 (32), size x1.5, ammo -3 (2). The first design assumed drop 80 and "gravity x6"; with drop 500 a x3 shell makes steep, high lobs (a 45 degree shell rises about 600 u) that fall onto cover. Your own aim draws a dotted arc (card flag `preview`; the arc is cosmetic and only for you). Bullets may fly 900 units above the screen and come back. Combos: Demo Permit, Powder Keg, Limpet. Counters: Tight Guard, Featherweight (a lob is slow to arrive), Anchor.

**18. Kickback** *(reworked)* - *Every shot shoves you backwards. Every hit shoves them harder.* Recoil +380 u/s opposite to the aim (vertical recoil is 80%: firing down is a rocket jump), knockback dealt x2. Combos: Powder Keg, Wrecking Ball, Cloudstep. Counters: Anchor (their hits do not shove you, your recoil still works), a ledge: it is a self-ring-out card. Prediction: your own recoil is a host-side impulse, so it arrives as a small correction (measured: mean 1.6 units, largest fade 3.6 per frame on a 100 ms round trip).

**19. Sleight of Hand** *(reworked)* - *Block a bullet and your gun is full again.* Reload x1.5. Hook `onBlock`: the first bullet a block absorbs refills the magazine and cancels a reload (once per block, counted by `blockSeq`). Combos: Tight Guard, Return Policy, Hair Trigger. Counters: explosions and holding fire (a block with nothing to absorb gives nothing).

**20. Porcupine** *(reworked)* - *Hit me and I hit back, ten ways.* Speed x0.8. Hook `onDamaged`: bullet or blast damage from the opponent (not hazards, not self, not a lethal hit), 1 s cooldown: a ring of 10 thorn shards, 10 damage, 900 u/s, 0.4 s, no gravity, generation 1, one shot id (60 per target cap). Combos: Thick Skin, Tithe, Return Policy. Counters: distance (range 360), Needle Rounds, Tight Guard timing; it hurts Hair Trigger and Pepperpot users most.

**21. Cornered** *(reworked)* - *The closer to death, the nastier you get.* `dynamic`: at 40% HP or less damage x1.6, fire rate x1.5, speed x1.3 (the burst cap trims it). Re-evaluated every tick, so a heal switches it off. Combos: Paper Dragon, Scramble, Thick Skin (the threshold is 80 HP). Counters: Tithe (a heal removes it, so they fight each other), patience.

**22. Demo Permit** *(new design)* - *Barrels you shoot blast wider and spare you. Crates crumble.* Damage x0.85; stat `blockDamage` x2.5 (crates, barrels and slabs break 2.5x faster). Hook `onBarrel`: a barrel you destroyed blasts +40% wider (+80% with two) and spares you, and the blast is YOUR attack: the 40 per hit and 60 per trigger pull caps apply (a chain of barrels never does more than 60 to one player), Tithe and Gravedigger see it. Every map has barrels. Combos: Trebuchet, Powder Keg (explosive bullets set barrels off), Pepperpot. Counters: Anchor, Thick Skin, simply standing away from barrels; it is dead on a map without them. Stacks: 2.

**23. Late Bloomer** *(new design)* - *Weak at first. Every six seconds of the round you hit harder.* Damage x0.8 at the start; `dynamic`: +8% per 6 s of live round time, 8 steps (+64% at 48 s: sudden death), break-even after about 15 s; a pulse and the card icon show at every step. Combos: Thick Skin, Porcupine, Sleight of Hand (stall, then win), Needle Rounds. Counters: Paper Dragon and Hair Trigger (kill it early), blasts; anti-synergy: Vendetta. It is the counter to turtles and healers, and weak in a fast round. Stacks: 2 (two copies: -40% at the start, +128% at the end, the 40 per-hit cap holds).

### Rare

**24. Prism Shot** - *A bullet's first bounce splits it into three.* +2 bounces; `onBounce`: the first bounce of an original bullet spawns two children at +-25 degrees (70% damage, generation 1). Combos: Pinball, Powder Keg, Bricklayer. Counters: blocking, Anchor. Risks: self-hits; children cannot split.

**25. Return Policy** - *Blocked bullets come back, aimed at whoever fired them, faster and harder.* Block cooldown x1.5. `onBlock`: reflect (x1.5 speed and damage, cannot be reflected again, up to 5 per block). Combos: Tight Guard, Sleight of Hand, Pepperpot's victims. Counters: explosions are not reflected, holding fire, Needle Rounds.

**26. Bricklayer** *(reworked, machinery)* - *A good block builds you stone: a platform in the air, a wall on the ground.* Block window -0.1 s. `onBlock` (once per block): in the air a 128 x 16 slab under your feet, on the ground a 16 x 72 wall in front of you (or behind if blocked); 60 HP, 5 s, one per owner, solid for both players, shootable, a bounce surface. A lifeline over the pit and cover on the ground. Combos: Pinball, Prism Shot, Tight Guard, Cloudstep. Counters: Powder Keg and Demo Permit (60 HP), Wrecking Ball; the opponent can use the slab too. Sent in snapshots (`sl`).

**27. Parting Gift** *(reworked, machinery)* - *If you go down, they do not walk away clean.* Hooks `onDamaged` (lethal) -> `schedule`: a 0.5 s fuse that holds the round open (a blinking radius ring and the card name show), then a flat 40-damage blast (radius 112, the per-hit cap) with no falloff. If it kills the winner both are dead: the round becomes a draw (no point, no quiz, no card). The winner can simply walk out of the radius in 0.5 s. The first design said 60 damage; the 40 per-hit cap makes it 40. Combos: Thick Skin, Cornered, Powder Keg. Counters: distance, Featherweight (small and fast), Cloudstep.

**28. Vendetta** *(reworked, machinery)* - *A surge of power that lasts until you win a round.* Damage x1.5 (30), ammo +2 (7), fire rate x1.2, HP x0.75; hook `onRoundEnd` (you won) -> `removeCard()`: the card is spent ("VENDETTA SPENT"), stats return to base, it can be offered again. It uses the new round-end hook, so it also ends on an environment win. Combos: Paper Dragon, Cornered, Hair Trigger. Counters: Porcupine; anti-synergy: Late Bloomer (it wants long rounds, Vendetta wants quick ones).

**29. Last Call** - *Your last bullet is a cannonball.* Reload x1.25. `onShoot` when the shot empties the magazine: damage x2 (40 cap), size x2.5, speed x1.3, knockback x2.5 (gold bullet). Combos: Needle Rounds (two-round clip: every second shot), Powder Keg (the big shot is a big blast), Wrecking Ball. Counters: the tell (a gold bullet is easy to see and block), Anchor.

**30. Gravedigger** *(new design)* - *Whoever you knock out of the arena pays extra, and you feel better for it.* Knockback x1.5, damage x0.85. Hook `onRingOut` (a player thrown out within 3 s of YOUR hit): the victim takes +12 (through the caps) on top of the 30% fall, you heal 25. Combos: Wrecking Ball, Kickback, Pepperpot (a point-blank shove). Counters: Anchor, Cloudstep, Bricklayer slabs; no ring-outs on a map where nobody falls. The 2 s out-of-bounds immunity bounds it to one ring-out per 2 s.

## 5. The nastiest stacks and how they are contained

| Stack | Why it is scary | Containment (all tested in `tests/cards.test.mjs` unless noted) |
|---|---|---|
| Paper Dragon + Hair Trigger + Cornered + Vendetta | huge burst on a 60 HP body | burst cap 130/s, per-hit cap 40, magazine budget 240, the owner still dies in 3 hits |
| Kickback + Wrecking Ball + Gravedigger | knock them out every time, heal for it | hit push <= 700 u/s, no body faster than 1100 u/s, 2 s out-of-bounds immunity (at most one ring-out per 2 s), Anchor, Kickback shoves YOU out too |
| Demo Permit x2 + two barrels | a barrel chain could one-shot | the blast is the owner's attack: 40 per blast, 60 per chain per target |
| Porcupine + Hair Trigger + Pepperpot (as the victim) | rings of shards | generation 1, one shot id (60 cap), 1 s cooldown, live-bullet cap 60 |
| Tithe + Thick Skin x2 | never dies | heal cap 70 per round, damage floor 8, Late Bloomer / sudden death (a fraction of max HP) |
| Parting Gift + Powder Keg | a kill from beyond | one 40 damage blast, the winner can walk away, a kill is a draw |
| Limpet + Needle Rounds + Last Call | an unreachable sniper | the last needle is capped at 40, the perch is hit by blasts, Tight Guard |
| Tight Guard + Return Policy + Sleight of Hand + Bricklayer | parry engine | a block needs an absorbed bullet, 0.15 s window, reflected bullets cannot be reflected, explosions pass through, the opponent can stop shooting |

## 6. Rules and caps (unchanged)

- **Stacking:** `final = clamp((base + sum of add) * (1 + sum of (mul - 1)))`, percentages on one stat add. Timed buffs refresh (one entry per card), `dynamic` modifiers follow a state.
- **Stat limits** (`config.statLimits`): damage 8-40, fire rate 1-8, ammo 1-12, reload 0.8-4 s, bullet speed 750-3750, bullet size 3-18, bullet drop 0-4000, lifetime 0.3-5 s, pellets 1-6, spread 0-20 deg, bounces 0-6, knockback 65-780, knockback taken 0.2-2.5, recoil 0-600, max HP 60-250, move speed 180-600, jump 462-924, size 0.6-1.6, block cooldown 1-10 s, window 0.15-0.8 s, **air jumps 0-3, wall glide 0-1, hazard taken 0-1, block damage 1-4**.
- **Derived caps:** burst `fireRate x damage x pellets <= 130`, magazine budget `ammo x pellets x damage <= 240`, per hit 40, per trigger pull per target 60, healing 70 per round, live bullets per player 60, a hit or blast pushes at most 700 u/s, **no body ever moves faster than 1100 u/s** (`move.maxSpeed`).
- **Self-damage is on:** a bullet cannot hurt its owner for 0.15 s or until its first bounce; explosions hurt everyone in range (unless a card spares its owner).
- **Out of bounds:** 30% of max HP, thrown back with 1.5 s of immunity (the top is free). A fall within 3 s of a hit counts as that player's ring-out (`onRingOut`).
- **Sudden death:** after 45 s both players bleed 2% of their max HP per second.
- **Hard bans:** no stun, slow, blind, invisibility, silence, unavoidable damage, one-shot kill, no effect that punishes the opponent's quiz or pick.

**Offer logic.** Five distinct cards per pick, drawn slot by slot with the rarity weights 55 / 35 / 10 (45 / 35 / 20 when the picker is two rounds behind); with 11 / 12 / 7 cards a tier is picked first, then a card in it, so a rare is about 10% per slot. Not offered: a card the picker has maxed out, or a card that would change nothing for him (`cardUseful`: no stat changes after the limits and no hook). A wrong quiz answer removes 3 of the 5. A player makes at most **4 picks** (first to 5 rounds; draws give none), so a build is at most 4 cards; the match-end screen shows up to 5 with full descriptions.

## 7. New machinery (generic, in `src/sim/`, no card names in the sim)

- `dynamic: { key(p, state), mods(key) }` on a card + `updateDynamic` (each tick): modifiers that follow HP, a wall, the round clock; a buff event on increase. State: `p.dyn`.
- Hooks: `onDealt` (damage you dealt, after the caps), `onHazard`, `onRingOut`, `onBarrel` (mutable `ctx.blast`: radius, damage, spare, owner), `onRoundEnd` (`ctx.won`), `onTimer`; `onDamaged` now carries `ctx.lethal`.
- `ctx.removeCard()`, `ctx.schedule(delay, tag, data, {hold})` (plain-data timers in `state.timers`, hold = the round waits; the round becomes a draw if the winner dies in the window), `ctx.spawnSlab(opts)` (temporary solid blocks, `kind: 'slab'`, in snapshots as `sl`), `ctx.hurt(player, n)`, `ctx.fx(kind, data)` (a `cardFx` event for feedback).
- Stats: `airJumps` (movement: air jump, `airLeft`), `wallGlide`, `hazardTaken`, `blockDamage`. Movement stats are in the movement state the client replays (`q` has airLeft, airJumps, wallGlide), so prediction stays exact (tested with Cloudstep, Limpet, Anchor, Featherweight, Thick Skin, Salamander, Scramble).
- `explode(..., {spare, flat, by, shotId})`; hazard damage and shove scale with `hazardTaken` / `knockbackTaken`; `ring-out credit`; vertical recoil 80%; bullets may fly up to 900 units above the screen; new bullet styles steel / gold / thorn.
- Presentation: buff ring + card icon, floating "+N" heal numbers, "RELOADED", fuse ring blink, slab dust, "RING OUT", "VENDETTA SPENT", thorn ring, air-jump ring; HUD build icons; `?scenario=cfx-slab|fuse|ring|trebuchet|permit|cloud|tithe|limpet` freezes each moment for pictures.

## 8. Balance probe and known rough edges

`node tests/cardstats.mjs 120` plays bot-vs-bot rounds with one card on one side (alternating). The bots are weak at long range and do not use cards on purpose, so read it as "does the card change the outcome", not "how good is it". Last run (120 rounds per card, baseline 50%; noise is about +-9 points):
Thick Skin 70 (89 before sudden death was made a fraction of max HP), Anchor 63, Salamander 57, Porcupine 52, Gravedigger 49, Limpet 48, Late Bloomer 48, Pepperpot 48, Sleight of Hand 46, Bricklayer 45, Kickback 45, Trebuchet 43, Demo Permit 43, Tithe 43, Hair Trigger 43, Needle Rounds 41, Cornered 41, Vendetta 38, Parting Gift 37, Cloudstep 36, Prism Shot 35, Last Call 34, Paper Dragon 33, Pinball 33, Wrecking Ball 32, Scramble 30, Featherweight 28. No round under 3 s, no card without an effect.

- The weak ones against bots (Featherweight, Scramble, Wrecking Ball, Paper Dragon, Last Call) are the cards that need a human to use them (dodging, ring-outs, burst timing); they are the first to look at in a human playtest.
- Thick Skin is still the best pick against a bot (a bot rarely kills before sudden death). Counter-cards for tanks exist now (Late Bloomer, Paper Dragon, blasts); watch it in real play.
- Kickback's recoil arrives from the host (about 1.6 units of correction on average); Gravedigger and Salamander depend on the map (ring-outs, hazards); Demo Permit needs barrels (all four maps have them).
- Parting Gift and Vendetta create more draws and rematches of the same pressure; if draws feel bad, shorten the fuse or the radius.
