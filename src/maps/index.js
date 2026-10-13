// ============================================================================
//  maps/index.js  -  the map registry.
//  ADDING A MAP = one new file in this folder + ONE import line and ONE array entry below.
// ============================================================================
import ruinedCity from './ruined-city.js';
import waterfallForest from './waterfall-forest.js';
import oldPlaza from './old-plaza.js';
import abandonedSuburb from './abandoned-suburb.js';

export const MAPS = [
  ruinedCity,
  waterfallForest,
  oldPlaza,
  abandonedSuburb,
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
