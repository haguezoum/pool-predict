import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { motion, useReducedMotion } from 'motion/react'
import { TrophyIcon } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/context/auth-context'
import { api } from '@/lib/api'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { GlassSurface } from '@/components/ui/glass-surface'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { cn } from '@/lib/utils'
import { useMobileViewport } from '@/lib/use-mobile-viewport'

function rankStyle(rank: number) {
  if (rank === 1) return 'bg-warning/14 text-[var(--rank-gold)]'
  if (rank === 2) return 'bg-foreground/8 text-[var(--rank-silver)]'
  if (rank === 3) return 'bg-[color-mix(in_oklch,var(--rank-bronze),transparent_86%)] text-[var(--rank-bronze)]'
  return 'bg-muted text-muted-foreground'
}

function rankLabel(rank: number) {
  return rank > 0 ? rank : '—'
}

function initials(name: string) {
  return name.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase()
}

export function LeaderboardPage() {
  const { user } = useAuth()
  const reducedMotion = useReducedMotion()
  const mobileViewport = useMobileViewport()
  const streamlinedMotion = Boolean(reducedMotion) || mobileViewport
  const [selectedPoolId, setSelectedPoolId] = useState<string | null>(null)
  const poolQuery = useQuery({
    queryKey: ['pools', user?.campusId],
    queryFn: () => api.pools(user!.campusId),
    enabled: Boolean(user?.campusId),
    staleTime: 5 * 60_000,
  })
  const activePoolId = selectedPoolId ?? poolQuery.data?.[0]?.id
  const selectedPool = poolQuery.data?.find((pool) => pool.id === activePoolId)
  const leaderboardQuery = useQuery({
    queryKey: ['leaderboard', user?.campusId, selectedPoolId ?? 'current'],
    queryFn: () => api.leaderboard(user!.campusId, selectedPoolId ?? undefined),
    enabled: Boolean(user?.campusId),
    staleTime: 5 * 60_000,
  })
  const leaderboard = leaderboardQuery.data ?? []
  const top3 = leaderboard.filter((entry) => entry.rank > 0).slice(0, 3)

  if (poolQuery.isPending || leaderboardQuery.isPending) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-10 w-56" />
        <div className="grid gap-3 sm:grid-cols-3">
          {Array.from({ length: 3 }, (_, index) => (
            <Skeleton key={index} className="h-56" />
          ))}
        </div>
        <Skeleton className="h-96" />
      </div>
    )
  }

  if (poolQuery.error || leaderboardQuery.error) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
          <p className="font-medium">The leaderboard could not be refreshed.</p>
          <p className="text-sm text-muted-foreground">Existing totals are safe. Try again shortly.</p>
          <Button onClick={() => leaderboardQuery.refetch()}>Try again</Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <motion.div
      className="flex flex-col gap-7"
      initial={streamlinedMotion ? false : 'hidden'}
      animate="visible"
      variants={{
        hidden: {},
        visible: { transition: { staggerChildren: streamlinedMotion ? 0 : 0.07 } },
      }}
    >
      <motion.section
        variants={{
          hidden: { opacity: 0, y: 10, filter: 'blur(3px)' },
          visible: { opacity: 1, y: 0, filter: 'blur(0px)' },
        }}
        transition={{ duration: 0.24, ease: [0.2, 0, 0, 1] }}
      >
        <GlassSurface
          variant="standard"
          className="flex flex-col gap-4 rounded-[2rem] p-5 sm:flex-row sm:items-end sm:justify-between sm:p-6"
        >
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-2">
            <TrophyIcon className="size-5 text-primary" />
            <h1 className="text-2xl font-semibold tracking-[-0.035em] sm:text-3xl">Leaderboard</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            {selectedPool?.status === 'closed' ? 'Archived pool' : 'Current pool'} · rank ties are sorted by login; unranked players follow by account age.
          </p>
        </div>
        {(poolQuery.data?.length ?? 0) > 1 ? (
          <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
            Pool
            <select
              className="native-select min-w-48 px-3 text-sm"
              value={activePoolId}
              onChange={(event) => setSelectedPoolId(event.target.value)}
            >
              {poolQuery.data?.map((pool) => (
                <option key={pool.id} value={pool.id}>
                  {new Date(pool.startsAt).toLocaleDateString()} · {pool.status === 'closed' ? 'Archived' : 'Current'}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        </GlassSurface>
      </motion.section>

      {top3.length > 0 ? (
        <motion.section
          variants={{
            hidden: { opacity: 0, y: 12 },
            visible: { opacity: 1, y: 0 },
          }}
          transition={{ duration: 0.24, ease: [0.2, 0, 0, 1] }}
          className="grid grid-cols-1 gap-4 sm:grid-cols-3 sm:items-end"
        >
          {top3.map((entry, index) => {
            const order = index === 0 ? 'sm:order-2' : index === 1 ? 'sm:order-1' : 'sm:order-3'
            const height = index === 0 ? 'sm:pb-8 sm:pt-6' : index === 1 ? 'sm:pb-5 sm:pt-4' : 'sm:pb-3 sm:pt-3'
            return (
              <Card
                key={entry.intraUserId}
                size="sm"
                className={cn(
                  order,
                  height,
                  'hover:bg-card/96',
                  entry.login === user?.login &&
                    'border-2 border-primary/45'
                )}
              >
                <CardHeader className="items-center text-center">
                  <span className={cn('flex size-8 items-center justify-center rounded-full text-sm font-bold tabular-nums', rankStyle(entry.rank))}>
                    {rankLabel(entry.rank)}
                  </span>
                  <Link
                    to={`/profile/${entry.intraUserId}?poolId=${encodeURIComponent(activePoolId ?? '')}`}
                    aria-label={`Open @${entry.login}'s prediction profile`}
                    className="group flex flex-col items-center rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <Avatar className="mx-auto mt-2 size-12 transition-[scale] duration-180 group-hover:scale-105">
                      <AvatarImage src={entry.avatarUrl} alt={entry.login} />
                      <AvatarFallback>{initials(entry.displayName)}</AvatarFallback>
                    </Avatar>
                    <CardTitle className="mt-2 text-sm group-hover:underline sm:text-base">{entry.displayName}</CardTitle>
                    <CardDescription>@{entry.login}</CardDescription>
                  </Link>
                </CardHeader>
                <CardContent className="flex flex-col items-center gap-1 pt-0">
                  <p className="text-xl font-semibold tabular-nums">{entry.totalScore}</p>
                  <p className="text-xs text-muted-foreground tabular-nums">
                    {entry.exactHits} exact · {entry.accuracy}% correct
                  </p>
                </CardContent>
              </Card>
            )
          })}
        </motion.section>
      ) : null}

      <motion.section
        variants={{
          hidden: { opacity: 0, y: 10 },
          visible: { opacity: 1, y: 0 },
        }}
        transition={{ duration: 0.22, ease: [0.2, 0, 0, 1] }}
        className="flex flex-col gap-3 md:hidden"
      >
        {leaderboard.map((entry) => (
          <Card
            key={entry.intraUserId}
            size="sm"
            className={cn(
              'mobile-scroll-card mobile-scroll-card-compact',
              entry.login === user?.login &&
                'border-2 border-primary/45'
            )}
          >
            <CardContent className="flex items-center gap-3 pt-(--card-spacing)">
              <span className={cn('flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-bold tabular-nums', rankStyle(entry.rank))}>
                {rankLabel(entry.rank)}
              </span>
              <Link
                to={`/profile/${entry.intraUserId}?poolId=${encodeURIComponent(activePoolId ?? '')}`}
                className="flex min-w-0 flex-1 items-center gap-3 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label={`Open @${entry.login}'s prediction profile`}
              >
                <Avatar size="sm">
                  <AvatarImage
                    src={entry.avatarUrl}
                    alt={entry.login}
                    loading="lazy"
                    decoding="async"
                  />
                  <AvatarFallback>{initials(entry.displayName)}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium hover:underline">
                    {entry.displayName}
                    {entry.login === user?.login ? <Badge variant="secondary" className="ml-1.5">You</Badge> : null}
                  </p>
                  <p className="truncate text-xs text-muted-foreground tabular-nums">@{entry.login} · {entry.exactHits} exact</p>
                </div>
              </Link>
              <div className="shrink-0 text-right">
                <p className="text-sm font-semibold tabular-nums">{entry.totalScore}</p>
                <p className="text-[0.65rem] text-muted-foreground tabular-nums">{entry.missedExams} missed</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </motion.section>

      <motion.div
        variants={{
          hidden: { opacity: 0, y: 10 },
          visible: { opacity: 1, y: 0 },
        }}
        transition={{ duration: 0.22, ease: [0.2, 0, 0, 1] }}
      >
      <Card className="hidden overflow-hidden py-0 md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-16">Rank</TableHead>
              <TableHead>Player</TableHead>
              <TableHead className="text-right">Predictions</TableHead>
              <TableHead className="text-right">Exact</TableHead>
              <TableHead className="text-right">Missed exams</TableHead>
              <TableHead className="text-right">Score</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {leaderboard.map((entry) => (
              <TableRow key={entry.intraUserId} className={cn(entry.login === user?.login && 'bg-primary/7')}>
                <TableCell>
                  <span className={cn('inline-flex size-7 items-center justify-center rounded-full text-xs font-bold tabular-nums', rankStyle(entry.rank))}>
                    {rankLabel(entry.rank)}
                  </span>
                </TableCell>
                <TableCell>
                  <Link
                    to={`/profile/${entry.intraUserId}?poolId=${encodeURIComponent(activePoolId ?? '')}`}
                    className="flex items-center gap-2.5 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    aria-label={`Open @${entry.login}'s prediction profile`}
                  >
                    <Avatar size="sm">
                      <AvatarImage src={entry.avatarUrl} alt={entry.login} />
                      <AvatarFallback>{initials(entry.displayName)}</AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col">
                      <span className="font-medium">
                        {entry.displayName}
                        {entry.login === user?.login ? <Badge variant="secondary" className="ml-1.5">You</Badge> : null}
                      </span>
                      <span className="text-xs text-muted-foreground">@{entry.login}</span>
                    </div>
                  </Link>
                </TableCell>
                <TableCell className="text-right tabular-nums">{entry.predictions}</TableCell>
                <TableCell className="text-right tabular-nums">{entry.exactHits}</TableCell>
                <TableCell className="text-right tabular-nums">{entry.missedExams}</TableCell>
                <TableCell className="text-right font-semibold tabular-nums">{entry.totalScore}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
      </motion.div>

      {leaderboard.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
            <TrophyIcon className="size-6 text-muted-foreground" />
            <p className="font-semibold">No ranked players yet</p>
            <p className="text-sm text-muted-foreground">
              Scores will appear after the first exam is settled.
            </p>
          </CardContent>
        </Card>
      ) : null}
    </motion.div>
  )
}
