// ============================================================================
//  config.js  -  EVERY tunable number of the game lives here.
//  Units: the simulation uses "logical units" on a 1280 x 720 field.
//  y grows DOWNWARDS. Times are in seconds, speeds in units/second,
//  accelerations in units/second^2.
// ============================================================================

export const CONFIG = {
  // ---- fixed-step simulation ------------------------------------------------
  tickRate: 60,            // simulation steps per second (the online host will use the same)
  maxCatchUpTicks: 5,      // never run more than this many ticks in one rendered frame (spiral-of-death guard)

  // ---- field & screen ---------------------------------------------------------
  field: {
    w: 1280,               // logical field width
    h: 720,                // logical field height
  },
  render: {
    canvasW: 640,          // pixel-art canvas width (scaled by an integer factor to fit the window)
    canvasH: 360,          // pixel-art canvas height. 1 canvas pixel = 2 logical units
  },

  // ---- player body ---------------------------------------------------------------
  // Scale choice: body 30 x 30 units on a 720-unit-high field = 4.2% of the screen height
  // (15 x 15 pixels on the 360 px canvas). ROUNDS characters are roughly 1/20 .. 1/16 of the
  // screen height, so this keeps the "small hero, big world" feel the owner asked for.
  player: {
    width: 30,             // hitbox width (the card stat `size` multiplies this)
    height: 30,            // hitbox height
    names: ['EMBER', 'TIDE'], // HUD names for player 0 (human, rust) and player 1 (dummy, teal)
    muzzleDistance: 18,    // bullets spawn this far from the body centre along the aim direction
  },

  // ---- base stats (cards add to / multiply these, see cardfx.js) ------------------------------
  base: {
    maxHp: 100,            // hit points
    damage: 20,            // damage per bullet (5 hits kill at 100 HP)
    fireRate: 3,           // shots per second
    magazine: 5,           // bullets before an automatic reload
    reloadTime: 2.0,       // seconds to reload a full magazine (starts automatically when empty)
    bulletSpeed: 1500,     // units/second (a shot crosses the 1280-unit field in 0.85 s)
    bulletRadius: 6,       // bullet collision radius (ROUNDS player-hit radius is about 6.75 units)
    bulletGravity: 500,    // downward acceleration of bullets: a visible arc. Drop = g*x^2/(2 v^2): 10 units at 300, 40 at 600, 90 at 900 range
    bulletsPerShot: 1,     // bullets fired per trigger pull
    spread: 0,             // random aim error in radians (+/-), re-rolled per bullet
    fanAngle: 0,           // multi-pellet shots fan out evenly across +/- this many radians (Pepperpot)
    bulletLifetime: 3,     // seconds before a bullet disappears (range = speed * lifetime)
    bounces: 0,            // how many times a bullet may bounce off terrain before it is consumed
    knockback: 260,        // impulse a hit gives the victim at 20 damage (scaled by damage / 20, by the victim's knockbackTaken; capped by caps.impulse)
    knockbackTaken: 1,     // multiplier on the knockback you receive from hits and explosions
    recoil: 0,             // push opposite to the aim direction when shooting (ROUNDS only kicks the gun sprite; cards may add recoil)
    moveSpeed: 300,        // max run speed
    jumpVelocity: 660,     // initial upward speed of a jump (about 115 units / 4 body heights of height)
    size: 1,               // body size multiplier
    blockCooldown: 4,      // seconds from block activation until the next block can be used
    blockWindow: 0.3,      // seconds the shield stays up
    airJumps: 0,           // extra jumps in mid air (cards: Cloudstep); refilled on the ground and on a wall
    wallGlide: 1,          // multiplier on the wall-slide gravity while gripping (0 = you hang still: Limpet)
    hazardTaken: 1,        // multiplier on the damage hazards (spikes, saws, grates) do to you (0 = immune: Salamander)
    blockDamage: 1,        // multiplier on the damage your bullets do to crates, barrels and slabs (Demo Permit)
  },
  // Hard floors/caps clamped AFTER all card modifiers (CARDS.md "Global balance rules"). [min, max], absolute values.
  statLimits: {
    maxHp: [60, 250],              // 60 .. 250 HP
    damage: [8, 40],               // launch damage 0.4x .. 2x of 20
    fireRate: [1, 8],              // shots per second
    magazine: [1, 12],
    reloadTime: [0.8, 4.0],
    bulletSpeed: [750, 3750],      // 0.5x .. 2.5x of 1500
    bulletRadius: [3, 18],         // 0.5x .. 3x of 6
    bulletGravity: [0, 4000],      // 0 .. 8x of 500
    bulletLifetime: [0.3, 5],
    bulletsPerShot: [1, 6],
    spread: [0, 0.349],            // 0 .. 20 degrees
    fanAngle: [0, 0.6],
    bounces: [0, 6],
    knockback: [65, 780],          // 0.25x .. 3x of 260
    knockbackTaken: [0.2, 2.5],
    recoil: [0, 600],
    moveSpeed: [180, 600],         // -40% .. +100% of 300
    jumpVelocity: [462, 924],      // -30% .. +40% of 660
    size: [0.6, 1.6],
    blockCooldown: [1.0, 10],
    blockWindow: [0.15, 0.8],
    airJumps: [0, 3],
    wallGlide: [0, 1],
    hazardTaken: [0, 1],
    blockDamage: [1, 4],
  },
  // Global caps that are not plain stat limits (CARDS.md).
  caps: {
    hitDamage: 40,           // no single hit (bullet, explosion, reflected bullet) from a player does more than this
    shotDamage: 60,          // all damage ONE trigger pull (pellets, children, explosions, reflections) can do to ONE target
    burst: 130,              // derived limit: fireRate * damage * bulletsPerShot <= this (lower damage first, then fire rate)
    magazineBudget: 240,     // derived limit: magazine * bulletsPerShot * damage <= this (lower magazine)
    healPerRound: 70,        // healing per round
    liveBullets: 60,         // live bullets per player; extra children / shards simply are not spawned
    impulse: 700,            // a single hit or explosion shove is never faster than this
    reflectPerBlock: 5,      // Return Policy: bullets reflected per block
  },

  // ---- movement feel -------------------------------------------------------------------------
  move: {
    groundAccel: 2400,     // accelerating towards the target speed on the ground (full speed in ~0.13 s)
    groundFriction: 3000,  // braking with no input on the ground (stops in ~0.1 s, no ice-skating)
    airAccel: 1000,        // steering in the air (ROUNDS: air control is weaker; you carry momentum)
    airDrag: 600,          // slowing down in the air when there is no input
    gravityUp: 1900,       // gravity while rising
    gravityDown: 2500,     // gravity while falling (faster fall reads clearer)
    apexGravityMul: 0.75,  // gravity multiplier near the top of a jump (slight hang time)
    apexSpeed: 100,        // |vy| below this counts as "near the apex"
    terminalFall: 950,     // max fall speed
    jumpCutMul: 0.45,      // releasing jump while rising multiplies vy by this (short hop)
    coyoteTime: 0.10,      // can still jump this long after leaving a ledge
    jumpBuffer: 0.12,      // a jump pressed this early before landing still fires
    wallSlideSpeed: 112,   // (documentation only) the terminal glide speed of the wall grip = wallSlideAccel / wallScrub
    wallSlideAccel: 900,   // weak gravity while GRIPPING a wall and falling (instead of gravityDown)
    wallScrub: 8,          // wall friction: fraction of fall speed lost per second while gripping (terminal speed = accel / scrub = 112 u/s)
    wallSlideMax: 160,     // safety clamp: you never fall faster than this while gripping, even when you arrive at full speed
    wallRiseGravityMul: 0.6, // gravity multiplier while gripping and still rising (you stick and drift up a little)
    wallRegrab: 0.15,      // after ANY jump the wall cannot be gripped / refill the jump for this long (the climb rhythm)
    wallJumpVx: 220,       // horizontal kick away from the wall (ROUNDS ratio: 1 sideways : 2 up)
    wallJumpVyMul: 0.92,   // vertical speed of a wall jump as a fraction of jumpVelocity (607 u/s)
    wallCoyote: 0.10,      // can still wall-jump this long after touching the wall
    airJumpMul: 0.85,      // an air jump launches at this fraction of the jump velocity
    maxSpeed: 1100,        // hard speed limit (stacked explosions on a light build gave 1700-2400 u/s: a flight across the whole map). Normal play never reaches it: terminal fall 950, hit knockback capped at 700 per impulse
    carryTime: 0.30,       // after a shove / wall kick, ground friction is weak for this long so the push glides
    carryFriction: 800,    // ground braking (no input) while carrying a shove (normal groundFriction is 3000)
    overspeedGround: 1100, // how fast speed ABOVE moveSpeed decays on the ground (kicks and shoves above run speed)
    overspeedAir: 350,     // ...and in the air (momentum carries through jumps)
    ledgeStep: 10,         // corner forgiveness: running / jumping into a step this low pops the body up onto it (box collider kept)
    cornerNudge: 8,        // corner forgiveness: bumping your head on a ceiling corner by less than this slides you round it
    ledgeJumpCharge: true, // one stored jump charge: walking or being knocked off a ledge keeps your jump until you use it (ROUNDS)
    maxSubstep: 8,         // collision substep length in units (no tunnelling through thin slabs)
    landEventSpeed: 260,   // landing harder than this emits a 'land' event (dust effect)
  },

  // ---- combat -----------------------------------------------------------------------------------
  combat: {
    bulletSubstep: 4,          // bullet collision substep length in units
    ownerImmunity: 0.15,       // a bullet cannot hit its own shooter for this long OR until its first bounce
    bulletKillMargin: 60,      // bullets further than this outside the 1280x720 field are removed (sides and bottom)
    bulletKillMarginTop: 900,  // ...and above the top (lobbed shells may fly high and come back; the top of the screen is free)
    bulletBlockDamageMul: 1.0, // bullet damage multiplier against destructible blocks
    shieldPadding: 10,         // shield bubble radius = half-diagonal of the body + this
    explosionBlockMul: 2.5,    // explosion damage multiplier against destructible blocks
    explosionEdgeFalloff: 0.4, // damage fraction at the very edge of an explosion (1.0 at the centre)
    explosionKnockback: 400,   // shove from an explosion at 20 damage and full strength (scaled by damage / 20 and falloff)
    explosionFullRadius: 32,   // inside this distance an explosion does 100% damage; it falls linearly to explosionEdgeFalloff at the radius
  },

  // ---- falling out of the open arena ------------------------------------------------------------------
  oob: {
    margin: 24,            // body centre this far outside the left/right/bottom field edge counts as "out"
    damagePct: 0.30,       // fraction of max HP lost when leaving by the bottom or the sides
    invulnerable: 1.5,     // seconds without further out-of-bounds damage after being thrown back
    bottomLaunchVy: 1050,  // upward launch speed when coming back from the pit
    bottomLaunchMaxVx: 450,// horizontal launch towards the centre, clamped to this
    bottomLaunchVxPerUnit: 1.3, // ...scaled by the distance from the screen centre (units/s per unit)
    ghostTime: 0.6,        // seconds the returning player passes through terrain (never bonks a platform from below)
    sideLaunchVx: 540,     // horizontal launch speed when coming back from a side
    sideLaunchVy: 380,     // upward launch speed when coming back from a side
    creditTicks: 180,      // a fall within this many ticks (3 s) of a hit counts as the attacker's ring-out
    reentryInset: 8,       // players are put this far inside the field edge before launching
  },

  // ---- round flow (Phase 1: only "someone dies -> pause -> restart") -------------------------------
  round: {
    endDelay: 1.6,         // seconds between the deciding death and the restart
    timeLimit: 45,         // seconds of normal play; then SUDDEN DEATH starts
    suddenDeathDps: 2,     // HP lost per second by BOTH players during sudden death at 100 max HP; scaled by max HP (2% of max HP per second). The lower HP percentage dies first; same tick = draw
    suddenDeathBanner: 2.0,// seconds the big "SUDDEN DEATH" banner is shown
  },

  // ---- match loop: quiz + card pick (src/sim/match.js) ---------------------------------------------------
  match: {
    winTarget: 5,            // round wins needed to take the match
    offerSize: 5,            // cards offered to the round loser
    wrongRemoves: 3,         // a wrong quiz answer removes this many of the offered cards (the loser chooses from the rest)
    rarityWeights: { common: 55, uncommon: 35, rare: 10 },       // offer weights per card slot
    catchUpWeights: { common: 45, uncommon: 35, rare: 20 },      // used when the picker is catchUpRounds or more rounds behind
    catchUpRounds: 2,
    dummyRightChance: 0.5,   // the dummy answers the quiz correctly this often
    dummyBeat: 11,           // seconds the dummy-turn replay (question, answer + why, card taken) can run before it continues by itself (click/Enter steps through it)
  },

  // ---- map hazards (placed by the map file, see maps/ruined-city.js) ---------------------------------------
  // Hazard damage is ENVIRONMENT damage: it can kill, and the round then goes to the other player.
  hazards: {
    rehit: 0.6,            // seconds a player is safe from hazards after being hit by one (no instant melting)
    spikes:  { damage: 15, shove: 520 },  // rusted rebar spikes (a zone): damage + shove along the spike direction
    grate:   { damage: 10, shove: 430 },  // burning ember grate (a solid platform that hurts to touch)
    saw:     { damage: 20, shove: 640 },  // rusted saw blade moving along a path; shoves away from its centre
    barrel:  { hp: 30, explosionRadius: 80, explosionDamage: 40 }, // explosive drum: blows up when destroyed (bullets, explosions, other barrels)
    sawSpin: 0.45,         // render only: saw rotation in radians per tick
  },

  // ---- practice dummy behaviour ----------------------------------------------------------------------------
  dummy: {
    reactionTime: 0.28,    // it sees the player's position this many seconds late
    aimErrorDeg: 7,        // aim error (+/- degrees), re-rolled at the start of every burst
    burstMin: 2,           // shots per burst
    burstMax: 4,
    burstPauseMin: 0.5,    // pause between bursts (s)
    burstPauseMax: 1.5,
    maxRange: 1100,        // does not shoot further away than this
    needLineOfSight: true, // only shoots when no terrain is between it and the player
    blockChance: 0.30,     // chance to block when it notices a bullet coming at it
    blockTriggerDist: 150, // a bullet this close and heading at it triggers a block check
    edgeAvoidChance: 0.92, // chance per edge it respects (stops instead of walking off into the pit)
    wanderMin: 2.0,        // seconds before it picks a new platform to walk to
    wanderMax: 5.0,
    randomJumpPerSec: 0.1, // chance per second of a pointless jump
    jumpReach: 230,        // horizontal distance at which it tries to jump onto a higher platform
    aimLag: 0.0,           // extra smoothing of the aim (0 = none)
  },

  // ---- render-side effects ------------------------------------------------------------------------------------
  fx: {
    explosionShake: 4,     // screen shake in canvas pixels on an explosion
    hitShake: 1,           // screen shake on a bullet hit
    shakeDecay: 14,        // shake lost per second
    explosionTime: 0.5,    // seconds the explosion animation lasts
    debrisPerBlock: 14,    // debris pieces when a block breaks
    maxParticles: 600,     // safety cap
  },

  // ---- online play (src/net) --------------------------------------------------------------------------------
  net: {
    gameVersion: 3,            // host and client must match, otherwise "refresh the page"
    roomPrefix: 'rawalan-',    // PeerJS id = prefix + room code (keeps ids unique on the shared public broker)
    codeAlphabet: 'ABCDEFGHJKMNPQRSTUVWXYZ23456789',   // no 0/O, 1/I/L: unambiguous
    codeLength: 5,
    snapshotEvery: 2,          // host sends a snapshot every N ticks (2 = 30 Hz)
    interpDelay: 0.10,         // seconds the client renders in the past (interpolation buffer)
    extrapolateMax: 0.10,      // seconds the client may extrapolate when the buffer runs dry
    inputRedundancy: 3,        // each input message repeats the last N frames (packet loss insurance)
    pingEvery: 1.0,            // seconds between pings
    timeout: 5.0,              // no message from the peer for this long = connection dead
    graceSeconds: 30,          // the host waits this long for a dropped client to come back
    rejoinEvery: 2.0,          // the client retries every N seconds while rejoining
    brokerTimeout: 10,         // seconds to reach the PeerJS broker
    connectTimeout: 15,        // seconds to open the data connection to the host
    unreliableTimeout: 3,      // the second (unreliable) channel must open within this, else everything uses the reliable one
    predictOwnMovement: true,  // the client runs its own movement locally (same pure step as the host) and reconciles with each snapshot
    predictSmooth: 0.07,       // seconds over which a small prediction correction is blended in (time constant)
    predictSnap: 70,           // a correction larger than this many units is applied at once (teleport, out of bounds, round restart)
    predictMaxPending: 90,     // stop predicting when this many input frames are unacknowledged (about 1.5 s: the link is dead)
    inputCushion: 1,           // host: keeps this many client frames in reserve (jitter buffer; costs one tick of delay per frame)
    inputQueueMax: 4,          // host: more than this many client frames waiting = skip ahead
    inputQueueKeep: 2,         // (the client also slows down / speeds up its input clock by up to inputClockSlew to keep the queue near the cushion, so skipping is rare)
    inputClockSlew: 0.04,      // client: at most this much faster / slower than 60 Hz when the host's input queue is too long / short         // host: ...down to this many
    inputGapMax: 10,           // host: a hole this long in the frame numbers = resynchronise instead of repeating
    stun: ['stun:stun.l.google.com:19302', 'stun:global.stun.twilio.com:3478'],   // public STUN servers (no TURN)
    maxNameLength: 10,         // player names: pixel-font-safe characters only
  },

  // ---- debug -----------------------------------------------------------------------------------------------------
  debug: {
    toggleKeys: ['Backquote', 'F1', 'F2'], // key codes that toggle the debug panel
  },
};
