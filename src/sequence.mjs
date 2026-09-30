/** Component IDs refer to nodes in the supplied, unmodified GLB. */
export const PARTS = Object.freeze([
  { id: 'glass', nodes: [7], offset: [0, 0, 3.5], start: 1500, duration: 2300 },
  { id: 'bezel', nodes: [3], offset: [0, 0, 2.5], start: 1850, duration: 2150 },
  { id: 'hands', nodes: [8], offset: [0, 0, 1.65], start: 4000, duration: 2200 },
  { id: 'dial', nodes: [13], offset: [0, 0, 0.9], start: 4300, duration: 2200 },
  { id: 'band', nodes: [1, 2], offset: [-0.7, -0.55, -0.45], start: 6500, duration: 2300 },
  { id: 'controls', nodes: [4, 5], offset: [1.4, 0.4, 0.1], start: 6700, duration: 2000 },
  { id: 'clasp', nodes: [6], offset: [0.65, -1.25, -0.8], start: 6900, duration: 2100 },
  { id: 'backplate', nodes: [0], offset: [0, 0, -1], start: 6500, duration: 2200 },
]);

export const DURATION = 10000;
export const CHAPTERS = Object.freeze([
  { category: 'THE COMPLETE OBJECT', title: 'Designed to come together.', description: 'Every layer has a place. Every detail, a purpose.' },
  { category: 'GLASS & BEZEL', title: 'The first layer of protection.', description: 'The glass and gold bezel lift away, revealing the dial beneath.' },
  { category: 'DIAL & HANDS', title: 'Where precision becomes visible.', description: 'The hands float above the dial. A small distance makes every detail clear.' },
  { category: 'THE EXPLODED VIEW', title: 'A whole, in its parts.', description: 'Band, controls, clasp and backplate separate. Scroll up to bring it all together.' },
]);

/** @param {number} value */
export function clampProgress(value) {
  return Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0));
}

/** @param {number} progress */
export function chapterAt(progress) {
  const p = clampProgress(progress);
  return p < 0.15 ? 0 : p < 0.4 ? 1 : p < 0.65 ? 2 : 3;
}
