import { LayoutGroup, motion, useReducedMotion } from 'motion/react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { GlassSurface } from '@/components/ui/glass-surface'

type SegmentItem<T extends string> = {
  value: T
  label: string
  icon?: LucideIcon
  count?: number
  controls?: string
}

type SegmentedControlProps<T extends string> = {
  value: T
  onValueChange: (value: T) => void
  items: readonly SegmentItem<T>[]
  ariaLabel: string
  id: string
  className?: string
}

function SegmentedControl<T extends string>({
  value,
  onValueChange,
  items,
  ariaLabel,
  id,
  className,
}: SegmentedControlProps<T>) {
  const reducedMotion = useReducedMotion()

  return (
    <LayoutGroup id={id}>
      <GlassSurface
        variant="interactive"
        role="tablist"
        aria-label={ariaLabel}
        className={cn(
          'flex min-h-11 w-full items-center gap-1 rounded-2xl p-1 sm:w-fit',
          className
        )}
      >
        {items.map(({ value: itemValue, label, icon: Icon, count, controls }) => {
          const selected = value === itemValue
          return (
            <button
              key={itemValue}
              type="button"
              role="tab"
              aria-selected={selected}
              aria-controls={controls}
              className={cn(
                'relative flex min-h-9 flex-1 items-center justify-center gap-1.5 rounded-xl px-3 text-sm font-medium outline-none transition-[color,scale] duration-160 active:scale-[0.96] sm:flex-none',
                selected ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
              )}
              onClick={() => onValueChange(itemValue)}
            >
              {selected ? (
                <motion.span
                  layoutId="selected-segment"
                  className="absolute inset-0 rounded-xl bg-background/82 shadow-[0_0_0_1px_var(--glass-edge)]"
                  transition={
                    reducedMotion
                      ? { duration: 0 }
                      : { type: 'spring', duration: 0.28, bounce: 0 }
                  }
                />
              ) : null}
              <span className="relative z-10 flex items-center gap-1.5">
                {Icon ? <Icon aria-hidden /> : null}
                <span>{label}</span>
                {typeof count === 'number' ? (
                  <span className="tabular-nums text-xs opacity-65">{count}</span>
                ) : null}
              </span>
            </button>
          )
        })}
      </GlassSurface>
    </LayoutGroup>
  )
}

export { SegmentedControl }
