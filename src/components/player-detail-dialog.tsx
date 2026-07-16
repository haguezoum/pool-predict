import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useQuery } from '@tanstack/react-query'
import { AnimatePresence, motion } from 'motion/react'
import { CheckIcon, XIcon } from 'lucide-react'
import type { Match } from '@/types'
import {
  api,
  POOLER_PROJECTS_CACHE_MS,
  poolerProjectsQueryKey,
} from '@/lib/api'
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
  poolId: string
  campusId: number
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function PlayerDetailDialog({
  match,
  poolId,
  campusId,
  open,
  onOpenChange,
}: PlayerDetailDialogProps) {
  const [avatarPreviewOpen, setAvatarPreviewOpen] = useState(false)
  const projectsQuery = useQuery({
    queryKey: poolerProjectsQueryKey(campusId, poolId, match.intraUserId),
    queryFn: () => api.poolerProjects(poolId, match.intraUserId, campusId),
    enabled: open,
    staleTime: POOLER_PROJECTS_CACHE_MS,
  })

  useEffect(() => {
    if (!open) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      if (avatarPreviewOpen) {
        setAvatarPreviewOpen(false)
        return
      }
      onOpenChange(false)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [open, onOpenChange, avatarPreviewOpen])

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
              <div className="flex w-fit items-center gap-3 pr-10">
                <button
                  type="button"
                  onClick={() => setAvatarPreviewOpen(true)}
                  aria-label={`View @${match.login}'s photo larger`}
                  className="shrink-0 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <Avatar className="size-12 cursor-zoom-in transition-transform hover:scale-105 sm:size-14">
                    <AvatarImage src={match.avatarUrl} alt={match.login} />
                    <AvatarFallback>{initials(match.fullName)}</AvatarFallback>
                  </Avatar>
                </button>
                <a
                  href={`https://profile.intra.42.fr/users/${encodeURIComponent(match.login)}`}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={`Open @${match.login}'s 42 profile in a new tab`}
                  className="group min-w-0 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <span
                    id={`player-dialog-title-${match.id}`}
                    className="block truncate text-lg font-semibold tracking-tight group-hover:underline"
                  >
                    @{match.login}
                  </span>
                  <span className="block truncate text-sm text-muted-foreground">{match.fullName}</span>
                  <span className="mt-0.5 block text-base font-semibold tabular-nums text-primary sm:text-lg">
                    Lvl {match.level?.toFixed(2) ?? '—'}
                  </span>
                </a>
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
                  <h3 className="text-sm font-semibold tracking-tight">Pool progress</h3>
                  <p className="text-xs text-muted-foreground">
                    Exam and project scores are loaded live from 42 and never copied into the app database.
                  </p>
                </div>
                <div
                  className={cn(
                    'overflow-visible rounded-xl border p-2 transition-colors sm:p-3',
                    projectsQuery.isFetching
                      ? 'animate-pulse border-primary/60'
                      : projectsQuery.isError
                        ? 'border-destructive/50'
                        : 'border-border'
                  )}
                  aria-busy={projectsQuery.isFetching}
                >
                  <FridayLineChart
                    fridays={match.fridays}
                    login={match.login}
                    projectResults={projectsQuery.data}
                    showSeriesControls
                  />
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

          <AnimatePresence>
            {avatarPreviewOpen ? (
              <motion.div
                className="fixed inset-0 z-[60] flex items-center justify-center p-6"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <button
                  type="button"
                  aria-label="Close photo preview"
                  className="absolute inset-0 bg-black/70 backdrop-blur-md"
                  onClick={() => setAvatarPreviewOpen(false)}
                />
                <motion.div
                  className="relative z-10"
                  initial={{ opacity: 0, scale: 0.72 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.85 }}
                  transition={{ type: 'spring', stiffness: 320, damping: 28 }}
                >
                  <Avatar className="size-48 shadow-2xl ring-4 ring-white/20 sm:size-64 md:size-80">
                    <AvatarImage src={match.avatarUrl} alt={match.login} className="object-cover" />
                    <AvatarFallback className="text-4xl sm:text-5xl">
                      {initials(match.fullName)}
                    </AvatarFallback>
                  </Avatar>
                  <Button
                    type="button"
                    variant="secondary"
                    size="icon-sm"
                    className="absolute -top-2 -right-2 rounded-full shadow-md"
                    aria-label="Close photo preview"
                    onClick={() => setAvatarPreviewOpen(false)}
                  >
                    <XIcon />
                  </Button>
                </motion.div>
              </motion.div>
            ) : null}
          </AnimatePresence>
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body
  )
}
