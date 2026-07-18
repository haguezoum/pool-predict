import * as React from 'react'
import { cn } from '@/lib/utils'

export type GlassSurfaceVariant =
  | 'standard'
  | 'regular'
  | 'clear'
  | 'elevated'
  | 'interactive'

type GlassSurfaceProps = React.ComponentProps<'div'> & {
  variant?: GlassSurfaceVariant
}

function GlassSurface({
  className,
  variant = 'regular',
  onPointerMove,
  onPointerLeave,
  ...props
}: GlassSurfaceProps) {
  function handlePointerMove(event: React.PointerEvent<HTMLDivElement>) {
    if (variant === 'interactive' && event.pointerType !== 'touch') {
      const bounds = event.currentTarget.getBoundingClientRect()
      event.currentTarget.style.setProperty('--glass-x', `${event.clientX - bounds.left}px`)
      event.currentTarget.style.setProperty('--glass-y', `${event.clientY - bounds.top}px`)
    }
    onPointerMove?.(event)
  }

  function handlePointerLeave(event: React.PointerEvent<HTMLDivElement>) {
    event.currentTarget.style.removeProperty('--glass-x')
    event.currentTarget.style.removeProperty('--glass-y')
    onPointerLeave?.(event)
  }

  return (
    <div
      data-slot="glass-surface"
      data-variant={variant}
      className={cn('liquid-glass', className)}
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
      {...props}
    />
  )
}

export { GlassSurface }
