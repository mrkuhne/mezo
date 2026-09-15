import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MUSCLES, TOKEN_SHAPES } from './muscle-taxonomy.js';
import { BODY } from './body-geometry.js';

test('every live muscle resolves to at least one real shape on the right view', () => {
  for (const muscle of MUSCLES) {
    const shapes = TOKEN_SHAPES[muscle.key];
    assert.ok(shapes?.length, `${muscle.key} has no drawable shape`);
    for (const [view, slug] of shapes) {
      assert.ok(BODY[view]?.p[slug]?.length, `${muscle.key} points at a missing shape: ${view}/${slug}`);
    }
  }
});

test('nothing is guessed: the mapping only names shapes the artwork really has', () => {
  for (const [token, shapes] of Object.entries(TOKEN_SHAPES)) {
    assert.ok(MUSCLES.some(m => m.key === token), `${token} is not a live muscle token`);
    for (const [view] of shapes) assert.ok(view === 'front' || view === 'back');
  }
});

test('both views carry a sane viewBox and a full silhouette', () => {
  for (const view of ['front', 'back']) {
    const [, , w, h] = BODY[view].vb.split(' ').map(Number);
    assert.ok(w > 300 && h > 900, `${view} viewBox looks wrong: ${BODY[view].vb}`);
    assert.ok(Object.keys(BODY[view].p).length >= 15, `${view} silhouette is missing parts`);
  }
});
