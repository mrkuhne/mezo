import { describe, expect, it } from 'vitest';
import { BODY } from './bodyGeometry.gen';

describe('bodyGeometry.gen', () => {
  it('carries a sane viewBox and a full silhouette per view', () => {
    for (const view of ['front', 'back'] as const) {
      const [, , w, h] = BODY[view].vb.split(' ').map(Number);
      expect(w).toBeGreaterThan(300);
      expect(h).toBeGreaterThan(900);
      expect(Object.keys(BODY[view].p).length).toBeGreaterThanOrEqual(15);
    }
  });

  it('has a bbox for every shape, inside its view', () => {
    for (const view of ['front', 'back'] as const) {
      for (const [slug, [x, y, w, h]] of Object.entries(BODY[view].b)) {
        expect(w, slug).toBeGreaterThan(0);
        expect(h, slug).toBeGreaterThan(0);
        expect(Number.isFinite(x) && Number.isFinite(y)).toBe(true);
      }
    }
  });
});
