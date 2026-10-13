// ============================================================================
//  maps/index.js  -  the map registry.
//  ADDING A MAP = one new file in this folder + ONE import line and ONE array entry below.
// ============================================================================
import ruinedCity from './ruined-city.js';
import waterfallForest from './waterfall-forest.js';
import oldPlaza from './old-plaza.js';
import abandonedSuburb from './abandoned-suburb.js';
import archipelago from './archipelago.js';
import bowl from './bowl.js';
import boxes from './boxes.js';
import brickRows from './brick-rows.js';
import carousel from './carousel.js';
import cloudTops from './cloud-tops.js';
import crateWall from './crate-wall.js';
import flagstairs from './flagstairs.js';
import highGround from './high-ground.js';
import liftShaft from './lift-shaft.js';
import loneTower from './lone-tower.js';
import longBridge from './long-bridge.js';
import luckyRow from './lucky-row.js';
import monolith from './monolith.js';
import organPipes from './organ-pipes.js';
import peak from './peak.js';
import pipeworks from './pipeworks.js';
import shuttleRun from './shuttle-run.js';
import stiltTops from './stilt-tops.js';
import theCross from './the-cross.js';
import trenches from './trenches.js';
import twinForts from './twin-forts.js';
import twoSpans from './two-spans.js';
import undercroft from './undercroft.js';
import underpass from './underpass.js';
import ziggurat from './ziggurat.js';

export const MAPS = [
  ruinedCity,
  waterfallForest,
  oldPlaza,
  abandonedSuburb,
  archipelago,
  bowl,
  boxes,
  brickRows,
  carousel,
  cloudTops,
  crateWall,
  flagstairs,
  highGround,
  liftShaft,
  loneTower,
  longBridge,
  luckyRow,
  monolith,
  organPipes,
  peak,
  pipeworks,
  shuttleRun,
  stiltTops,
  theCross,
  trenches,
  twinForts,
  twoSpans,
  undercroft,
  underpass,
  ziggurat,
  // add new maps here
];

export function getMap(id) {
  const m = MAPS.find((x) => x.id === id);
  if (!m) throw new Error('Unknown map: ' + id);
  return m;
}

// The maps that take part in the round rotation (the four real ones; test maps registered later are not in it).
export const ROTATION = MAPS.map((m) => m.id);

// Used by the headless tests to add tiny synthetic maps.
export function registerMap(map) {
  const i = MAPS.findIndex((x) => x.id === map.id);
  if (i >= 0) MAPS[i] = map; else MAPS.push(map);
}
