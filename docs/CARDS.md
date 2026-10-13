# CARDS: card design research and the 25-card set (RawAlanBattleRoyale)

Status: proposal, revision 2 (owner feedback applied: "proper power-ups, more extreme and fun"; new baseline; self-damage; open arena). All numbers are starting values for playtesting, not final.

## Conventions used in this document

- Baseline: HP 100, bullet damage 20 (5 hits to kill), fire rate 3 shots/s, magazine 5, reload 2.0 s, block cooldown 4 s, block window 0.3 s, bullet speed 900 u/s, bullet radius 5, bullet lifetime 3 s, bullet gravity 80 u/s^2, zero bounces, no lifesteal, no air jumps.
- `1u` = width of a player at size 1.0 = 32 logical units (the field is 1280x720 logical = 40u x 22.5u). Explosion radii and slab sizes are given in u. Speeds and impulses are in logical units per second, written "/s" (DESIGN.md writes the same unit "u/s"; there "u" means logical unit, here "u" alone means a body width).
- Percentages on a stat are **additive with each other** (see "Global balance rules"). `-40%` means "factor 0.6 before other cards are added in".
- Stat names follow `docs/DESIGN.md` section 6: `damage, fireRate, magazine, reloadTime, bulletSpeed, bulletRadius, bulletGravity, bulletsPerShot, spread, bounces, knockback, maxHp, moveSpeed, jumpVelocity, size, blockCooldown, blockWindow`. Extra stats this set needs (DESIGN.md lists them too): `airJumps` (base 0), `knockbackTaken` (base 1.0), `recoil` (base 40 logical u/s), `bulletLifetime` (base 3 s).
- "Stat" means a number the card edits. "Hook" means code the card registers. Hooks: `onShoot`, `onBulletHit`, `onBounce`, `onBlock`, `onDamaged`, `onKill`. `onBlock` fires once per bullet the owner's shield destroys; `onKill` fires when the owner's attack kills the opponent (in a 1v1 that is the moment the round is won).
- Infrastructure every card set needs (cheap, build once): (1) a per-player list of **timed stat modifiers** (source id, stat, amount, expires at, refresh policy); (2) **conditional modifiers** (a stat modifier plus a predicate on player state, e.g. "HP <= 40%", re-evaluated whenever HP changes); (3) a per-bullet bag of **flags and fields** the bullet step reads (`explosive`, `generation`, `shotId`, `launchDamage`, `bouncesDone`, `reflected`, `life`); (4) `ctx.removeCard()` (only Vendetta uses it); (5) a delayed-event queue (only Parting Gift); (6) a world-object spawner for slabs (only Bricklayer, "NET: medium"). Everything else is plain stats plus hooks.
- Netcode: the host runs all card logic. Snapshots carry per-bullet render fields (position, radius, owner, flags such as explosive/reflected) and one-shot events for feedback (explosion at x,y; block reflect; fuse ring). Clients never need card logic, only card ids for the UI.

### Rules every card inherits (from decisions in PROGRESS.md)

- **Self-damage is on.** A bullet cannot hurt its owner for its first 0.15 s of life or until its first bounce, whichever comes first. After that it hurts anyone it touches, owner included. Explosions always hurt everyone in the radius, owner included (no immunity). Reflected bullets (Return Policy) get a fresh 0.15 s of immunity for their new owner.
- **Open arena.** There are no walls, floor or ceiling around the screen; platforms float. Bullets that leave the screen are removed (64 logical units past the left/right/bottom edges, 600 above the top so lobs and shots at a player above the screen still work). A bounce therefore needs a platform, a destructible block or a Bricklayer slab: a bullet fired into the void never comes back.
- **Out of bounds.** A player whose centre crosses the left, right or bottom edge takes 30% of their max HP and is thrown back in (2 s immunity to further out-of-bounds damage). Up is free. This damage ignores damage-reduction effects, cannot be blocked, and counts as a hit by the last attacker within 3 s. It is why knockback, recoil, size and max HP matter: a Thick Skin player pays 60 HP for a fall, a Featherweight pays 18.
- **Knockback.** Hit impulse = `260 logical u/s * (hit damage / 20) * attacker.knockback * victim.knockbackTaken`, along the bullet direction, final value capped at 700 logical u/s. Explosion impulse = `400 * (explosion damage / 20) * falloff`, radial, away from the centre. Total speed gained from impulses in one frame is capped at 1000 logical u/s.
- **Explosion damage** at distance d from the centre: 100% for d <= 1u, falling linearly to 40% at the radius, 0 outside. One explosion damages each player at most once. A bullet destroyed by a block does not detonate; an explosion that goes off while you block still hurts you.
- **Draws.** If both players are dead when a round resolves the round restarts: no point, no quiz, no cards.

### Baseline math that drives the numbers

Burst dps (while firing) = `fireRate * damage * bulletsPerShot`. Sustained dps = `magazine * damage / (magazine / fireRate + reload)`.

- Baseline: burst 3 * 20 = **60/s**. A magazine is 100 damage, exactly one bar of HP, so a kill needs all 5 shots to land (1.33 s of perfect hits) or two magazines. Cycle = 5/3 + 2.0 = 3.67 s, so sustained = 100 / 3.67 = **27.3 dps**.
- **Fire rate now matters.** Reload is 54% of the cycle (was 60%), so doubling fire rate shortens the cycle to 2.83 s (+29% sustained). Hair Trigger no longer needs a patch. Reload time and magazine size are still the strongest levers, so reload cards stay rare (this set has none that only shortens reload).
- Out-of-bounds is 30 damage, worth 1.5 baseline hits. Pushing an enemy off a platform edge or off screen is a real damage source, which is what the knockback cards price in.

---

## Design principles (what the research says)

1. **Loser-picks is the catch-up engine; it must not be the only one (ROUNDS).** The loser of each round gets a card, so losing "isn't a punishment" and the trailing player keeps a real chance. Because a match is first to 5, a player makes at most 4 picks, so each card has to be noticeable, and rarity weights can double as a second catch-up dial.
2. **Unbounded stacking decides matches (ROUNDS).** Reviews describe the winner as whoever assembles the most "unhinged" stack, and note that some combinations become "devastatingly overpowered". That is fine for a party game but turns a skill duel into a drafting contest, so extreme cards are paired with hard caps and bounded combo chains. Fun first, but the caps decide how far "unhinged" is allowed to go.
3. **Almost every ROUNDS upside has a paired downside, usually longer reload (ROUNDS).** In the 64-card list the same penalty (slower reload, longer block cooldown) is reused over and over. It works but makes cards samey and makes reload the universal currency. We spread the cost across different axes (HP, move speed, hitbox size, magazine size, self-damage, knockback).
4. **A downside is required only when the upside is broadly useful (Brotato).** The Brotato community balance guide says broad-benefit items need a real downside, while niche items can skip one because needing a particular build is already the cost. Use this to decide which cards get a penalty (Cornered and Anchor are situational and get a light one).
5. **Commons set the direction of the whole stat economy (Brotato).** The same guide calls commons the hardest to balance because they appear most often. Our commons are the simple stat swaps and must not funnel everyone toward one stat.
6. **Additive first, diminishing curve, then multipliers (Binding of Isaac).** The wiki shows damage-ups summed then passed through a diminishing curve, flat bonuses added after, and multipliers multiplied at the end. The run-away cases (Tear Detonator, Pop!) come from items that both multiply projectile count and inherit the parent's damage. Our rule: percent mods add within a stat, and projectiles spawned by a card cannot spawn more projectiles.
7. **Items that bypass the scaling assumption are the main bounded-chain tool (Binding of Isaac).** Akeldama's tears ignore damage scaling and Trisagion trades per-hit damage for hit frequency. We copy the idea: child bullets deal a fixed fraction of damage and cannot split again.
8. **Cards that hook the core verbs are more interesting than stat bumps (Enter the Gungeon).** Gungeon items attach to reload, dodge roll and table flipping. Our block, bounce, reload and knockback interactions play the same role, and opt-in complexity lives on cards, not in the base game. Three cards here (Return Policy, Sleight of Hand, Bricklayer) turn a successful block into a reward.
9. **Authored, named pairings read better than hidden math (Vampire Survivors).** Weapon plus a matching passive gives an evolution, a visible payoff for assembling two specific pieces. In a 4-pick build, 2-card combos must be explicit and quickly discoverable, so each card below lists the cards it pairs with and the offer should show owned-card icons.
10. **Catch-up should be a small, bounded buff, and info should be readable at a glance (TowerFall, Duck Game).** TowerFall's autobalance gives trailing players a shield and leaders fewer arrows, a modest one-off buff rather than a stat snowball. Duck Game sells fast fights where weapons must be readable immediately (weak source, see Sources). Our cards need an obvious visual signature (bullet colour/size, particle) because rounds last seconds.
11. **Lifesteal and similar scaling effects behave very differently depending on fire rate and projectile count (Brotato community discussion).** Healing must be tuned against Hair Trigger and Pepperpot specifically, hence the per-round heal cap.
12. **Things that make 1v1 unfun (design judgement; ROUNDS and others only partly support it).** Stun locks and silences (ROUNDS has Dazzle and Silence), invisibility, one-shot builds, unavoidable damage and effects the victim cannot read. Hard rules for this set: no stun, no blind, no invisibility, no silence, no slows, no damage the victim cannot see coming, no single hit or single trigger pull able to kill from full HP. Knockback is allowed (the open arena turns it into the main way to push someone off), but it is bounded by caps and by the 2 s out-of-bounds immunity.
13. **Make the owner's own risk part of the card (owner decision: self-damage on).** Bounce and explosion cards hurt their owner by design; the card text says so. Extreme upsides are paid for in HP, hitbox size, magazine size or self-damage rather than only in reload time.

## Sources

Used directly (fetched or read from search results):

- ROUNDS card list, 64 cards: https://www.magicgameworld.com/?p=126089 (re-fetched for this revision)
- ROUNDS fan guide (low reliability, used only for the comeback and stacking remarks and extra names): https://www.shapes.inc/fandom/rounds/cards
- ROUNDS review (loser-picks, comeback, chaotic stacking): https://www.gfinityesports.com/article/i-hate-1v1-competitive-games-but-rounds-is-the-unhinged-exception
- ROUNDS loser pick of 3 cards (search snippet only): https://thunderstore.io/c/rounds/p/Six_Mods/PickMore/
- Brotato balance guide (community): https://brotato.wiki.spellsandguns.com/Modding/Balance_Guide
- Brotato balance mod notes (search snippet): https://github.com/DarkTwinge/Brotato-BalanceMod
- Isaac damage stacking: https://bindingofisaacrebirth.wiki.gg/wiki/Damage
- Isaac item pages (search snippets): https://bindingofisaacrebirth.wiki.gg/wiki/Tear_Detonator , https://bindingofisaacrebirth.wiki.gg/wiki/Trisagion , https://bindingofisaacrebirth.wiki.gg/wiki/Akeldama , https://bindingofisaacrebirth.wiki.gg/wiki/Pop%21
- Enter the Gungeon developer Q&A: https://www.gamedeveloper.com/design/q-a-the-guns-and-dungeons-of-i-enter-the-gungeon-i-
- Vampire Survivors evolutions: https://en.wikipedia.org/wiki/Vampire_Survivors
- TowerFall arrows, autobalance (search snippets): https://towerfall.wiki.gg/wiki/Variants , https://en.wikipedia.org/wiki/TowerFall
- Duck Game (weak, TV Tropes summary only): https://tvtropes.org/pmwiki/pmwiki.php/VideoGame/DuckGame

Research limits, stated plainly: little first-party design writing exists for ROUNDS, Brotato, Vampire Survivors and Duck Game. Several points rest on community guides or on my own judgement (marked). The Gungeon and Isaac material is the most solid. The revision itself (extreme numbers, caps) is design judgement, not sourced.

### Name check

All 25 names were compared against the 64-name ROUNDS list fetched above (Abyssal Countdown ... Wind Up) plus the extra names from the fan guide (Bouncy, Homing, Leap, Dash, Triple Jump, Speed, Sprinter, Health, Damage, Fast Firing, Life Steal, Multiple Projectiles, Drill, Remote Detonation), and against well-known Isaac, Gungeon, Brotato and Vampire Survivors item names that I know of. No exact matches. Closest neighbours, kept deliberately different: "Hair Trigger" vs ROUNDS "Quick Shot", "Pepperpot" vs ROUNDS "Buckshot" / "Spray", "Wrecking Ball" vs nothing, "Return Policy" vs ROUNDS "Echo", "Last Call" vs nothing, "Anchor" vs nothing. Mechanics inspired by ROUNDS: bounces (Pinball), explosions (Powder Keg), lifesteal (Tithe), multiple bullets (Pepperpot), block upgrades (Tight Guard). Names and flavour are ours. Do one last pass against the in-game list before art is made.

---

## Summary table

| # | Name | Rarity | One-line effect (headline numbers) | v1 |
|---|------|--------|------------------------------------|----|
| 1 | Hair Trigger | Common | Fire rate +100% (6/s), magazine +100% (10), damage -40% (12), +-4 deg spread | yes |
| 2 | Pinball | Common | Bounces +4, damage -25%; every bounce adds +30% damage (also on you) | yes |
| 3 | Thick Skin | Common | Max HP +100% (200), size +30%, move speed -25%; falls cost 60 HP | yes |
| 4 | Needle Rounds | Common | Bullet speed +120%, no drop, damage +60% (32), magazine -3 (2) | no |
| 5 | Tight Guard | Common | Block cooldown -75% (1.0 s), window -50% (0.15 s) | yes |
| 6 | Scramble | Common | Max HP -20%; after any hit: +100% move speed and +50% fire rate for 2.5 s | yes |
| 7 | Cloudstep | Common | +2 air jumps (3 jumps total), move speed -25%, max HP -20% | no |
| 8 | Paper Dragon | Common | Damage +100% (40), max HP -40% (60), magazine -2 (3) | no |
| 9 | Anchor | Common | Knockback taken -80%, max HP +30%, move speed -15%, jump -20% | no |
| 10 | Featherweight | Uncommon | Size -40%, move speed +40%, jump +15%, max HP -40% (60), knockback taken +100% | yes |
| 11 | Powder Keg | Uncommon | Bullets explode (3u radius, hurts you too), damage +25%, bullet speed -35%, reload +25% | yes |
| 12 | Pepperpot | Uncommon | 5 pellets per shot at 8 damage each, +-14 deg fan, 0.6 s range | yes |
| 13 | Tithe | Uncommon | Heal 100% of damage dealt (max 70/round), damage -45% (11) | no |
| 14 | Wrecking Ball | Uncommon | Bullet radius x3, knockback x3 (700 cap), speed -45%, fire rate -40% | no |
| 15 | Trebuchet | Uncommon | Lobbed shells: gravity x6, damage +90% (38), radius x2, magazine -3 (2) | no |
| 16 | Kickback | Uncommon | Each shot shoves you back 420/s; your hits knock back x2 | no |
| 17 | Sleight of Hand | Uncommon | Blocking a bullet refills your magazine; reload +50% (3.0 s) | no |
| 18 | Porcupine | Uncommon | When hit, fire 10 shards (10 damage each, 1 s cooldown); move speed -20% | no |
| 19 | Cornered | Uncommon | At 40% HP or less: damage +60%, fire rate +50%, move speed +30% | no |
| 20 | Prism Shot | Rare | Bounces +2; a bullet's first bounce splits it into 3 (children at 70% damage) | yes |
| 21 | Return Policy | Rare | Blocked bullets return aimed at their shooter, x1.5 speed and damage; block cooldown +50% | yes |
| 22 | Bricklayer | Rare | A successful block conjures a 4u stone slab under your feet for 5 s; block window -0.1 s | no |
| 23 | Parting Gift | Rare | When you die, a 0.5 s fuse then a 4u blast for 60 damage (kills them too = draw) | no |
| 24 | Vendetta | Rare | Damage +50%, magazine +2, fire rate +20%, max HP -25%; vanishes when you win a round | no |
| 25 | Last Call | Rare | Last bullet of each magazine: damage x2 (40), size x2.5, speed x1.3, knockback x2.5; reload +25% | no |

Rarity count: 9 Common, 10 Uncommon, 6 Rare.

---

## Cards

Field legend: **Max** = how many copies may be picked. **Impl** = stats and hooks. **Combos** = pairs from this list. **Risks** = balance and degenerate stacks. Cap interactions refer to "Global balance rules" below.

### 1. Hair Trigger (Common, v1)
- **Text:** Spray twice as many, half as strong.
- **Effect:** fireRate +100% (3 to 6/s), magazine +100% (5 to 10), damage -40% (20 to 12), spread +4 degrees (each bullet gets a random +-4 degree offset).
- **Math:** burst 72/s (baseline 60), magazine 120 damage, firing time unchanged at 1.67 s, sustained 120 / (1.67 + 2.0) = 32.7 dps (+20%). A kill takes 9 hits instead of 5, and each hit knocks back only 60% as hard (156 /s).
- **Max:** 2. A second copy hits the caps: fireRate 8/s (cap), magazine 12 (cap), damage 8 (floor), spread 8 degrees; burst 64, magazine 96, 13 hits to kill. It is a firehose, not a stronger card.
- **Impl:** stats only (fireRate, magazine, damage, spread).
- **Combos:** Pepperpot (the burst cap decides the result, see Pepperpot), Pinball and Prism Shot (more bouncing bullets, more self-hits), Tithe (many small heals, capped), Sleight of Hand (a 10-round magazine refilled by one block), Kickback (6 recoil impulses per second).
- **Risks:** Weak to Return Policy (spam gets reflected and amplified) and to Porcupine (more hits on the porcupine, but each one only 12). With Kickback the velocity cap exists so you cannot hover. Bullet count on screen rises, so the live-bullet cap applies.

### 2. Pinball (Common, v1)
- **Text:** Bullets bounce four times and hit harder every time, you included.
- **Effect:** bounces +4, damage -25% (20 to 15 at launch), bulletLifetime +1 s (4 s). onBounce: the bullet gains +30% of its launch damage per bounce (15, 19.5, 24, 28.5, 33). Owner immunity ends at the first bounce, so a bounced bullet can hit you.
- **Math:** a direct hit is 15 (weaker than baseline), a once-bounced bank shot is 19.5, a four-times-bounced bullet is 33. Magazine direct damage 75, so the card rewards bank shots. Sustained direct dps 20.
- **Max:** 2. Second copy: bounces +4 more (cap 6), launch damage 10, growth +60% of launch per bounce: 10, 16, 22, 28, 34, 40 (per-hit cap), 40.
- **Impl:** stats (bounces, damage, bulletLifetime) plus hook `onBounce` (adds to the bullet's damage). The core bounce physics must exist anyway.
- **Combos:** Prism Shot (more bounces for the children), Powder Keg (explosive bullets bounce until their last allowed bounce unless they touch a player, so bank shots detonate near the target), Bricklayer (the slab is a bounce surface), Wrecking Ball (bouncing boulders), Trebuchet (arcing bounces off platforms).
- **Risks:** In an open arena bounces need platforms, so the card is a map-reading card and useless in empty sky; a platform cluster is where it shines and where you hurt yourself. Self-hits: shooting at a platform edge next to you returns the bullet within 0.3 s at 15 to 20 damage. Hair Trigger plus Pinball fills the area with bullets; live-bullet cap 60 and lifetime cap 5 s apply. Block destroys any of them.

### 3. Thick Skin (Common, v1)
- **Text:** Twice the health, a bigger target, and a long fall.
- **Effect:** maxHp +100% (100 to 200), size +30% (32 to 42 logical units), moveSpeed -25%. Full heal at round start. Out-of-bounds costs 30% of max HP, so a fall costs 60.
- **Math:** 10 baseline hits to kill (was 5); sustained 27 dps needs 7.3 s of perfect hits.
- **Max:** 2. Second copy: maxHp +200% (300, capped at 250), size +60% (cap 1.6), moveSpeed -50% (floor -40%); a fall costs 75.
- **Impl:** stats only (maxHp, size, moveSpeed).
- **Combos:** Tithe (bigger buffer), Scramble (slow body with a speed burst), Anchor (an immovable wall), Porcupine (soaks hits and retaliates), Parting Gift (lives long enough to matter), Pinball (can afford self-hits).
- **Risks:** The safe pick everyone wants, hence the real costs: slow, large and fragile to shoves (its OOB damage scales with its HP). Weak to Wrecking Ball and Powder Keg (big target, big out-of-bounds bill). The risk is rounds that drag (Tithe plus two Thick Skins): see the round-timer open question.

### 4. Needle Rounds (Common)
- **Text:** Fast, flat, hard-hitting bullets. Two in the clip.
- **Effect:** bulletSpeed +120% (900 to 1980/s), bulletGravity -100% (flat), bulletRadius -40% (5 to 3), damage +60% (32), magazine -3 (5 to 2).
- **Math:** burst 96/s, magazine 64, sustained 64 / (0.67 + 2.0) = 24 dps (-12%). Four hits to kill (three hits is 96). Each hit knocks back 416 /s. A 640-unit shot crosses in 0.32 s, dodgeable but only with a read.
- **Max:** 1.
- **Impl:** stats only. NET/host: swept collision (about 33 units per tick at this speed, so the 8-unit substeps in DESIGN are enough).
- **Combos:** Last Call (every second bullet is boosted but the 40 per-hit cap clamps it), Hair Trigger (magazine +5 cancels the penalty, bullets thinner still), Pinball (long, fast bounces), Wrecking Ball is a poor pair (opposite shapes).
- **Risks:** Unavoidable damage at close range, so the 2-round magazine is the price: miss twice and you wait 2.0 s. Give the thin bullet a bright trail so it stays readable.

### 5. Tight Guard (Common, v1)
- **Text:** Block whenever you like, but only for a heartbeat.
- **Effect:** blockCooldown -75% (4.0 to 1.0 s, the floor), blockWindow -50% (0.30 to 0.15 s). Block uptime goes from 7.5% to 15%.
- **Max:** 1.
- **Impl:** stats only.
- **Combos:** Return Policy (net cooldown 3.0 s, window 0.15 s: the parry build), Sleight of Hand (refill every parry), Bricklayer (a slab per parry, window shorter still), Scramble.
- **Risks:** A 0.15 s window (9 ticks) is hard to hit and you cannot shoot while it is open, so spam costs you trigger time. The danger is the parry engine (Tight Guard plus Return Policy plus Sleight of Hand); see scariest stacks.

### 6. Scramble (Common, v1)
- **Text:** Getting hit lights a fire under you.
- **Effect:** maxHp -20% (80). onDamaged (any damage greater than 0, out-of-bounds included): timed modifier for 2.5 s of moveSpeed +100% and fireRate +50%. A new hit refreshes the timer, it does not stack.
- **Math:** while active, burst 90/s and the magazine empties in 1.11 s; sustained 100 / (1.11 + 2.0) = 32 dps (+18%). Speed +100% is 660 /s, enough to cross the screen in 2 s. After an out-of-bounds throw-back it gets you back into the fight.
- **Max:** 1 (a second copy would only refresh the same timed modifier).
- **Impl:** hook `onDamaged` plus a timed modifier. Timed-modifier list only.
- **Combos:** Featherweight (small, fast; both HP penalties collapse into the 60 HP floor), Thick Skin (slow body, burst of speed), Cloudstep, Hair Trigger (the 8/s fire-rate cap applies).
- **Risks:** A reaction card, so it never snowballs on its own. The skilled counter is not hitting it at all. Self-damage and explosions trigger it too, which makes Powder Keg owners faster after their own blast.

### 7. Cloudstep (Common)
- **Text:** Three jumps. The ground feels heavy.
- **Effect:** airJumps +2 (3 jumps in total; each air jump has 90% of normal jump velocity and resets vertical speed), moveSpeed -25%, maxHp -20% (80).
- **Max:** 1 (cap is 3 air jumps).
- **Impl:** stats only (airJumps, moveSpeed, maxHp). Needs an air-jump counter in the movement code, reset on landing.
- **Combos:** Featherweight (very hard to pin down), Trebuchet (lob from height), Anchor (an air-borne anchor), Scramble. Counters the open arena: you can climb back to a platform after a shove and avoid a fall.
- **Risks:** Evasion archetype. In an open arena a Cloudstep player can climb above the screen: the soft ceiling (see DESIGN) stops anyone hiding up there and bullets still reach it. The ground speed and HP penalties are the price; explosions and Pepperpot punish a floating target.

### 8. Paper Dragon (Common)
- **Text:** Hits like a dragon. Breaks like paper.
- **Effect:** damage +100% (20 to 40), maxHp -40% (60), magazine -2 (3).
- **Math:** burst 120/s (under the 130 cap), magazine 120 damage, sustained 120 / (1.0 + 2.0) = 40 dps (+46%). Three hits kill a 100 HP player (0.67 s of perfect hits); the owner dies to three baseline hits. Each hit knocks back 520 /s. Out-of-bounds costs the owner only 18.
- **Max:** 1 (a second copy would exceed the 40 per-hit cap and the 60 HP floor).
- **Impl:** stats only.
- **Combos:** Hair Trigger (the burst cap clamps it: damage 32 and 6/s would be 192, so damage drops to 21.7), Needle Rounds (damage 51 clamps to 40), Featherweight (HP penalties collapse into the floor, 60 HP either way), Vendetta, Cornered.
- **Risks:** The scariest "pure" glass cannon. Contained by the 40 per-hit cap (never fewer than 3 hits to kill 100 HP), the burst cap, and the fact that the owner has 60 HP; Pepperpot and Powder Keg punish its small margin of error. A mutual-kill draw is likely and is fine.

### 9. Anchor (Common)
- **Text:** Planted. Nothing pushes you around.
- **Effect:** knockbackTaken -80% (hits and explosions push you at 20% strength), maxHp +30% (130), moveSpeed -15%, jumpVelocity -20%. Your own recoil and the out-of-bounds throw-back are not affected.
- **Max:** 1.
- **Impl:** stats only (knockbackTaken, maxHp, moveSpeed, jumpVelocity).
- **Combos:** Powder Keg (you still take the damage but not the shove, so rocket jumps are gone), Thick Skin, Cloudstep (three jumps and a firm landing, but both subtract ground speed), Kickback is a bad pair (your recoil still works, their hits do not).
- **Risks:** The counter-pick to Wrecking Ball, Kickback and Featherweight shoves; with no shove pressure it is a mild tank. Slow and low jump make it vulnerable to Trebuchet shells and Needle Rounds.

### 10. Featherweight (Uncommon, v1)
- **Text:** A speck that darts around. Blown away by anything.
- **Effect:** size -40% (floor 0.6; 19 logical units), moveSpeed +40% (462 /s), jumpVelocity +15%, maxHp -40% (60, the floor), knockbackTaken +100% (hits push you twice as far). Out-of-bounds costs 18 HP.
- **Math:** hitbox area 36% of baseline, 3 hits to kill, a 20-damage hit pushes you 520 /s (a 40-damage hit hits the 700 cap).
- **Max:** 1.
- **Impl:** stats only. Size affects hitbox, sprite and platform contact; confirm gaps still work.
- **Combos:** Scramble and Paper Dragon (HP penalties collapse into the 60 floor), Cloudstep, Kickback, Return Policy (small body, rely on parries). Anchor offsets its shove penalty (+100% - 80% = x1.2).
- **Risks:** The evasion archetype; the counter is area damage (Powder Keg, Pepperpot) and shoves (Wrecking Ball sends it out of the screen). Featherweight plus Cloudstep plus Scramble is the untouchable-looking stack, see scariest stacks.

### 11. Powder Keg (Uncommon, v1)
- **Text:** Every bullet is a bomb. Don't stand too close.
- **Effect:** damage +25% (25), bulletSpeed -35% (585 /s), reloadTime +25% (2.5 s). onBulletHit: the bullet detonates on touching a player, destructible block or terrain (if it still has bounces and touches terrain, it bounces instead and detonates on its last contact, or on touching a player). Explosion radius 3u (96 logical units), damage 25 with the standard falloff (100% within 1u, 40% at the edge), hits everyone in the radius **including you**, once per player per bullet, no separate direct-hit damage. Radial knockback 400 * (25/20) = 500 /s at the centre. Blocks destroy the bullet before it detonates. Destroys destructible blocks in the radius.
- **Math:** sustained 125 / (1.67 + 2.5) = 30 dps at centre hits, plus splash on near misses. At 1.5u (48 logical units) from your own blast you take 21 and are shoved about 420 /s; point-blank costs you 25. Rocket jumps are possible and cost HP.
- **Max:** 1.
- **Impl:** stat mods plus hook `onBulletHit` (`ctx.explode(x, y, radius, damage)`, flag `explosive` on the bullet). One-shot explosion event for VFX.
- **Combos:** Pinball (bank-shot bombs), Prism Shot (children explode at 60% radius and damage), Kickback (rocket-jump), Trebuchet (mortar), Last Call (the big shot is a bigger blast), Anchor (no self-shove), Tithe (heals from the damage dealt to the opponent only).
- **Risks:** Area damage forgives bad aim and counters Featherweight. The self-damage is the leash: close fights hurt you. Do not allow chained detonations (an explosion does not trigger other bullets). The per-shot cap and the one-explosion-per-bullet rule contain Pepperpot plus Powder Keg.

### 12. Pepperpot (Uncommon, v1) [replaces Double Barrel]
- **Text:** Five pellets per shot. Get close.
- **Effect:** bulletsPerShot +4 (5 pellets), spread: pellets fan evenly across +-14 degrees plus 1.5 degrees of jitter, damage -60% (8 per pellet), bulletLifetime set to 0.6 s on the pellets (range 540 logical units). A shot costs 1 ammo. All pellets share one `shotId`.
- **Math:** burst 3 * 5 * 8 = 120/s (under the 130 cap), magazine up to 200. Pellets are about 7 degrees apart: at 200 units from the target about 2 hit (16), at 100 units 2 to 3 (16 to 24), point-blank all 5 (40). Pellets knock back 104 /s each, so a point-blank hit shoves 520 /s (nearly a full Wrecking Ball without the cost).
- **Max:** 1.
- **Impl:** hook `onShoot` (clone the bullet bulletsPerShot-1 times with an angle offset; generation 0 siblings), stats for damage and lifetime.
- **Combos:** Hair Trigger (bursts: 6/s * 5 * 8 = 240 exceeds the cap, so fireRate falls to 3.25/s; you keep the 10-shot magazine), Powder Keg (5 small explosions, the per-shot cap of 60 per target applies), Prism Shot (15 bullets from one bounce, live-bullet cap), Return Policy is its hard counter (five reflected pellets at 12 damage, capped at 60), Wrecking Ball is a bad fit (tiny pellets, big bullets).
- **Risks:** Range-gated by design. The danger is multiplication: the burst cap, the damage floor of 8, the per-shot cap and the live-bullet cap handle it. Pellets bounce only with Pinball (and then fill the screen).

### 13. Tithe (Uncommon)
- **Text:** Every hit heals you for what it takes.
- **Effect:** damage -45% (20 to 11). onBulletHit (on a hit that damages the opponent, not blocked, not self-damage): heal the shooter for 100% of the damage dealt. Healing per round capped at 70 HP, no overheal. Explosion damage dealt to the opponent counts.
- **Math:** each hit is a swing of 22 HP (11 dealt, 11 healed). The opponent needs 9.1 hits to die; you net-heal until the 70 cap, then it is a plain 11-damage gun. Sustained 55 / 3.67 = 15 dps and 15 HP/s healed when everything lands.
- **Max:** 1.
- **Impl:** hook `onBulletHit`; stat damage.
- **Combos:** Hair Trigger (damage floor 8 and the heal cap bound it), Thick Skin (the buffer lasts longer), Pepperpot (pellets heal 8 each, cap applies), Powder Keg, Cornered (heal pushes you out of the low-HP bonus, so they fight each other).
- **Risks:** Sustain stalls rounds, the classic degenerate case. The 70 HP cap and the damage penalty are deliberate; the round timer question exists mainly for this card. Healing on blocked bullets is zero.

### 14. Wrecking Ball (Uncommon)
- **Text:** Huge, slow bullets that launch people off the map.
- **Effect:** bulletRadius +200% (5 to 15), knockback +200% (x3: 780 /s before the 700 cap), bulletSpeed -45% (495 /s), fireRate -40% (1.8/s). Damage unchanged (20).
- **Math:** burst 36/s, sustained 100 / (2.78 + 2.0) = 21 dps (-23%). A hit from a Wrecking Ball sends a target 700 /s: on the ground friction stops them within about 80 units, in the air they fly 130 units against full air control and 600 unopposed. Out-of-bounds is 30 damage, so a well-placed hit on an edge is worth 50.
- **Max:** 1.
- **Impl:** stats only (bulletRadius, knockback, bulletSpeed, fireRate).
- **Combos:** Kickback (knockback cap x3 clamps the sum), Pinball (bouncing boulders), Featherweight victims (shoved twice as far), Bricklayer slabs (a big bullet bounces off them). Countered by Anchor and by Cloudstep (climb back).
- **Risks:** The knock-off card: contained by the x3 knockback cap, the 700 impulse cap, and the 2 s out-of-bounds immunity (a victim can be thrown out at most once per 2 s, 15 damage per second at worst). Big bullets are slow and easy to block or dodge. Big bullets also hit platforms sooner, which makes bounce builds more dangerous to the owner.

### 15. Trebuchet (Uncommon)
- **Text:** Lob a shell. Hard to aim, harder to survive.
- **Effect:** bulletGravity +500% (80 to 480/s^2), damage +90% (38), bulletRadius +100% (10), magazine -3 (2). Bullet speed unchanged (900/s); at 45 degrees a shell flies about 1700 units on level ground.
- **Math:** burst 114/s, magazine 76, sustained 76 / (0.67 + 2.0) = 28.5 dps. Three hits to kill. Shells can arc 400 units above the firing height and descend onto cover.
- **Max:** 1.
- **Impl:** stats only.
- **Combos:** Powder Keg (mortar), Cloudstep (high ground), Pinball (bounce off a platform), Last Call (the second shell is boosted, capped at 40), Hair Trigger (magazine +5).
- **Risks:** Hard to aim, so the damage bonus is the price. Shells fired above the top of the screen stay alive (top removal line is 600 units up). With Powder Keg, expect bombs: the per-hit cap (40) applies to the explosion.

### 16. Kickback (Uncommon)
- **Text:** Every shot shoves you backwards. Every hit shoves them harder.
- **Effect:** recoil +380 (40 to 420 /s opposite to aim), knockback +100% (x2). Total speed gained from recoil in one second is capped (1000 /s overall impulse cap applies).
- **Math:** five shots in 1.67 s give 2100 /s of cumulative recoil impulse; you cannot hover because gravity (1900 /s^2) eats 420 /s in 0.22 s. Firing downward gives about 46 units of lift per shot, enough to cross a small gap.
- **Max:** 1.
- **Impl:** stats only (recoil, knockback).
- **Combos:** Powder Keg (rocket jumps), Wrecking Ball (the knockback cap clamps), Hair Trigger (a recoil stream that can push you off the screen), Cloudstep, Featherweight. A bad pair with Anchor.
- **Risks:** It is a self-OOB card: sustained fire toward the centre pushes you out of bounds (30 damage and a 2 s immunity). That is the price. Possible stalemate where both players are blown to the edges.

### 17. Sleight of Hand (Uncommon) [replaces Greased Bolt]
- **Text:** Block a bullet and your gun is full again.
- **Effect:** reloadTime +50% (3.0 s). onBlock (first bullet absorbed in a block; once per block): instantly refill the magazine and cancel any reload.
- **Math:** without blocks, sustained falls to 100 / (1.67 + 3.0) = 21 dps (-22%). With a refill every 4 s the card is positive, with Tight Guard it is a free reload every second.
- **Max:** 1.
- **Impl:** hook `onBlock`; stat reloadTime.
- **Combos:** Tight Guard (parry and refill), Return Policy (parry, reflect and refill), Hair Trigger (a 10-round magazine refilled), Pepperpot, Bricklayer.
- **Risks:** A bait-and-punish card: opponents can hold their fire and you must reload for 3.0 s. The parry engine with Tight Guard and Return Policy is the scariest block build; the refill needs a real absorbed bullet, so nobody gets infinite ammo from empty blocks.

### 18. Porcupine (Uncommon) [replaces Chain Vest]
- **Text:** Hit me and I'll hit you back, ten ways.
- **Effect:** moveSpeed -20%. onDamaged (damage from the opponent's bullet or explosion; not out-of-bounds, not self-damage; 1.0 s internal cooldown): spawn a ring of 10 shards from your centre, each 10 damage, 700 /s, 0.4 s lifetime (280 units), generation 1 (no bounce, no split, no chain). Shards share one `shotId` (60 per-shot cap).
- **Math:** shards are 36 degrees apart: at 100 units from you the opponent takes 1 shard (10), point-blank 2 (20). At most 10 extra damage per second of fighting.
- **Max:** 1.
- **Impl:** hook `onDamaged` with `ctx.spawnBullet`.
- **Combos:** Thick Skin (a tank that bites), Anchor (immovable spiky wall), Tithe (shard hits heal), Return Policy (hurt them even if they live through the reflect), Scramble. Hurts Hair Trigger and Pepperpot users the most.
- **Risks:** Punishes close range, harmless at distance. The cooldown and the 10 damage shards keep it from being a free damage source. Shards that miss do not return, so it cannot hit you.

### 19. Cornered (Uncommon) [replaces Warm Barrel]
- **Text:** The closer to death, the nastier you get.
- **Effect:** conditional modifier while HP is at or below 40% of max: damage +60% (32), fireRate +50% (4.5/s), moveSpeed +30%. Re-evaluated whenever HP changes, including heals.
- **Math:** the burst cap (130) clamps 4.5 * 32 = 144, so damage becomes 28.9 while active; sustained 144 / (1.11 + 2.0) = 46 dps (+70%). With 100 max HP the bonus starts at 40 HP, two baseline hits from death.
- **Max:** 1.
- **Impl:** `onDamaged` (and heal) toggles a conditional modifier; no stats needed on the card itself.
- **Combos:** Scramble (hit once, shoot 6.75/s: the fire-rate cap 8/s applies), Paper Dragon (low HP from the start: 60 max HP means it is active at 24 HP), Thick Skin (the threshold is 80), Tithe (a heal can switch the bonus off).
- **Risks:** A comeback tool that rewards playing on a knife edge. Low risk of snowballing because it only works near death; the cost is that you are near death. Do not trigger it on Parting Gift's fuse.

### 20. Prism Shot (Rare, v1)
- **Text:** A bullet's first bounce splits it into three.
- **Effect:** bounces +2. onBounce (generation 0 bullets, their first bounce only): spawn two children at +-25 degrees from the reflected direction, each with 70% of the parent's current damage and generation 1; the parent continues. Generation 1 bullets cannot split again but keep their remaining bounces. Children do not inherit Pinball's growth, and an explosive child (Powder Keg) detonates at 60% radius and damage.
- **Math:** up to 240% of the bullet's damage if all three land; realistically one or two. The per-shot cap of 60 on any one target is rarely reached.
- **Max:** 1.
- **Impl:** hook `onBounce`; stat bounces.
- **Combos:** Pinball (bounces 6, growth on the parent), Pepperpot (up to 15 bullets from one volley), Powder Keg, Trebuchet, Hair Trigger.
- **Risks:** Coverage card; the generation rule is the main protection from Tear-Detonator-style runaway (Isaac). Children bounce too, so a platform cluster fills with bullets that come back at you. Live-bullet cap (60) stops further splits.

### 21. Return Policy (Rare, v1)
- **Text:** Blocked bullets come back, aimed at whoever fired them, faster and harder.
- **Effect:** blockCooldown +50% (6.0 s). onBlock: each enemy bullet absorbed in the window (up to 5 per block) changes owner to you, is re-aimed at the opponent's current position, speed x1.5, damage x1.5 (clamped to the 40 per-hit cap), `reflected = 1` (it cannot be reflected again, which prevents ping-pong). Explosions and shards-as-areas are not reflected; only bullets. The reflected bullet gets a fresh 0.15 s of owner immunity for you.
- **Math:** a 20-damage bullet returns as 30 at 1350 /s. A Pepperpot volley of five 8-damage pellets returns as five 12-damage pellets (60, the per-shot cap).
- **Max:** 1.
- **Impl:** hook `onBlock(ctx, bullet)` mutates owner, velocity and flags. NET: easy (existing bullets just change fields).
- **Combos:** Tight Guard (net cooldown 3.0 s), Sleight of Hand (reflect and refill), Pinball (reflected bullets keep bouncing, and may hit you), Thick Skin. Hard counter to Hair Trigger and Pepperpot.
- **Risks:** Strong against bullet spam; a mistimed block costs 6.0 s, which is the real downside. A reflected Powder Keg bomb is destroyed by the block, not reflected (so it does not blow up on its owner; explosions are not bullets). Bound by `reflected` and the 5-bullet cap.

### 22. Bricklayer (Rare)
- **Text:** A good block builds you a stone slab to stand on.
- **Effect:** blockWindow -0.1 s (0.2 s). onBlock (first bullet absorbed in a block; once per block): spawn a slab 4u wide and 0.5u tall (128 x 16 logical units) with its top edge at your feet. It is solid for both players, HP 60 (destructible), lasts 5 s, one slab per player at a time; shifted down until it does not overlap a player. It reflects bullets like any platform (a bounce surface for Pinball).
- **Math:** in the open arena a slab is a lifeline: a mid-air parry creates a platform under you, so you do not fall out of bounds, and a bounce surface under your own gun.
- **Max:** 1.
- **Impl:** hook `onBlock` creates a world object (destructible block with a timer and owner). NET: medium (one new entity type in the snapshot, reusing the destructible-block code).
- **Combos:** Pinball and Prism Shot (a bounce surface you control), Cloudstep, Tight Guard, Sleight of Hand. Countered by Powder Keg (60 HP) and Wrecking Ball.
- **Risks:** The opponent can use the slab too, and it blocks line of sight; short lifetime (5 s), 60 HP and the one-slab rule keep turtling in check. If playtests show stalling, shorten to 3 s.

### 23. Parting Gift (Rare)
- **Text:** If you go down, they don't walk away clean.
- **Effect:** when damage would kill you (`onDamaged` lethal), you die as normal and a 0.5 s fuse (visible ring) starts at your position. When it ends, an explosion of radius 4u (128 logical units) deals a flat 60 damage (no falloff, no immunity) and a 600 /s shove. Round resolution waits for the fuse. If the blast kills the opponent, both are dead and the round is a **draw** (restart, no point, no quiz, no card). If the opponent survives, they win normally.
- **Math:** the winner can leave: 0.5 s at 330 /s is 165 units, more than the 128 radius, if they react. At 60 HP or less the blast is lethal, so the card punishes finishing someone off at low HP in melee range. It does nothing against an opponent at 100 HP.
- **Max:** 1.
- **Impl:** hook `onDamaged` (lethal flag) plus the delayed-event queue; the round state machine handles the pending fuse (DESIGN.md section 2).
- **Combos:** Thick Skin (live longer, die close), Cornered, Featherweight (dies near the enemy), Powder Keg (shares the explosion code).
- **Risks:** Draw handling (resolved: restart). It can be used to deny a match point when trailing, at the cost of getting no card that round. If it becomes a stalling tool, reduce damage to 40. Self-damage does not apply (you are dead).

### 24. Vendetta (Rare) [replaces Ledger]
- **Text:** A surge of power that lasts until you win a round.
- **Effect:** damage +50% (30), magazine +2 (7), fireRate +20% (3.6/s), maxHp -25% (75). onKill (you win the round): the card is removed from your build before the next round (`ctx.removeCard()`), and may be offered again later.
- **Math:** burst 108/s (under the cap), magazine 210 (under the 240 budget), sustained 210 / (1.94 + 2.0) = 53 dps (+95%). Four hits kill a 100 HP player. The owner dies to four baseline hits.
- **Max:** 1.
- **Impl:** stats plus hook `onKill` (`ctx.removeCard`). This is the only card using `onKill`.
- **Combos:** Paper Dragon (HP collapses to the 60 floor), Hair Trigger, Cornered, Tithe. Pairs naturally with comeback picks.
- **Risks:** It is a strong, temporary comeback tool that costs itself on the win. If you keep losing you keep it, which stacks with later picks; the caps still bound it. Replaces Ledger because Ledger gave nothing on the round you picked it.

### 25. Last Call (Rare)
- **Text:** Your last bullet is a cannonball.
- **Effect:** reloadTime +25% (2.5 s). onShoot: when the shot empties the magazine, that bullet gets damage x2 (40, the cap), bulletRadius x2.5, bulletSpeed x1.3, knockback x2.5 (700 cap).
- **Math:** baseline magazine 4 * 20 + 40 = 120; with three earlier hits the finisher kills (60 + 40 = 100). Sustained 120 / (1.67 + 2.5) = 28.8 dps. The opponent can see the big bullet coming and block it.
- **Max:** 1.
- **Impl:** hook `onShoot` (inspect remaining ammo, modify the bullet).
- **Combos:** Powder Keg (the finisher detonates at 40 damage, so the blast hurts more, including you), Trebuchet and Needle Rounds (every second shot is boosted; the 40 cap clamps), Wrecking Ball (the finisher is a guaranteed knock-off), Hair Trigger (longer wait, same bonus), Sleight of Hand (a refill resets the count).
- **Risks:** Creates a tell, which is the skill expression. The per-hit cap (40) means it cannot one-shot at 100 HP and cannot be amplified by Paper Dragon.

---

## Version 1 set: the 10 and why

**Hair Trigger, Pinball, Thick Skin, Tight Guard, Scramble, Featherweight, Powder Keg, Pepperpot, Prism Shot, Return Policy.**

What changed from revision 1: nothing in the set except **Double Barrel became Pepperpot** (renamed and extreme: 5 pellets instead of 2). I re-checked whether the rework justified swapping others in. Wrecking Ball and Anchor are cheaper and show off the new knockback system, but Featherweight (knockbackTaken), Powder Keg (explosion shove) and Pepperpot (point-blank shove) already exercise it in v1, so the set stays.

| Requirement | How the set meets it |
|---|---|
| Cheap to implement | 5 of 10 are pure stat cards (Hair Trigger, Thick Skin, Tight Guard, Featherweight; Pinball needs one tiny hook). Scramble needs only the timed-modifier list. The rest need one small hook each. |
| Different axes | Offence: Hair Trigger, Pepperpot. Defence: Thick Skin. Mobility: Featherweight, Scramble. Bullet behaviour: Pinball, Prism Shot. Explosions and shoves: Powder Keg. Block interaction: Tight Guard, Return Policy. |
| Hooks exercised | `onShoot` (Pepperpot), `onBulletHit` (Powder Keg), `onBounce` (Pinball, Prism Shot), `onBlock` (Return Policy), `onDamaged` (Scramble). `onKill` is left out (only Vendetta uses it, so it waits for v1.1). |
| At least two real combos | **Pinball + Prism Shot** (bounces 6, split children, self-hit chaos). **Pinball + Powder Keg** (bank-shot bombs, risky for the owner). **Tight Guard + Return Policy** (parry engine, net cooldown 3.0 s). **Hair Trigger + Pepperpot** (exercises the burst cap). **Featherweight + Scramble** (small and fast; HP penalties collapse into the 60 floor). |
| At least one trade-off | Every v1 card has a real downside: Hair Trigger (damage and spread), Pinball (damage and self-hits), Thick Skin (size, speed, bigger falls), Tight Guard (window), Scramble (HP), Featherweight (HP and shoves), Powder Keg (speed, reload, self-damage), Pepperpot (range and damage), Prism Shot (self-hits), Return Policy (cooldown). |
| Open arena and self-damage | Pinball, Powder Keg and Prism Shot test self-damage; Featherweight and Powder Keg test knockback and out-of-bounds; Thick Skin tests the HP-scaled fall cost. |
| Pool size | 10 cards with 5-card offers means every offer shows half the pool. The v1 pool has 5 Common, 3 Uncommon, 2 Rare. |

What v1 leaves for later and why: Paper Dragon, Needle Rounds, Cloudstep and Anchor are cheap stats but add little to proving the system; Wrecking Ball and Kickback are cheap but depend on tuned knockback; Bricklayer needs world-object work; Parting Gift needs the round state machine's fuse rule; Vendetta needs `onKill` and `removeCard`; Tithe, Porcupine, Cornered, Sleight of Hand and Last Call are single-hook cards that can come as soon as the hook set is stable.

## Global balance rules

**Stat stacking**
- Percent modifiers on the same stat add: `final = (base + flat) * (1 + sum of percents)`. They never multiply with each other (this is the main protection against +100% cards compounding). Different stats multiply by nature (fire rate times damage), which is why derived caps exist.
- Timed and conditional modifiers refresh rather than stack unless a card says otherwise. Each source id appears once per target.
- Hard caps and floors (clamped after all modifiers, in this order):

| Stat | Floor / cap |
|---|---|
| damage (launch) | 8 to 40 (0.4x to 2x baseline) |
| damage per hit (all sources: growth, multipliers, explosions) | 40 |
| damage from one trigger pull to one target (all pellets, children, explosions, reflected) | 60 |
| fireRate | 1 to 8 shots/s |
| magazine | 1 to 12 |
| reloadTime | 0.8 to 4.0 s |
| bounces | 0 to 6 |
| bulletSpeed | 0.5x to 2.5x |
| bulletRadius | 0.5x to 3x |
| bulletGravity | 0 to 8x |
| bulletLifetime | 0.4 to 5 s |
| bulletsPerShot | 1 to 6 |
| spread | 0 to 20 degrees |
| knockback dealt | 0.25x to 3x, resulting hit impulse 700 /s max |
| knockbackTaken | 0.2x to 2.5x |
| recoil | 0 to 600 /s per shot, and total speed from impulses 1000 /s |
| maxHp | 60 to 250 |
| moveSpeed | -40% to +100% |
| jumpVelocity | -30% to +40% |
| airJumps | 0 to 3 |
| size | 0.6 to 1.6 |
| blockCooldown | 1.0 to 10 s |
| blockWindow | 0.15 to 0.8 s |
| healing per round | 70 HP |
| live bullets per player | 60 (extra children and shards are simply not spawned) |

- **Derived limits** (resolved at stat recompute, in this order):
  1. *Burst cap:* `fireRate * damage * bulletsPerShot <= 130` (2.2x baseline burst). If exceeded, lower damage first (not below 8), then fireRate.
  2. *Magazine budget:* `magazine * bulletsPerShot * damage <= 240` (2.4x baseline max HP). If exceeded, lower magazine.
- **Minimum time to kill:** the hit cap (40) and HP floor (60) guarantee at least 3 hits for a 100 HP player and at least 2 hits for a 60 HP player; the per-shot cap (60) means no single trigger pull kills a 100 HP player.
- Penalties that overlap past a floor are simply wasted (Featherweight, Scramble, Paper Dragon, Vendetta and Cloudstep all push max HP toward the 60 floor). That is intended: a dramatic card is not made unplayable by a second one.

**Projectile rules**
- Cards that spawn bullets (Pepperpot, Prism Shot, Porcupine) tag them with `generation` and `shotId`. Generation 1 bullets cannot spawn or split further.
- Bullet lifetime 3 s base. Bullets are removed outside the screen (64 units past left/right/bottom, 600 above the top).
- Self-damage: see "Rules every card inherits". Reflected bullets change owner.
- Fast bullets need swept collision on the host.

**Hard bans in this card set** (unfun in a 1v1, see principle 12): stun, silence, blind, invisibility, slows, damage over time you cannot see coming, and any single hit or trigger pull that can kill from full HP at 100 max HP.

**Rarity and offer**
- Offer size: 5 cards for the loser, drawn without duplicates; cards at their max stacks are excluded. A wrong quiz answer removes 3 of the 5 at random and the loser picks from the remaining 2 (DESIGN.md section 12).
- Draw weights per slot: Common 55, Uncommon 35, Rare 10. Fall back to the next rarity if a tier is empty.
- Catch-up dial: if the picker is 2 or more rounds behind, weights become Common 45, Uncommon 35, Rare 20. Not larger, so a rare is never guaranteed.
- A player makes at most 4 picks per match (first to 5 wins, so at most 4 losses before the match ends); so a stack is at most four cards, plus the duplicate exceptions. At base weights each offer shows 0.5 Rares on average.
- Show both players' collected cards to both at all times; open information makes combos readable. Show effective (post-cap) values in the HUD.

**Duplicates policy**
- Every card has a `maxStacks`. Default 1. Only **Hair Trigger, Pinball and Thick Skin may be picked twice** (their second copies are listed per card, and they hit caps on purpose). Everything else is 1, because second copies of dramatic cards either do nothing (they hit a cap) or break the design.
- A card that has reached its max is removed from that player's offers, not shown greyed. Vendetta removes itself when you win a round and may be offered again.

**Scariest stacks and how they are contained**

| Stack | Why it is scary | Containment |
|---|---|---|
| Paper Dragon + Hair Trigger + Cornered or Vendetta | Huge burst on a 60 HP body | Burst cap 130/s, hit cap 40, magazine budget 240; the owner still dies in 3 hits and every extreme stat is clamped before it is applied |
| Pinball x2 + Prism Shot + Powder Keg | Bouncing, splitting bombs that grow per bounce | Bounces cap 6, children cannot split and explode at 60%, one explosion per bullet, per-shot cap 60 per target **including you**, live-bullet cap 60, block destroys bombs; it only works near platforms and hurts the owner first |
| Wrecking Ball + Kickback (+ Powder Keg) | Knock the enemy out of the screen every time | Knockback cap 3x and 700 /s, 2 s out-of-bounds immunity (at most 15 damage/s from this), Anchor and Cloudstep as counters, and Kickback shoves you out too |
| Featherweight + Cloudstep + Scramble | Looks untouchable (size 0.6, 3 jumps, +100% speed) | HP floor 60 (3 hits), no slows or stuns needed to catch it, Pepperpot and Powder Keg punish it, Wrecking Ball sends it out of bounds, shoves x2 |
| Tight Guard + Return Policy + Sleight of Hand | Parry engine: reflect and refill every 3 s | A block needs an absorbed bullet to pay off, the 0.15 s window, reflected bullets cannot be reflected again, per-shot cap 60, and the opponent can simply stop shooting |
| Tithe + Thick Skin x2 + Porcupine | Stalls the round | Heal cap 70/round, damage floor 8, round timer (open question) |

**Pre-ship checks for each card (to run in a headless bot test)**
- Time to kill from full HP with the card: report the fastest and the median.
- Sustained dps against the 27.3 dps baseline; flag any card or pair above 55 dps, and any pair that reaches a cap.
- All 2-card combinations among the pool, looking for ones that beat the baseline by more than about 2x in win rate; plus the six stacks above.
- Self-damage rate per card (damage dealt to the owner per round) for Pinball, Prism Shot, Powder Keg, Kickback, Trebuchet.

## Open design questions for the project owner

1. **Round timer / sudden death.** Tank and sustain cards (Thick Skin x2, Tithe, Porcupine) can make a round long. Proposal: after 45 s both players lose 2 HP/s, with a visible warning. Do you want a timer, and at what length?
2. **Is the cap level right?** Caps keep matches playable (no 2-hit kills, burst limited to 2.2x baseline), but they also stop the most "unhinged" ROUNDS-style stacks. Should the caps be looser (more chaos) or tighter (more skill)?
3. **Catch-up beyond the pick.** Should trailing players also get a mild one-round bonus (like TowerFall's shield) on top of the pick? I recommend not, until playtests show the pick is not enough. Vendetta is already a card-based catch-up tool.
4. **Parting Gift and draws.** A draw gives no point and no card, so a trailing player can use Parting Gift to deny a match point. I left it in, with the 0.5 s escape window. OK, or should a draw still count in some way?
5. **Vendetta disappears when you win.** Intended as a comeback tool, not a snowball. OK, or should it be permanent?
