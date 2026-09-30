import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createTimeline } from 'animejs';
import { PARTS, DURATION, clampProgress, chapterAt } from '../src/sequence.mjs';

test('animation groups resolve to the real GLB and cover all 13 meshes exactly once', () => {
  const bytes = readFileSync(new URL('../public/models/chronograph.glb', import.meta.url));
  assert.equal(bytes.readUInt32LE(0), 0x46546c67);
  const jsonLength = bytes.readUInt32LE(12);
  const model = JSON.parse(bytes.subarray(20, 20 + jsonLength).toString('utf8'));
  const meshNodes = [];
  const walk = (index) => {
    const node = model.nodes[index];
    assert.ok(node, `Missing node ${index}`);
    if (node.mesh !== undefined) meshNodes.push(index);
    (node.children ?? []).forEach(walk);
  };
  PARTS.forEach((part) => {
    assert.ok(part.start + part.duration <= DURATION);
    part.nodes.forEach(walk);
  });
  assert.equal(meshNodes.length, 13);
  assert.equal(new Set(meshNodes).size, 13);
  assert.deepEqual(meshNodes.toSorted((a, b) => a - b), model.nodes.flatMap((node, index) => node.mesh === undefined ? [] : [index]));
});

test('the actual Anime.js component sequence is reversible without drift', () => {
  const parts = PARTS.map(() => ({ amount: 0 }));
  const timeline = createTimeline({ autoplay: false, defaults: { ease: 'inOut(3)' } });
  timeline.add({ progress: 0 }, { progress: [0, 1], duration: DURATION, ease: 'linear' }, 0);
  PARTS.forEach((spec, index) => timeline.add(parts[index], { amount: [0, 1], duration: spec.duration }, spec.start));
  timeline.seek(4000);
  assert.equal(parts[0].amount, 1);
  assert.equal(parts[1].amount, 1);
  assert.equal(parts[2].amount, 0);
  for (let cycle = 0; cycle < 5; cycle++) {
    timeline.seek(DURATION);
    parts.forEach((part) => assert.equal(part.amount, 1));
    timeline.seek(5000);
    assert.ok(parts[2].amount > 0 && parts[2].amount < 1);
    timeline.seek(0);
    parts.forEach((part) => assert.equal(part.amount, 0));
  }
  timeline.revert();
});

test('progress is bounded and chapters change at the intended milestones', () => {
  assert.equal(clampProgress(-1), 0);
  assert.equal(clampProgress(2), 1);
  assert.equal(clampProgress(NaN), 0);
  assert.equal(chapterAt(0), 0);
  assert.equal(chapterAt(0.15), 1);
  assert.equal(chapterAt(0.4), 2);
  assert.equal(chapterAt(0.65), 3);
  assert.equal(chapterAt(1), 3);
});
