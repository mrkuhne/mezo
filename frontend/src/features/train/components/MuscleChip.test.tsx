import { render, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { MuscleChip } from './MuscleChip';

describe('MuscleChip', () => {
  it('crops a square viewBox around the token shapes from the generated boxes', async () => {
    const { container } = render(<MuscleChip token="chest-mid" />);
    await waitFor(() => expect(container.querySelector('svg')).not.toBeNull());
    const [x, y, w, h] = container.querySelector('svg')!.getAttribute('viewBox')!.split(' ').map(Number);
    expect(w).toBe(h);
    expect(w).toBeGreaterThan(0);
    expect(Number.isFinite(x) && Number.isFinite(y)).toBe(true);
  });

  it('renders nothing for an unknown token', () => {
    const { container } = render(<MuscleChip token="nincs-ilyen" />);
    expect(container.firstChild).toBeNull();
  });

  it('reserves space with a sized placeholder before geometry loads', () => {
    // Known token should render a sized placeholder synchronously (before waitFor)
    const { container } = render(<MuscleChip token="chest-mid" size={48} />);
    const placeholder = container.querySelector('span');
    expect(placeholder).not.toBeNull();
    expect(placeholder).toHaveStyle({ display: 'inline-block', width: '48px', height: '48px' });
  });

  it('renders nothing synchronously for an unknown token', () => {
    // Unknown token should not render a placeholder
    const { container } = render(<MuscleChip token="nincs-ilyen" />);
    expect(container.firstChild).toBeNull();
  });
});
