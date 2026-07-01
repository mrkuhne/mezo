import { render } from '@testing-library/react'
import { Skeleton, SkeletonText } from '@/shared/ui/Skeleton'

describe('Skeleton', () => {
  it('renders a .sk block with the variant class', () => {
    const { container } = render(<Skeleton variant="circle" width={40} height={40} />)
    const el = container.querySelector('.sk')
    expect(el).not.toBeNull()
    expect(el).toHaveClass('sk--circle')
    expect(el).toHaveAttribute('aria-hidden', 'true')
  })

  it('applies width/height/radius inline', () => {
    const { container } = render(<Skeleton width="60%" height={12} radius={4} />)
    const el = container.querySelector('.sk') as HTMLElement
    expect(el.style.width).toBe('60%')
    expect(el.style.height).toBe('12px')
    expect(el.style.borderRadius).toBe('4px')
  })

  it('SkeletonText renders the requested number of lines', () => {
    const { container } = render(<SkeletonText lines={4} />)
    expect(container.querySelectorAll('.sk')).toHaveLength(4)
  })
})
