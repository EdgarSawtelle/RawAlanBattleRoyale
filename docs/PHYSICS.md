# PHYSICS.md - how ROUNDS moves and shoots, how we differ, what to change

Scope: character-versus-platform behaviour and bullet flight. Written for an engineer who will edit `src/config.js`, `src/sim/player.js`, `src/sim/collision.js`, `src/sim/bullet.js`, `src/sim/combat.js`, `src/practice/dummy-bot.js`, `src/cards.js` and the tests, without further research.

Our units: logical field 1280x720, 60 Hz fixed step, player 30x30, y grows downward.
ROUNDS units: its play field is 71.12 x 40 world units (see section 2.7), so **1 ROUNDS world unit = 18 of our units** (720 / 40).

## 0. Summary (read this first)

| # | Finding | Confidence |
|---|---|---|
| 1 | ROUNDS does NOT use a physics engine for the player. It is a hand-written model: velocity integrated by script, a circle collider pushed out of walls, acceleration-based movement with drag, and a **gravity that grows with time spent in the air** (and is switched off while the player grips a wall). | High (read from the game's decompiled code, section 2) |
| 2 | **Wall grip needs input toward the wall, an airborne body, and a near-vertical contact (normal within ~27 degrees of horizontal).** While gripping, the heavy gravity term is zero, so you glide down at a slow, gradually increasing speed instead of falling. There is no timer: you can hold on as long as you keep pushing into the wall. | High for the rules, Low for the exact slide speed (it depends on Inspector values that are not in the code) |
| 3 | **Wall jump = impulse along (0.4 x wall normal + 0.8 up)**, i.e. mostly vertical with a small kick (horizontal:vertical = 1:2), allowed up to 0.1 s after the last wall contact, and it refills your one jump. Re-grab is ignored for 0.15 s after any jump. Repeating this on one wall climbs it ("hold toward the wall and tap jump"). | High (code and the Rounds-Modding patch agree) |
| 4 | There is **one jump charge**, refilled by touching ground or wall. It is not tied to being on the ground, so walking off a ledge keeps the jump for as long as you fall. | High (code + fandom wiki) |
| 5 | Bullets: straight-line launch from the **player centre**, no inheritance of the shooter's velocity, no drag by default, constant downward acceleration (code default 30 world units/s^2 = 540 of our u/s^2), perfect mirror reflection on bounce, terrain tested with a zero-width ray, players with a circle of radius ~0.375 world units. | High for structure, Medium for gravity (prefab may override), **bullet speed is not recoverable** |
| 6 | Shooter recoil does **not** push the player's body in the code we read; it kicks the gun sprite only. Our `recoil: 40` is not ROUNDS-like. | Medium (inferred from code) |
| 7 | Block = 0.3 s of invulnerability (no damage, no knockback), cooldown 4 s. A blocked bullet is **reversed along its own path** (velocity * -1) and can hit its shooter. | High (code) |
| 8 | Our bullets barely arc (drop 32 units over 800 units of range, 1 body height). To read as arcs, we need roughly 2 to 3 times the drop (about 70 units at 800). | Design target, not a measured ROUNDS value |

The numbers that define "how floaty / how fast" in ROUNDS (run force, drag, jump force, gravity force, bullet speed, player radius) are **serialized in Unity prefabs and are not in any source I could read.** Everything in section 5 that uses a number is therefore a design proposal tuned in our units, tagged as such. Do not present it as measured ROUNDS data.

Tags used below: **[sourced: URL]** a primary or secondary source states it; **[inferred from source]** derived by reading code (still primary, but my reading); **[impression]** descriptions of gameplay, not verified in code.

## 1. Sources and how reliable they are

- **Decompiled ROUNDS code**, mirrored at `http://git.warmcat.org/ROUNDS/tree/GameCode/` (cgit repository, "plain" view per file, e.g. `http://git.warmcat.org/ROUNDS/plain/GameCode/PlayerJump.cs`). It is a third-party decompile of the commercial game's `Assembly-CSharp.dll` (repo dated Oct 2023, game version not stated). I read it only to extract rules and constants; nothing is copied into our code. Inspector-assigned values (anything declared `public float x;` with no initializer) are **missing**.
  Files used: `PlayerJump`, `PlayerMovement`, `PlayerVelocity`, `Gravity`, `CharacterData`, `CharacterStatModifiers`, `PlayerCollision`, `LegRaycasters`, `Gun`, `GunAmmo`, `WeaponHandler`, `MoveTransform`, `RayCastTrail`, `RayHitReflect`, `ProjectileHit`, `Block`, `HealthHandler`, `OutOfBoundsHandler`, `ScreenEdgeBounce`, `NetworkPhysicsObject`, `DamageBox`, `Saw`.
- **Rounds-Modding PlayerJumpPatch** `https://github.com/Rounds-Modding/PlayerJumpPatch` (README plus source summary): independently confirms the 0.1 s thresholds and the `up*0.8 + wallNormal*0.4` wall-jump vector, and that `jumps` defaults to 1 (the patch resets it to 1).
- **ROUNDS fandom wiki, Moveset page** `https://rounds.fandom.com/wiki/Moveset` (direct fetch returned HTTP 402; read through search-result excerpts): the jump "can be stored up to one charge", works on ground or in the air, and is restored on landing.
- **NamuWiki (English)** `https://en.namu.wiki/w/ROUNDS` (fetch returned 403; excerpts only): characters can stick to walls and climb them by holding toward the wall and pressing jump; touching a wall restores the jump; falling off the map edge hurts and pushes you back; blocking at the edge avoids the damage and bounces you.
- **ROUNDS fandom wiki, Strategies** `https://rounds.fandom.com/wiki/Category:Strategies` (excerpts): "shield jumping" with block next to a wall or floor moves you far (this comes from card block-force effects, not the base game).
- **rounds.network** `https://rounds.network/rounds-fundamentals-core-mechanics-explained/`: **unreliable**. It claims every character has a double jump and that falling off the map is instant elimination; both are contradicted by the code (`jumps = 1`, 51 damage). Used only for "momentum carries through jumps".
- **magicgameworld.com card list** `https://www.magicgameworld.com/?p=126115`: card modifiers only, no base values.
- Things I could not find anywhere: bullet speed, player radius, run force, drag, jump force, ramp gravity constant, slide speed, any frame-accurate video analysis.
- Fandom, NamuWiki, Steam guides and Archive.org were partly blocked (402/403/429); this is why some wiki facts are excerpts.

## 2. How ROUNDS actually works

### 2.1 Character model

Player = a circle collider (`CircleCollider2D`) on a script-integrated body, not a Rigidbody. [inferred from source: `PlayerVelocity.cs`, `PlayerCollision.cs`]

| Fact | Detail | Tag |
|---|---|---|
| Integration | Each fixed update: `velocity += down * dt * 20`, then `position += velocity * dt`. So there is always a constant 20 world units/s^2 (= 360 of our u/s^2) of gravity, even on a wall. | [sourced: http://git.warmcat.org/ROUNDS/plain/GameCode/PlayerVelocity.cs] |
| Extra gravity | `Gravity` component adds `down * t^exponent * gravityForce` (acceleration units, because "Force" mode multiplies by 0.02 and divides by mass), where `t = min(sinceGrounded, sinceWallGrab)`. t is 0 on the ground and while gripping a wall; it grows while airborne. **Gravity ramps up with air time**: floaty at the start of a jump, heavier the longer you fall. `gravityForce` and `exponent` (default 1) come from the prefab. | [sourced: .../Gravity.cs, .../CharacterData.cs] |
| Horizontal movement | Force-based. Input direction times `movementSpeed * force` is applied as acceleration; `PlayerMovement.FixedUpdate` then removes a fraction of velocity each step (`extraDrag`), so the max speed is where force equals drag (exponential approach, not a hard cap). | [sourced: .../PlayerMovement.cs] |
| Air control | `airControl = 0.3`: **both the force and the drag are multiplied by 0.3 in the air.** Max speed is unchanged (the factor cancels) but acceleration and braking are about 3.3 times slower, so you carry momentum in the air. | [sourced: .../PlayerMovement.cs] |
| Pressing down | The downward input is clamped to [-1, 0] and doubled: holding "down" pushes you down twice as hard (fast fall). Up does nothing for movement. | [sourced: .../PlayerMovement.cs] |
| Ground contact | Ground is detected by ray casts from the legs (1 world unit long); a surface counts as ground only if its normal is within 70 degrees of up (walkable slopes). A spring force on those rays makes the body hover and bob when walking. | [sourced: .../LegRaycasters.cs] |
| Wall / terrain push-out | Every fixed update a circle cast finds overlapping colliders. For each hit the player is moved out along `(playerCentre - contactPoint).normalized` by `0.75*radius - distance`, gets `velocity += normal * overlap * 10`, and `velocity -= velocity * overlap` (a damping proportional to how deep the overlap is, on **all** axes). Because the push direction is radial from the contact point, **a circle that touches a platform corner is pushed diagonally and rolls round it**. | [inferred from source: .../PlayerCollision.cs] |
| Anti-tunnel | A ray from last position to current position; if it crossed a surface the player is put back at the hit point plus 0.5 along the normal. | [sourced: .../PlayerCollision.cs] |
| Moving ground | Standing on a rigidbody platform moves you by its displacement. | [sourced: .../PlayerFollowGround.cs] |

### 2.2 Walls: grab, slide, climb

All from `CharacterData.TouchWall`, `PlayerCollision`, `PlayerMovement`, `Gravity`, `PlayerJump`.

1. **Engage condition** (evaluated for every collider touching the circle): not grounded, contact normal nearly horizontal (`|normal.y| < 0.45`, i.e. wall within about 27 degrees of vertical), the player's horizontal input is non-zero and points **into** the wall (angle between input and the away-from-wall normal > 90 degrees), and the last jump was at least 0.15 s ago. Not holding toward the wall = no grab; you just brush past and the round collider slides you down. [inferred from source]
2. **While gripped**: `sinceWallGrab` is held at 0, so the time-ramped gravity term is 0 and only the constant 20 u/s^2 plus drag applies. The grip flag decays one frame after contact is lost. `sinceGrounded` also grows at only 0.2x while pressed into a wall (`wallDistance < 0.7`). [sourced: .../CharacterData.cs]
3. **No cling timer, no hard slide-speed cap in the code**; the slide speed is whatever balance of constant gravity, drag and the wall-contact damping gives. Net feel: you hang on, drifting down slowly and accelerating gently, for as long as you keep pushing in. [inferred; speed value unknown]
4. **Wall jump** (`PlayerJump.Jump`): allowed if `sinceWallGrab < 0.1` and not grounded (so a 0.1 s wall-coyote, same as ours). Direction vector `up * 0.8 + wallNormal * 0.4`, multiplied by the same jump impulse as a ground jump; downward velocity is zeroed first; **no momentum-carry term** (the ground jump adds a term proportional to current horizontal speed, the wall jump does not). It refills `currentJumps`, so wall jumps can be chained forever. [sourced: .../PlayerJump.cs and https://github.com/Rounds-Modding/PlayerJumpPatch]
5. **Hold-to-jump-higher**: while the jump key stays down and `sinceJump < 0.2`, an extra upward force is applied (roughly +80% on top of the initial impulse over 0.2 s, my arithmetic from the constants). This applies to wall jumps too. A tap gives a short hop; releasing early does not cut velocity, it just stops adding. [inferred from source: .../PlayerJump.cs]
6. **Climbing**: hold toward the wall and tap jump: each tap hops up and slightly away, the held input pulls you back to the wall, and after 0.15 s the grip re-engages and the jump is refilled. [impression: https://en.namu.wiki/w/ROUNDS; consistent with 3 and 4]
7. **Wall coyote only applies to the wall you last held**; touching a wall refills the jump only if the last jump was 0.15 s ago or more. [sourced: .../CharacterData.cs]

### 2.3 Jump and air

| Fact | Detail | Tag |
|---|---|---|
| Jump charges | `jumps = 1`, `currentJumps` refilled on ground contact (if last jump > 0.2 s ago) and on wall contact. `Jump()` does **not** check "grounded": it needs `currentJumps > 0` or a wall contact within 0.1 s. Walking off a ledge keeps your charge: a jump in mid-air later is allowed (unbounded coyote). Jumping from the ground spends it. | [sourced: .../PlayerJump.cs, .../CharacterData.cs; https://rounds.fandom.com/wiki/Moveset] |
| Double jump | Only via cards (`numberOfJumps` stat). Not a base mechanic. | [sourced: .../CharacterStatModifiers.cs] |
| Jump buffer | None in code (`Jump()` runs once on the press; it returns early if no charge). | [inferred from source] |
| Ground jump momentum | Adds an impulse proportional to the current horizontal velocity (`sideForce` default 1): jumping while running boosts your speed by a fraction (value depends on `upForce`, unknown). | [sourced: .../PlayerJump.cs] |
| Stat scaling | Jump, speed and gravity cards multiply `jump`, `movementSpeed`, and `Gravity.gravityForce`. | [sourced: .../ApplyCardStats.cs] |
| Fall damage | None (`rounds.network` agrees). | [impression] |

### 2.4 Bullets

All in `Gun.cs`, `MoveTransform.cs`, `RayCastTrail.cs`, `RayHitReflect.cs`, `ProjectileHit.cs`, `GunAmmo.cs`, `WeaponHandler.cs` under `http://git.warmcat.org/ROUNDS/plain/GameCode/`.

| Aspect | ROUNDS | Tag |
|---|---|---|
| Spawn | At the **player's centre** (`spawnPos = player.transform.position`), rotated to the aim direction. No muzzle offset. | [sourced: Gun.cs] |
| Velocity | `velocity = rotated(localForce) + worldForce` where `localForce` (the speed, from the projectile prefab) is multiplied by the gun's `projectileSpeed` (default 1). **The shooter's velocity is not added.** | [sourced: MoveTransform.cs, Gun.cs] |
| Gravity | `velocity += gravity * down * dt`; `MoveTransform.gravity` has code default **30 world units/s^2** (= 540 of our u/s^2), multiplied by the gun's `gravity` (default 1). The prefab may override it. | [sourced: MoveTransform.cs; value Medium] |
| Drag | `drag` default 0 (cards add it). | [sourced: Gun.cs ResetStats] |
| Speed | **Unknown** (prefab). Cards give relative changes only (Fastball +250%, Quick Shot +150%, Remote -40%: https://www.magicgameworld.com/?p=126115). | not found |
| Spread | Default 0. When set: random side offset, divided by `(1 + projectileSpeed*0.5)*0.5`, plus a random speed jitter of `spread*50` percent (max 50). | [sourced: Gun.cs] |
| Fire rate | `attackSpeed` = **0.3 s** cooldown (reset value). **Semi-automatic**: one click per shot; holding the button auto-fires only if the cooldown is below 0.3 s (cards). | [sourced: Gun.cs, WeaponHandler.cs] |
| Ammo / reload | `maxAmmo = 3`, reload **1.5 s** (`GunAmmo.reloadTime` initializer; the prefab might override) times a multiplier. Reload starts automatically at 0 ammo. **Free refill**: if you do not shoot for one reload time, a partial magazine refills fully by itself. | [sourced: GunAmmo.cs, Gun.cs; Medium on 1.5 s] |
| Damage / HP | `CharacterData.health = maxHealth = 100`; the projectile base damage is a prefab value, but the code scales effects by `damage / 55f` everywhere, so **55** is the base (the task brief also says 55). Two hits kill. | HP [sourced: CharacterData.cs]; 55 [inferred] |
| Hit size | Player hit test: circle cast, radius `damage^0.85 / 400 + 0.3` = **0.375 world units (6.75 of our units)** at damage 55, plus size cards. Terrain: a **zero-width ray** from last to current position. | [sourced: RayCastTrail.cs] |
| Bounce | `RayHitReflect`: velocity = mirror reflection about the surface normal, times `speedMOnBounce` (default 1) and damage times `dmgMOnBounce` (default 1). One bounce is consumed per hit. A hit on a player subtracts 10 from `reflects`, i.e. the bullet is consumed. | [sourced: RayHitReflect.cs] |
| Screen edges | Only bullets with a bounce card get `ScreenEdgeBounce`; otherwise bullets fly on and are removed by other logic (not found). | [sourced: ScreenEdgeBounce.cs] |
| Owner immunity | `holdPlayerFor = 0.5 s`, plus the ray cast ignores the owner for 0.2 s. A blocked bullet gets its owner-immunity removed so it can hit its shooter. | [sourced: ProjectileHit.cs, RayCastTrail.cs, Block.cs] |
| Damage vs distance | No falloff by default. The Grow card adds a distance-based multiplier (`ChangeDamageMultiplierAfterDistanceTravelled`). | [sourced] |
| Knockback | On hit the victim loses 10% of its velocity (`AddForce(-velocity*0.1*mass)`) and receives `forward * force` where `force *= (damage/55)^2` and the prefab `force` is unknown. Blocking cancels it. | [sourced: ProjectileHit.cs; magnitude unknown] |
| Shooter recoil | `Gun.DoAttack` applies a recoil impulse to the **gun's own Rigidbody2D** (the gun sprite that a spring pulls back to the hand), not to `PlayerVelocity`. `bodyRecoil` exists as a field but is only copied by cards in the code I read. So the body is not pushed. | [inferred from source: Gun.cs, Holding.cs] |
| Physics boxes | Boxes are `Rigidbody2D` objects (`NetworkPhysicsObject`). Bullets push them (`force*0.5 + damage*100` along the bullet direction at the hit point) and players push them by walking into them; a fast box can damage a player. | [sourced: ProjectileHit.cs, PlayerCollision.cs, NetworkPhysicsObject.cs] |

### 2.5 Block

[sourced: Block.cs, HealthHandler.cs, ProjectileHit.cs]

- Window: `IsBlocking()` is true for **0.3 s** after activation. Cooldown `cooldown = 4 s` (counted from activation; cards add or multiply).
- While blocking: damage and force are ignored entirely (`TakeDamage`, `TakeForce` early-out). Explosions that ignore block exist only via cards.
- A bullet hitting a blocking player: velocity is multiplied by **-1** (it goes back **along its own path**, same speed, not a mirror reflection), its owner-immunity is removed so it can hit the shooter, and the blocker is immune to that bullet for 0.5 s. Gravity keeps acting, so the returning bullet sags.
- Cards can add force on block (shield jumping), healing, extra blocks.

### 2.6 Out of bounds and hazards

[sourced: OutOfBoundsHandler.cs]

- Field: x in [-35.56, 35.56], y in [-20, 20] world units (71.12 x 40, exactly 16:9; 1280/71.12 = 18.0). A warning zone covers the outer 10%.
- Leaving through **any** edge, **including the top**, is out of bounds. The check repeats every 0.1 s. Effect: damage **51 HP flat** (not a percentage) and an inward impulse of 200 times mass, i.e. +200 world units/s (3600 of our u/s) towards the centre (very hard; gravity then takes over).
- **Blocking at the edge**: no damage, velocity zeroed, impulse of 400 inward. (NamuWiki says the same: https://en.namu.wiki/w/ROUNDS.)
- Hazard defaults in code: `DamageBox` damage 25 with a 0.3 s re-hit cooldown; the `Saw` card object deals 10 damage per second within 3 world units (54 of our units). Map saw prefabs are not in the code. [sourced: DamageBox.cs, Saw.cs; prefab values may differ]

### 2.7 Scale

- Screen = 40 world units tall. A default circle of radius ~1 world unit would be 1/20 of the height. **The actual player radius is a prefab value I could not find.** [impression: characters are roughly 1/20 to 1/17 of screen height; our 30/720 = 1/24 is in the same family, slightly smaller]
- Default bullet hit radius 0.375 world units = 1/107 of the screen height; ours is 4/720 = 1/180.
- Gravity ratio: constant 20 world units/s^2 on the body = 360 of our u/s^2 (ours: 1900 rising / 2500 falling), but the ramped term adds on top, and its constant is not known.

### 2.8 What I could not establish

Bullet speed; player radius; run force, drag, jump force; `Gravity.gravityForce` and `exponent`; the exact wall-slide speed; the bullet's removal rule when it leaves the screen; any measured frame data. Do not claim parity on these.

## 3. What our game does now

Config values are from `src/config.js` (the table in `docs/DESIGN.md` section 4 is **stale**: it says 330 run speed, 700 jump, 32 box, radius 5, spawn +22; the code says 300, 660, 30, 4, 18. Fix the doc when changing numbers).

**Player** (`src/sim/player.js`, `src/sim/collision.js`)
- Body is an axis-aligned 30x30 box (centre x,y). `moveBody` moves in substeps of 8 units, x first then y, snapping to the face of the first collider overlapped. No corner logic: the box catches on corners.
- Horizontal: `moveToward(vx, dir*moveSpeed, accel*dt)`; `groundAccel 2400`, `groundFriction 3000` (no input), `airAccel 1500`, `airDrag 400` (no input). Max speed `moveSpeed 300`.
- Gravity: `gravityUp 1900`, `gravityDown 2500`, `apexGravityMul 0.75` while `|vy| < 100` and jump held, `terminalFall 950`.
- Jump: `jumpVelocity 660` (held height about 115 units, tap about 30), release while rising multiplies `vy` by `jumpCutMul 0.45`, `coyoteTime 0.10`, `jumpBuffer 0.12`. No air jumps (Cloudstep is not implemented in code).
- Wall: `wallDir` from 1-unit probes left and right, every tick, regardless of input. Slide: `if wallDir != 0 && vy > wallSlideSpeed && dir == wallDir then vy = wallSlideSpeed` (`wallSlideSpeed 120`; an instant clamp, requires input toward the wall). Wall jump: allowed within `wallCoyote 0.10` of contact: `vx = 380 away`, `vy = -0.97 * 660 = -640`, then `wallLock 0.15` ignores steering back into that wall. No regrab lockout, no gravity change while touching a wall.
- Ground probe: `firstOverlap(p, colliders, 0, 1)` while `vy >= 0`; standing on an edge by 1 unit counts as grounded.

**Bullets** (`src/sim/bullet.js`, `src/sim/combat.js`)
- Spawn at body centre + `muzzleDistance 18` along the aim; speed `bulletSpeed 900`; `vy += bulletGravity(80) * dt`; `bulletRadius 4`; `bulletLifetime 3 s`; spread random per bullet; no drag; no shooter-velocity inheritance.
- Collision: substeps of 4 units, x axis then y axis, circle versus rectangle; bounce flips the offending velocity component (perfect reflection with axis-aligned walls), no speed or damage change; `ownerImmunity 0.15 s` or until first bounce; players hit by circle-vs-box.
- Block: 0.3 s shield bubble, destroys bullets (no reversal), cooldown 4 s; cannot shoot while it is up.
- Recoil: `vx -= cos(aim)*40`, `vy -= sin(aim)*20` per shot. Knockback: `260 * damage/20` along the bullet direction (vertical x0.6), capped at 700; added to `vx, vy` (ground friction 3000 removes 260 u/s in about 0.09 s).
- Out of bounds: 30% of max HP, thrown back, top is free.
- Dummy bot (`src/practice/dummy-bot.js` lines 65-71): already compensates drop to first order: `aim = atan2(dy - 0.5*g*(dist/v)^2, dx)` using the bot's own `stats.bulletSpeed` and `bulletGravity`.

## 4. Gap table

Presets: **R** = "closer to ROUNDS" (recommended), **S** = "safer" (smaller change). Numbers are design proposals in our units.

| Aspect | ROUNDS behaviour | Ours now | Proposed change | Config values (R / S) | Risk |
|---|---|---|---|---|---|
| Wall engage | Needs input into wall, airborne, near-vertical contact, 0.15 s since last jump [inferred from source] | Probe every tick; slide needs input; no regrab lockout | Define `gripping`; add regrab lockout | `wallRegrab 0.15 / 0.10` | Low |
| Wall slide | No gravity ramp, only a weak constant gravity plus drag, glide that starts slow and speeds up; no timer [inferred; value unknown] | Hard clamp of fall speed to 120 on contact | Replace clamp with weak slide gravity and scrub; keep terminal near current value | `wallSlideAccel 900 / 600`, `wallScrub 8 / 5`, terminal about 112 / 120, `wallRiseGravityMul 0.6 / 1.0` | Medium (wall routes and tests) |
| Wall jump vector | Mostly vertical: kick = 0.4, up = 0.8 of the jump impulse (ratio 1:2); refills jump [sourced] | vx 380, vy 640 (ratio 0.6) | Smaller kick, a little less height | `wallJumpVx 220 / 300`, `wallJumpVyMul 0.92 / 0.97` | Medium (corridor jumps, test asserts) |
| Wall steering lock | None (only the 0.15 s regrab lockout) [inferred] | 0.15 s ignore steering into wall | Remove in R | `wallLock 0 / 0.15` | Low |
| Jump charge | One stored charge, not tied to ground; kept after walking off [sourced] | 0.10 s coyote | Keep one air charge after leaving ground | `ledgeJumpCharge true / false`, `coyoteTime 0.10 / 0.20` | Medium (balance, recovery) |
| Jump height control | Hold adds force for 0.2 s; no cut [inferred] | Cut x0.45 on release | **Keep ours** (owner likes the jump) | none | None |
| Gravity shape | Ramps with air time; constant term 20 u/s^2 [sourced] | Constant 1900 / 2500 with apex hang | **Keep ours**; only change gravity while gripping a wall | none | None |
| Air control | Force and drag both x0.3 [sourced] | accel 1500, drag 400 (about 0.6x and 0.13x of ground) | Slightly lower air accel, more air drag | `airAccel 1000 / 1300`, `airDrag 600 / 500` | Low-Medium |
| Momentum from hits and kicks | Exponential drag, so shoves and kicks glide visibly [inferred] | Ground friction 3000 erases a shove in 0.09 s | `carry` timer lowers ground friction after impulses; overspeed decays slowly | `carryTime 0.30 / 0.20`, `carryFriction 800 / 1400`, `overspeedGround 1100 / 1800`, `overspeedAir 350 / 450` | Low-Medium |
| Corners | Round collider pushed radially: rolls over and off corners [inferred] | Box catches on corners, stands on a 1-unit edge | Ledge pop and head-bump nudge; keep the box | `ledgeStep 10 / 6`, `cornerNudge 8 / 5` | Medium (collision code) |
| Bullet drop | 30 world u/s^2 default = 540 u/s^2 [sourced, Medium] | 80 u/s^2, speed 900: 32 units drop at 800 | Visible arcs (see section 6) | `bulletSpeed 1500 / 1100`, `bulletGravity 500 / 200` | Medium (cards, tests) |
| Bullet speed | Unknown | 900 | see above | | |
| Shooter inheritance | None [sourced] | None | Keep | | None |
| Spawn point | Player centre [sourced] | centre + 18 | Keep | | None |
| Recoil | Gun sprite only [inferred] | Pushes body 40 u/s | Remove base recoil | `recoil 0 / 20` | Low |
| Bounce | Perfect mirror, speed x1, damage x1, consumed on player hit [sourced] | Same | Keep | | None |
| Terrain hit shape | Ray (zero width) for terrain, 0.375 world radius for players [sourced] | Circle r=4 for both | Optional: split radii | `bulletRadiusTerrain 1.5`, `bulletRadius 6` | Low |
| Block | Reverses the bullet, 0.3 s, cd 4 s [sourced] | Destroys the bullet, 0.3 s, cd 4 s | Optional, owner decision | `blockReverse false` | Medium (clashes with Return Policy) |
| Out of bounds | 51 HP flat, top counts, block saves you [sourced] | 15% (was 30%), top free | Optional: block cancels OOB damage | `oob.blockSaves true` | Low |
| Reload | Free refill after idle; 3 ammo, 0.3 s, 1.5 s [sourced] | 5 ammo, 1/3 s, 2.0 s, reload only when empty | Out of physics scope. Owner decision | | |
| Time to kill | 2 hits (55 on 100 HP) [inferred] | 5 hits (20 on 100 HP) | Out of scope; mention only | | |

## 5. Change list (priority order, implementable)

Rules for every item: new state goes on the player object in `createPlayer` and is reset in `resetPlayerForRound`; no `Math.random`; no DOM; timers are decremented in `stepPlayer`; every new tunable goes into `CONFIG.move` or `CONFIG.combat`; preset values are selected by a small `applyPreset(name)` in `config.js` called once at startup, before any sim is created (so host and client agree). Bump `CONFIG.net.gameVersion` to 2 when presets change gameplay.

### P1. Bullet arc (largest visible difference, lowest risk)

Config (preset R / S):
```
base.bulletSpeed   900 -> 1500 / 1100
base.bulletGravity  80 ->  500 /  200
base.bulletRadius    4 ->    6 /    5      (ROUNDS player hit radius is 6.75 u)
statLimits.bulletSpeed   [450,2250] -> [750,3750] / [550,2750]   (keeps 0.5x..2.5x)
statLimits.bulletGravity [0,640]    -> [0,4000]  / [0,1600]      (keeps 0..8x)
```
Do **not** change `bulletLifetime` globally (3 s still leaves the field long before). Drop for `y = g*x^2 / (2 v^2)` (aim flat, ignoring the cosine; error under 1% here):

| Range | Current (900, 80) | **R (1500, 500)** | S (1100, 200) |
|---|---|---|---|
| 300 u | 4.4 | **10.0** | 7.4 |
| 600 u | 17.8 | **40.0** | 29.8 |
| 900 u | 40.0 | **90.0** | 66.9 |
| Range at which drop = 1 body height (30 u) | 779 | **520** | 603 |
| Elevation to hit a same-height target 800 u away (`sin(2a) = g*d / v^2`) | 2.27 deg (aim 31.7 u above) | **5.12 deg (aim 71.7 u above, apex 36 u above the line, flight 0.535 s)** | 3.80 deg (aim 53.1 u above, flight 0.729 s) |

Reading: at R, a shot across the island (300 u) is almost straight (10 u, a third of a body), a cross-screen shot (800 u) needs about 2.4 body heights of lead and visibly curves. At 1500 u/s a bullet crosses the 1280 field in 0.85 s (now 1.4 s).

Cards that need touching (they are all multiplicative on speed, or set lifetime):
- **Pepperpot**: range is `speed * lifetime`; now 900*0.6 = 540. At R the same lifetime gives 900 u. Change `bulletLifetime: { add: -2.4 }` to **`-2.64`** (0.36 s, range 540 at R) or `-2.55` for S (0.45 s * 1100 = 495). Check the pellet fan still reaches a target 300 u away.
- **Powder Keg** (`bulletSpeed mul 0.65`): at R it becomes 975 u/s with g=500, a mortar: drop at 600 u is 95, elevation 12.4 deg at 800 u, quite punishing. Change the multiplier to **0.8** at R (1200 u/s: drop at 600 is 62, elevation 8.1 deg at 800), keep 0.65 at S (715 u/s, drop at 600 is 70).
- **Pinball** (`bounces +4`, `lifetime +1`): bullets under 500 u/s^2 curve visibly between bounces; a ball that hits the floor keeps its speed (perfect reflection), so it will bounce like a ball. Keep. Verify that 4 bounces still happen inside the field.
- Prism Shot, Return Policy (`speedMul 1.5`: it multiplies the *current* speed, so a 1500 bullet becomes 2250, still under the new cap 3750): no change.

Dummy bot: its existing first-order compensation is accurate to about 0.1 degree at R up to 1100 u (800 u: it aims 5.07 deg, exact is 5.12). With Powder Keg 0.65 the error is 0.55 deg (about 8 units at 800 u). **Replace with the exact solution** for safety (pure function, deterministic):
```
// dx > 0 after mirroring (if target is to the left: dx = -dx, mirror result at the end)
// dy: target.y - muzzle.y (y down)
A = g * dx*dx / (2*v*v)
disc = dx*dx - 4*A*(A - dy)
if (disc < 0) aim at 45 deg upward (out of range)
else u = (-dx + Math.sqrt(disc)) / (2*A)        // tan of the (negative = upward) launch angle, flat root
angle = Math.atan(u);  if (target was left) angle = Math.PI - angle
```
For a moving target add one or two iterations: `t = dx / (v*cos(angle))`, re-aim at `target + targetVelocity*t`. The bot sees the player 0.28 s late with 7 degree error, so keep that handicap; do not make the bot perfect.

Tests: none assert bullet gravity directly. Timing-sensitive ones: `Powder Keg` tests ("wall is 400 away", 40 ticks, 6 ticks at 28 units), `plain bullets chip destructible blocks` (25 ticks), `self damage` (200 ticks). A faster bullet only makes them pass sooner; Powder Keg at 0.8 x 1500 = 1200 is faster than today's 585. Re-run all. Add: `drop at 600 u is 40 +-2 u`, `aim solver hits a same-height target at 800 u within 6 u`.

### P2. Wall grip and slide model

New state: `p.wallRegrab` (timer, seconds), derived `gripping` (boolean, may stay local). New config in `CONFIG.move`: `wallRegrab`, `wallSlideAccel`, `wallScrub`, `wallRiseGravityMul`, `wallSlideMax` (safety clamp, 160 / 140).

Definition (evaluated after the wall probe, using the previous tick's `wallDir`, so it is consistent every tick):
```
gripping = !p.grounded && p.wallDir !== 0 && dir === p.wallDir && p.wallRegrab <= 0
```
Set `p.wallRegrab = M.wallRegrab` whenever any jump fires (ground, coyote or wall). Decrement in the timers block.

In the gravity block, replace the current wall-slide clamp with:
```
if (gripping) {
  if (p.vy < 0) g *= M.wallRiseGravityMul;                 // rising along the wall: lighter, so you stick and drift up a bit
  else {                                                   // falling or hanging: glide
    p.vy += M.wallSlideAccel * dt;                          // weak gravity instead of gravityDown
    p.vy -= p.vy * Math.min(1, M.wallScrub * dt);           // friction that scrubs fall speed on contact
    p.vy = Math.min(p.vy, M.wallSlideMax);
    skipNormalGravity = true;
  }
}
```
Resulting slide speed (terminal = accel / scrub): R 900/8 = 112 u/s, reached as `112*(1 - e^(-8t))` from rest (63% in 0.125 s); entering at 800 u/s it decays to under 150 in about 0.22 s (about 85 units of fall). S: 600/5 = 120 u/s, entering at 800 decays to under 150 in about 0.35 s. Both keep today's terminal speed (120) so wall routes and the existing slide test (`50 < vy <= 121`) keep passing; the difference is the *shape* (smooth glide instead of an instant clamp) and that rising along a wall is lighter.

"Cling" (hover) is not in ROUNDS as far as the code shows; do not add a freeze timer unless the owner asks. If asked: clamp `vy` to 30 for the first 0.12 s of a grip (`wallCatchTime`), once per grip.

Netcode: pure arithmetic on the per-player state; `wallRegrab` must be part of any future prediction/reconciliation state.
Tests: the wall-slide test stays valid; add: slide speed after 0.5 s of grip is within 105..125 (R) and `vy` never exceeds 160 on entry from 900.

### P3. Wall jump vector and regrab (together with P2)

```
wallJumpVx     380 -> 220 / 300
wallJumpVyMul  0.97 -> 0.92 / 0.97
wallLock       0.15 -> 0 / 0.15      (R removes the steering lock: ROUNDS has none; the 0.15 s regrab lockout replaces it)
wallRegrab     new: 0.15 / 0.10
```
Behaviour at R: kick 220 away, 607 up (0.92*660). Holding into the wall, `airAccel 1000` cancels the kick in 0.22 s, the player is back on the wall after about 0.25 s and, once `wallRegrab` has expired (0.15 s), can wall-jump again: that is the ROUNDS "climb one wall" rhythm. Estimated climb at R: about 70 to 80 units per hop, about 3 hops per second (my arithmetic from the constants, verify with a bot run). Between two walls (corridor) the kick is smaller, so corridors wider than about 120 units need a held away-from-wall input; check `ruined-city` pillars.

Tests to change: `wall-jump` test asserts `vx < -300` and `vy < -550`. New asserts: R `vx` in [-240,-200], `vy` in [-620,-590]; keep a chain test (12 ticks rising).
Reachability (`tests/reach.mjs` ignores wall jumps; the map header says some spots need a "short wall-jump"): add a bot-sim test that, from the island spawn, holding right and spamming jump reaches the pillar top (x 330..370, y 416) and the top of the high perch routes within 4 s.

### P4. Momentum carry (shoves, kicks, jump carry)

Goal: keep run, stop and turn exactly as now (the owner likes it), but let impulses glide.

New state `p.carry` (seconds). New config: `carryTime 0.30 / 0.20`, `carryFriction 800 / 1400` (ground, no input), `overspeedGround 1100 / 1800`, `overspeedAir 350 / 450`.

1. In `combat.js` wherever `p.vx += ...` from an impulse happens (`damagePlayer` bullet knockback, `explode`, `applyImpulse`), also set `p.carry = CONFIG.move.carryTime`. Do the same on a wall jump and on any hazard shove (look for the shove code in `hazards.js`).
2. In the horizontal block of `stepPlayer`:
```
if (p.carry > 0) p.carry -= dt;
const over = Math.abs(p.vx) > st.moveSpeed && (dir === 0 || Math.sign(p.vx) === dir);
if (over) accel = p.grounded ? M.overspeedGround : M.overspeedAir;           // target = +-moveSpeed
else if (p.grounded && dir === 0 && p.carry > 0) accel = M.carryFriction;    // gliding after a shove
// otherwise unchanged
```
Effect at R: a 260 u/s hit from rest on the ground glides 260^2 / (2*800) = 42 units in 0.33 s (now 14 units in 0.09 s); the same hit while running keeps the run speed rule; a 380 wall kick above 300 decays at 1100 on the ground, 350 in the air. Pressing the opposite direction brakes at the normal rate (responsiveness kept).

Optional (R only): ground jump momentum, `if (jumping from ground) p.vx *= 1 + M.jumpCarry` with `jumpCarry 0.08`. The ROUNDS term exists but its size is unknown; at 0.08 the full-speed jump range grows from about 230 to about 245 units (only makes maps easier, never harder).

Risks: knockback becomes more visible, which is intended; combined with OOB it can push players off edges more often: re-check `knockback` and `caps.impulse 700`. Deterministic, serialisable, one float.

### P5. Corner handling (keep the box, add forgiveness)

Do **not** switch the player to a circle collider now. It would touch `moveBody`, `depenetrate`, wall/ground probes, bullet-vs-body, shield, explosions, moving platforms and the `size` stat, for a gain that two small rules reproduce. (If the owner later insists: circle versus rectangle is cheap (`circleHitsRect` exists), but all probes become contact-normal based and every test must be revisited.)

Add to `moveBody` (pure, deterministic):
- **Ledge pop** (rolling over a corner): on an x-hit while the body is moving horizontally toward a collider, if the body's bottom is at most `ledgeStep` units below the collider's top and the box shifted up by that amount and forward does not overlap anything, then set `b.y = c.y - b.h/2` (stand on top), keep `vx`, report `hitY = 0`. `ledgeStep 10 / 6`. Effect: jumping up beside a platform and clipping its top corner now pops you onto it, like a round body rolling over; walking into a 10-unit step climbs it.
- **Head-bump nudge** (circle sliding off the underside corner): on a y-hit while moving up (`dy < 0`), if the horizontal overlap with the collider is at most `cornerNudge` units on one side, shift the body sideways by that overlap and continue upward without zeroing `vy`. `cornerNudge 8 / 5`.
- **Edge slip** (optional, off by default): grounded only if the support overlap in x is at least 4 units, else apply a sideways nudge of 120 u/s away from the platform. ROUNDS decides "ground" by leg rays, so I cannot say it slips more than we do; skip unless the owner asks for rolling off edges.

Risks: the ledge pop can lift players onto platform tops from underneath-adjacent positions and changes reachability (only to more permissive). Cap with `ledgeStep` small and test crates (32x32) and pillars. Add collision unit tests: corner clip at 6 u pops up; at 12 u does not.

### P6. One jump charge (ledge jump)

State `p.jumpCharge` (0 or 1). Refill: grounded, or touching a wall when `wallRegrab <= 0`. Spend: ground jump. Wall jump: refills then spends (as ROUNDS: you end at 0 and refill again when you touch a wall or the ground). Allow a jump when `grounded || coyote > 0 || jumpCharge > 0 || wallCoyote > 0`. Config `ledgeJumpCharge: true / false`; when false keep `coyoteTime` and raise it to 0.20 (S).

Effect: walking or being knocked off a platform without jumping leaves you one air jump (recovery, ROUNDS fandom: "used either on the ground or in the air"). Keep `jumpBuffer 0.12` (ROUNDS has none; it is a harmless comfort).
Risk: balance (recovery is easier; OOB pit damage is a main source of damage), and reachability: more permissive only. Recommend R, but it is a design call for the owner.

### P7. Air control

`airAccel 1500 -> 1000 / 1300`, `airDrag 400 -> 600 / 500`. At R: reversing from +300 to -300 in the air takes 0.6 s (now 0.4 s); drifting to a stop takes 0.5 s (now 0.75 s, i.e. you stop *sooner* than today and steer *slower*; closer to the 0.3 factor on both in ROUNDS). Jump distance at full speed is unchanged (no input needed). The owner called basic movement nice; if any doubt, ship S.

### P8. Recoil

`base.recoil 40 -> 0 / 20`. Keep the stat and its limits for cards. No current card changes recoil (grep `src/cards.js`); the HUD or card text must not mention base recoil.

### P9. Optional design calls (owner decides)

1. **Block reverses the bullet** instead of destroying it (`v *= -1`, owner-immunity removed): closest to ROUNDS but overlaps Return Policy (which re-aims at 1.5x speed and 1.5x damage). If adopted, make Return Policy "re-aim plus speed and damage".
2. **Out of bounds**: top counts as out of bounds; blocking while out negates the damage and bounces (ROUNDS behaviour). Today up is free.
3. **Split bullet radii**: terrain ray 1.5 u, player hit radius 6 u (ROUNDS: ray vs 6.75 u). Bounces near corners become cleaner.
4. **Fire/reload/TTK** (3 ammo, 0.3 s semi-auto, 1.5 s reload, free refill after idle, 2 hits to kill) is far from ours (5 ammo, 5 hits). Not physics; mention only. Do not change without a card re-balance.
5. **Pushable crates** (ROUNDS boxes are rigid bodies that bullets and bodies move): large change in the sim; skip.

## 6. Cross-cutting effects

**Netcode / determinism.** All items are arithmetic on per-player state (timers `wallRegrab`, `carry`, `jumpCharge`) or config constants; no RNG, no wall-clock. They keep `stepPlayer` a pure function of (state, input, colliders, dt), so client prediction (`CONFIG.net.predictOwnMovement` is false today) can reuse it. When prediction is added, the reconciliation snapshot must carry the extra timers and `wallDir/wallSide/wallCoyote/coyote/jumpBuf/jumping` (today `src/net/snapshot.js` carries only `x,y,vx,vy,grounded` for rendering). Bullet changes do not affect prediction (bullets are host-authoritative, 30 Hz snapshots): faster bullets mean fewer snapshots per bullet (1500 u/s is 50 units per 33 ms), so client interpolation will look chunkier; if so, send bullet spawn events plus ticks and extrapolate. Bump `gameVersion`.

**Dummy bot.** Fine as is at S, accurate to 0.1 degree at R except for slow-shot cards; replace with the exact solver in P1. It must also (a) use `stats.bulletGravity`/`stats.bulletSpeed` (already does), (b) treat `dx < 0` by mirroring, (c) keep line-of-sight tests as straight lines is wrong for arcs above cover: sample the parabola (`lineBlocked` over the arc, 12 samples) instead of the chord, otherwise it may fire into a platform or refuse to fire over one. Its edge-avoidance and jump heuristics (`jumpReach 230`) do not depend on the new wall model; if P6 is on, it can jump late, optionally teach it to use it for recovery.

**Existing cards.** Powder Keg: change multiplier (P1). Pepperpot: change lifetime (P1). Pinball, Prism Shot, Return Policy: verify only. Any card that sets `bulletGravity` or `bulletSpeed` in the future should respect the new limits. Cloudstep (air jumps) is not implemented in code; with P6 it extends naturally (`jumpCharge` becomes a count).

**Map reachability.** Run `tests/reach.mjs` and the `real map` test; the jump height is unchanged (660, cut 0.45) so single-jump routes are unaffected. Wall-jump routes (pillar, "short wall-jump" spots in `maps/ruined-city.js`) change with P3: add the bot-sim climb test. P5 and P6 make everything more reachable, never less. P4 and P7 do not change takeoff speed or jump distance.

**Existing tests that will need edits.** `sim.test.mjs`: `wall-jump` (thresholds), possibly `wall slide` (still valid), `horizontal run speed` (keep: speeds at or below `moveSpeed` ignore the overspeed rule), anything with `recoil`, and the card tests that assume 540 u pepper range or 585 u/s Powder Keg. `reach.mjs` unchanged. `bot-sim.mjs`/`soak.mjs`: rerun for stuck-state regressions (ledge pop, wall glide).

**Docs.** Update `docs/DESIGN.md` section 4 (it already disagrees with `config.js`) and `docs/CARDS.md` card text (Powder Keg -20% instead of -35% speed at R; Pepperpot).

## 7. Presets in one table

| Key | Now | **R (recommended)** | S |
|---|---|---|---|
| `base.bulletSpeed` | 900 | **1500** | 1100 |
| `base.bulletGravity` | 80 | **500** | 200 |
| `base.bulletRadius` | 4 | **6** | 5 |
| `base.recoil` | 40 | **0** | 20 |
| `move.wallSlideSpeed` (terminal, kept) | 120 | **112 via accel/scrub** | 120 |
| `move.wallSlideAccel` / `wallScrub` | n/a | **900 / 8** | 600 / 5 |
| `move.wallRiseGravityMul` | n/a | **0.6** | 1.0 |
| `move.wallJumpVx` | 380 | **220** | 300 |
| `move.wallJumpVyMul` | 0.97 | **0.92** | 0.97 |
| `move.wallLock` | 0.15 | **0** | 0.15 |
| `move.wallRegrab` | n/a | **0.15** | 0.10 |
| `move.airAccel` / `airDrag` | 1500 / 400 | **1000 / 600** | 1300 / 500 |
| `move.carryTime` / `carryFriction` | n/a | **0.30 / 800** | 0.20 / 1400 |
| `move.overspeedGround` / `overspeedAir` | n/a | **1100 / 350** | 1800 / 450 |
| `move.ledgeStep` / `cornerNudge` | n/a | **10 / 8** | 6 / 5 |
| `move.ledgeJumpCharge` / `coyoteTime` | false / 0.10 | **true / 0.10** | false / 0.20 |
| Powder Keg speed multiplier | 0.65 | **0.80** | 0.65 |
| Pepperpot lifetime add | -2.4 | **-2.64** | -2.55 |

Recommendation: implement **P1 (bullets) first** since it is the simplest and most visible, then **P2 + P3 (walls)**, then **P4 (momentum)**, **P5 (corners)**, **P6/P7/P8**. Ship R for P1 to P4, and treat P5 to P7 as separately switchable (each behind its config value, `0` = off) so the owner can A/B them live in the debug panel.

## 8. Tuning and acceptance checklist

1. Debug overlay: draw the predicted bullet parabola from the muzzle for the current aim (cheap: sample 30 points of the P1 formula) so the arc can be judged without playing.
2. Measure and log from the sim, per preset: held jump height (still 105-140), run speed 300, wall slide terminal 105-125, wall-jump kick/height, climb rate per second on a single wall, shove glide distance, bullet drop at 300/600/900.
3. A/B session: R versus S versus "now" at identical maps; the owner picks per item.
4. Re-run `node tests/*.test.mjs`, `tests/bot-sim.mjs`, `tests/soak.mjs`, `tests/reach.mjs`.
5. Open items I could not answer from sources: true ROUNDS bullet speed, slide speed, player radius. If the owner has the game, the cheapest way to pin them down is a screen recording at 60 fps: count frames for a default bullet to cross a known distance (for example one platform width), and time a wall slide over a known pillar height; those two measurements replace the guesses in P1 and P2.
