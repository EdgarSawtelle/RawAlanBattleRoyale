// registry.js - the backgrounds the game ships. SCENES holds lazy imports (used inside the worker), SCENE_LIST
// is plain data for the UI (debug panel) so the page never has to import the scene code itself.
export const SCENES = {
  'overgrown-downtown': () => import('./scenes/overgrown-downtown.js'),
  'waterfall-forest': () => import('./scenes/waterfall-forest.js'),
  'old-plaza': () => import('./scenes/old-plaza.js'),
  'abandoned-suburb': () => import('./scenes/abandoned-suburb.js'),
};
export const SCENE_LIST = [
  { id: 'overgrown-downtown', name: 'Overgrown Downtown', variants: ['golden hour', 'overcast after rain'] },
  { id: 'waterfall-forest', name: 'Waterfall Forest', variants: ['morning mist', 'dusk with fireflies'] },
  { id: 'old-plaza', name: 'Old Plaza', variants: ['golden afternoon', 'foggy dawn'] },
  { id: 'abandoned-suburb', name: 'Abandoned Suburb', variants: ['late afternoon', 'misty morning'] },
];
