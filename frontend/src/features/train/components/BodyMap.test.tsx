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
});
