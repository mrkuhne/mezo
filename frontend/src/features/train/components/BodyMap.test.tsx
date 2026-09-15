import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { BodyMap } from './BodyMap';

const heat = [
  { token: 'chest-mid', level: 'in' as const },
  { token: 'back-wide', level: 'none' as const },
];

describe('BodyMap', () => {
  it('reserves its box, then draws both views with a silhouette and lit shapes', async () => {
    const { container } = render(<BodyMap heat={heat} views="both" ariaLabel="Heti terhelés a testeden" />);
    expect(screen.getByRole('img', { name: 'Heti terhelés a testeden' })).toBeInTheDocument();
    await waitFor(() => expect(container.querySelectorAll('svg').length).toBe(2));
    const litFront = container.querySelector('[data-shape="front/chest"]');
    expect(litFront).toHaveAttribute('opacity', '0.72');
    const noneBack = container.querySelector('[data-shape="back/upper-back"]');
    expect(noneBack).toHaveAttribute('opacity', '0.13');
  });

  it('auto view picks the side carrying more heat', async () => {
    const { container } = render(
      <BodyMap heat={[{ token: 'back-wide', level: 'over' }]} views="auto" ariaLabel="Terhelés" />,
    );
    await waitFor(() => expect(container.querySelectorAll('svg').length).toBe(1));
    expect(container.querySelector('[data-shape="back/upper-back"]')).not.toBeNull();
  });

  it('auto view ignores untouched rows: a full 21-token catalog with only one back token trained still picks back', async () => {
    // The front catalog maps to more distinct shapes than the back one (chest x3, shoulder x2,
    // biceps, quad x3, core x4 vs. back-wide/mid sharing a shape, lower-back, traps, rear delt,
    // triceps, ham, glute, calf) — with every row's opacity counted (including 'none'), that
    // shape-count skew alone used to pick the empty front view over the one trained back muscle.
    const allNone = [
      'chest-upper', 'chest-mid', 'chest-lower',
      'back-mid', 'back-lower',
      'traps',
      'shoulder-front', 'shoulder-side', 'shoulder-rear',
      'biceps-long', 'biceps-short', 'biceps-brachialis',
      'triceps-long', 'triceps-lateral', 'triceps-medial',
      'quad', 'ham', 'glute', 'calf', 'core',
    ].map((token) => ({ token, level: 'none' as const }));
    const heat21 = [...allNone, { token: 'back-wide', level: 'in' as const }];
    const { container } = render(<BodyMap heat={heat21} views="auto" ariaLabel="Terhelés" />);
    await waitFor(() => expect(container.querySelectorAll('svg').length).toBe(1));
    expect(container.querySelector('[data-shape="back/upper-back"]')).not.toBeNull();
  });
});
