import { useEffect, type ReactNode } from 'react'
import { cn } from '@/lib/cn'

interface SheetProps {
  children: ReactNode
  onClose: () => void
  className?: string
  labelledBy?: string
}

export function Sheet({ children, onClose, className, labelledBy }: SheetProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <>
      <div className="sheet-backdrop" onClick={onClose} aria-hidden="true" />
      <div className={cn('sheet', className)} role="dialog" aria-modal="true" aria-labelledby={labelledBy}>
        <div className="sheet-handle" />
        {children}
      </div>
    </>
  )
}
