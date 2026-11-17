import { Suspense } from 'react'
import { render, screen } from '@testing-library/react'
import { expect, test, vi } from 'vitest'
import { lazyPage, preloadLazyPages } from '@/app/lazyPage'

function Hello() {
  return <p>szia</p>
}

test('a cold page suspends, then renders once its chunk arrives', async () => {
  const load = vi.fn(() => Promise.resolve({ Hello }))
  const Page = lazyPage(load, 'Hello')
  render(<Suspense fallback={<p>tölt</p>}><Page /></Suspense>)
  expect(screen.getByText('tölt')).toBeInTheDocument()
  expect(await screen.findByText('szia')).toBeInTheDocument()
  expect(load).toHaveBeenCalledTimes(1)
})

test('a warmed page renders synchronously — no fallback frame', async () => {
  const load = vi.fn(() => Promise.resolve({ Hello }))
  const Page = lazyPage(load, 'Hello')
  await preloadLazyPages()
  render(<Suspense fallback={<p>tölt</p>}><Page /></Suspense>)
  expect(screen.queryByText('tölt')).toBeNull()
  expect(screen.getByText('szia')).toBeInTheDocument()
  expect(load).toHaveBeenCalledTimes(1)
})

test('a failed load is retried on the next attempt instead of being cached', async () => {
  const load = vi.fn<() => Promise<{ Hello: typeof Hello }>>()
    .mockRejectedValueOnce(new Error('offline'))
    .mockResolvedValue({ Hello })
  const Page = lazyPage(load, 'Hello')
  await preloadLazyPages() // swallows the first failure
  await preloadLazyPages()
  render(<Suspense fallback={<p>tölt</p>}><Page /></Suspense>)
  expect(screen.getByText('szia')).toBeInTheDocument()
  expect(load).toHaveBeenCalledTimes(2)
})
