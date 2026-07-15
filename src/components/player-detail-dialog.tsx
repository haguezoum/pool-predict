import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'motion/react'
import { CheckIcon, XIcon } from 'lucide-react'
import type { Match } from '@/types'
import { FridayLineChart } from '@/components/friday-line-chart'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

function initials(name: string) {
  return name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

type PlayerDetailDialogProps = {
  match: Match
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function PlayerDetailDialog({ match, open, onOpenChange }: PlayerDetailDialogProps) {
  useEffect(() => {
    if (!open) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onOpenChange(false)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [open, onOpenChange])

  if (typeof document === 'undefined') return null

  return createPortal(
    <AnimatePresence>
      {open ? (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <button
            type="button"
            aria-label="Close player details"
            className="absolute inset-0 bg-black/55 backdrop-blur-sm"
            onClick={() => onOpenChange(false)}
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby={`player-dialog-title-${match.id}`}
            className="relative z-10 flex max-h-[90svh] w-full max-w-xl flex-col overflow-hidden rounded-xl bg-popover text-popover-foreground shadow-2xl ring-1 ring-foreground/10"
            initial={{ opacity: 0, scale: 0.92, y: 24 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 12 }}
          >
            <header className="relative border-b px-4 py-4 sm:px-6">
              <div className="flex items-center gap-3 pr-10">
                <Avatar className="size-12 sm:size-14">
                  <AvatarImage src={match.avatarUrl} alt={match.login} />
                  <AvatarFallback>{initials(match.fullName)}</AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <h2
                    id={`player-dialog-title-${match.id}`}
                    className="truncate text-lg font-semibold tracking-tight"
                  >
                    @{match.login}
                  </h2>
                  <p className="truncate text-sm text-muted-foreground">{match.fullName}</p>
                </div>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="absolute top-3 right-3"
                aria-label="Close"
                onClick={() => onOpenChange(false)}
              >
                <XIcon />
              </Button>
            </header>

            <div className="overflow-y-auto px-4 py-5 sm:px-6">
              <section className="flex flex-col gap-3">
                <div>
                  <h3 className="text-sm font-semibold tracking-tight">Exam 00–03 results</h3>
                  <p className="text-xs text-muted-foreground">
                    Loaded live from 42. Results are never copied into the app database.
                  </p>
                </div>
                <div className="rounded-xl border border-border p-2 sm:p-3">
                  <FridayLineChart fridays={match.fridays} login={match.login} />
                </div>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {match.results.map((result) => (
                    <div key={result.code} className="rounded-lg border border-border p-3">
                      <p className="text-xs text-muted-foreground">Exam {result.code}</p>
                      <p
                        className={cn(
                          'mt-1 flex items-center gap-1 text-sm font-medium',
                          result.validated === true && 'text-emerald-600 dark:text-emerald-400',
                          result.validated === false && 'text-red-600 dark:text-red-400'
                        )}
                      >
                        {result.validated === null ? (
                          'Pending'
                        ) : result.validated ? (
                          <><CheckIcon className="size-3.5" /> {result.score ?? 'Validated'}</>
                        ) : (
                          <><XIcon className="size-3.5" /> Not validated</>
                        )}
                      </p>
                    </div>
                  ))}
                </div>
              </section>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body
  )
}
