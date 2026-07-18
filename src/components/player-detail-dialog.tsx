import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { CheckIcon, ExternalLinkIcon, XIcon } from 'lucide-react'
import type { Match } from '@/types'
import {
  api,
  POOLER_PROJECTS_CACHE_MS,
  poolerProjectsQueryKey,
} from '@/lib/api'
import { FridayLineChart } from '@/components/friday-line-chart'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
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

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) setAvatarPreviewOpen(false)
    onOpenChange(nextOpen)
  }

  return (
    <>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent
          className="flex max-h-[calc(100svh-1.5rem)] flex-col gap-0 overflow-hidden p-0 sm:max-h-[90svh] sm:max-w-2xl"
          aria-describedby={`player-dialog-description-${match.id}`}
        >
          <DialogHeader className="border-b border-[var(--separator)] p-5 pr-16 sm:p-6 sm:pr-16">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setAvatarPreviewOpen(true)}
                aria-label={`View @${match.login}'s photo larger`}
                className="flex size-14 shrink-0 items-center justify-center rounded-full outline-none transition-[scale] duration-160 active:scale-[0.96] sm:size-16"
              >
                <Avatar className="size-14 cursor-zoom-in transition-[scale] duration-180 hover:scale-105 sm:size-16">
                  <AvatarImage src={match.avatarUrl} alt={match.login} />
                  <AvatarFallback>{initials(match.fullName)}</AvatarFallback>
                </Avatar>
              </button>
              <div className="min-w-0">
                <DialogTitle className="text-lg sm:text-xl">
                  <a
                    href={`https://profile.intra.42.fr/users/${encodeURIComponent(match.login)}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex max-w-full items-center gap-1.5 rounded-lg outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <span className="truncate">@{match.login}</span>
                    <ExternalLinkIcon className="size-3.5 shrink-0 text-muted-foreground" />
                  </a>
                </DialogTitle>
                <DialogDescription
                  id={`player-dialog-description-${match.id}`}
                  className="mt-0.5 truncate"
                >
                  {match.fullName}
                </DialogDescription>
                <p className="mt-1 text-base font-semibold text-primary tabular-nums">
                  Level {match.level?.toFixed(2) ?? '—'}
                </p>
              </div>
            </div>
          </DialogHeader>

          <div className="overflow-y-auto p-4 sm:p-6">
            <section className="flex flex-col gap-4">
              <div>
                <h3 className="text-sm font-semibold tracking-[-0.012em]">Pool progress</h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  Exam and project scores load live from 42 and are never copied into the app
                  database.
                </p>
              </div>

              <div
                className={cn(
                  'overflow-visible rounded-[1.25rem] bg-muted/24 p-2 shadow-[0_0_0_1px_var(--separator)_inset] transition-[box-shadow,background-color,opacity] duration-180 sm:p-3',
                  projectsQuery.isFetching && 'opacity-75',
                  projectsQuery.isError &&
                    'bg-destructive/6 shadow-[0_0_0_1px_color-mix(in_oklch,var(--destructive),transparent_68%)_inset]'
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
                  <div
                    key={result.code}
                    className="rounded-xl bg-muted/28 p-3 shadow-[0_0_0_1px_var(--separator)_inset]"
                  >
                    <p className="text-xs text-muted-foreground">Exam {result.code}</p>
                    <p
                      className={cn(
                        'mt-1.5 flex items-center gap-1 text-sm font-semibold tabular-nums',
                        result.validated === true && 'text-success',
                        result.validated === false && 'text-destructive',
                        result.validated === null && 'text-muted-foreground'
                      )}
                    >
                      {result.validated === null ? (
                        'Pending'
                      ) : result.validated ? (
                        <>
                          <CheckIcon className="size-3.5" />
                          {result.score ?? 'Validated'}
                        </>
                      ) : (
                        <>
                          <XIcon className="size-3.5" />
                          Not validated
                        </>
                      )}
                    </p>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={avatarPreviewOpen} onOpenChange={setAvatarPreviewOpen}>
        <DialogContent
          showCloseButton
          className="w-auto max-w-[calc(100%-2rem)] rounded-[2rem] bg-black/38 p-3 text-white sm:max-w-none"
          aria-describedby={undefined}
        >
          <DialogTitle className="sr-only">Photo of @{match.login}</DialogTitle>
          <Avatar className="size-56 shadow-[0_0_0_1px_var(--glass-edge)] sm:size-72 md:size-80">
            <AvatarImage src={match.avatarUrl} alt={match.login} className="object-cover" />
            <AvatarFallback className="text-4xl sm:text-5xl">
              {initials(match.fullName)}
            </AvatarFallback>
          </Avatar>
        </DialogContent>
      </Dialog>
    </>
  )
}
