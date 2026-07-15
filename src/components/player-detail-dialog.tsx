import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'motion/react'
import { XIcon } from 'lucide-react'
import type { Match } from '@/types'
import { FridayLineChart } from '@/components/friday-line-chart'
import { LogtimeHeatmap } from '@/components/logtime-heatmap'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { cn } from '@/lib/utils'

function initials(name: string) {
  return name
    .split(' ')
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

function scoreCell(value: number | null) {
  if (value == null) {
    return <span className="text-muted-foreground">—</span>
  }
  return (
    <span
      className={cn(
        'tabular-nums font-medium',
        value >= 80
          ? 'text-emerald-500'
          : value >= 50
            ? 'text-foreground'
            : 'text-red-400'
      )}
    >
      {value}
    </span>
  )
}

const easeOut = [0.32, 0.72, 0, 1] as const

const contentContainer = {
  hidden: {},
  show: {
    transition: { staggerChildren: 0.07, delayChildren: 0.12 },
  },
}

const contentItem = {
  hidden: { opacity: 0, y: 14 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.35, ease: easeOut },
  },
}

type PlayerDetailDialogProps = {
  match: Match
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function PlayerDetailDialog({
  match,
  open,
  onOpenChange,
}: PlayerDetailDialogProps) {
  // Body scroll lock + Escape to close
  useEffect(() => {
    if (!open) return

    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onOpenChange(false)
    }
    window.addEventListener('keydown', onKeyDown)

    return () => {
      document.body.style.overflow = prev
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [open, onOpenChange])

  if (typeof document === 'undefined') return null

  return createPortal(
    <AnimatePresence>
      {open ? (
        <motion.div
          key={`player-detail-${match.id}`}
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6"
          role="presentation"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.28, ease: easeOut }}
        >
          {/* Backdrop */}
          <motion.button
            type="button"
            aria-label="Close dialog"
            className="absolute inset-0 bg-black/55 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3, ease: easeOut }}
            onClick={() => onOpenChange(false)}
          />

          {/* Expanded panel */}
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby={`player-dialog-title-${match.id}`}
            className="relative z-10 flex max-h-[min(90svh,52rem)] w-full max-w-2xl flex-col overflow-hidden rounded-xl bg-popover text-sm text-popover-foreground shadow-2xl ring-1 ring-foreground/10 outline-none"
            initial={{ opacity: 0, scale: 0.86, y: 36 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{
              type: 'spring',
              stiffness: 340,
              damping: 30,
              mass: 0.9,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <header className="relative shrink-0 border-b px-4 py-4 sm:px-6">
              <div className="flex items-center gap-3 pr-10">
                <Avatar className="size-12 sm:size-14">
                  <AvatarImage src={match.avatarUrl} alt={match.login} />
                  <AvatarFallback>{initials(match.fullName)}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 text-left">
                  <h2
                    id={`player-dialog-title-${match.id}`}
                    className="truncate text-lg font-semibold tracking-tight"
                  >
                    @{match.login}
                  </h2>
                  <p className="truncate text-sm text-muted-foreground">
                    {match.fullName}
                  </p>
                </div>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="absolute top-3 right-3 transition-transform duration-200 hover:scale-110 active:scale-95"
                aria-label="Close"
                onClick={() => onOpenChange(false)}
              >
                <XIcon />
              </Button>
            </header>

            <motion.div
              className="min-h-0 flex-1 overflow-y-auto overscroll-contain"
              variants={contentContainer}
              initial="hidden"
              animate="show"
            >
              <div className="flex flex-col gap-8 px-4 py-5 sm:px-6">
                <motion.section
                  variants={contentItem}
                  className="flex flex-col gap-2"
                >
                  <h3 className="text-sm font-semibold tracking-tight">
                    Exam scores
                  </h3>
                  <div className="rounded-xl border border-border p-2 sm:p-3">
                    <FridayLineChart
                      fridays={match.fridays}
                      login={match.login}
                    />
                  </div>
                </motion.section>

                <motion.section
                  variants={contentItem}
                  className="flex flex-col gap-3"
                >
                  <div className="flex flex-col gap-0.5">
                    <h3 className="text-sm font-semibold tracking-tight">
                      Logtime
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      Activity by time of day · Mon–Sun (API soon)
                    </p>
                  </div>
                  <div className="rounded-xl border border-border p-3 sm:p-4">
                    <LogtimeHeatmap logtime={match.logtime} />
                  </div>
                </motion.section>

                <motion.section
                  variants={contentItem}
                  className="flex flex-col gap-3"
                >
                  <div className="flex flex-col gap-0.5">
                    <h3 className="text-sm font-semibold tracking-tight">
                      Exercise scores
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      Day 1 · Day 2 · Day 3 for 28 days (API soon)
                    </p>
                  </div>

                  <div className="overflow-hidden rounded-xl border border-border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-16">Day</TableHead>
                          <TableHead className="text-right">Day 1</TableHead>
                          <TableHead className="text-right">Day 2</TableHead>
                          <TableHead className="text-right">Day 3</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {match.exercises.map((row) => (
                          <TableRow key={row.day}>
                            <TableCell className="font-medium tabular-nums">
                              {row.day}
                            </TableCell>
                            <TableCell className="text-right">
                              {scoreCell(row.day1)}
                            </TableCell>
                            <TableCell className="text-right">
                              {scoreCell(row.day2)}
                            </TableCell>
                            <TableCell className="text-right">
                              {scoreCell(row.day3)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </motion.section>
              </div>
            </motion.div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body
  )
}
