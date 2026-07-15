import { TrophyIcon } from 'lucide-react'
import { useAuth } from '@/context/auth-context'
import { leaderboard } from '@/lib/mock-data'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { cn } from '@/lib/utils'

function rankStyle(rank: number) {
  if (rank === 1) return 'bg-amber-500/15 text-amber-700 dark:text-amber-400'
  if (rank === 2) return 'bg-zinc-400/15 text-zinc-600 dark:text-zinc-300'
  if (rank === 3) return 'bg-orange-600/15 text-orange-700 dark:text-orange-400'
  return 'bg-muted text-muted-foreground'
}

function initials(name: string) {
  return name
    .split(' ')
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

export function LeaderboardPage() {
  const { user } = useAuth()
  const top3 = leaderboard.slice(0, 3)
  const rest = leaderboard.slice(3)

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-1.5">
        <div className="flex items-center gap-2">
          <TrophyIcon className="size-5 text-primary" />
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            Leaderboard
          </h1>
        </div>
        <p className="text-sm text-muted-foreground">
          Season rankings across the campus pool tables.
        </p>
      </section>

      {/* Podium — stacks on mobile, row on sm+ */}
      <section className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:items-end">
        {top3.map((entry, i) => {
          const order = i === 0 ? 'sm:order-2' : i === 1 ? 'sm:order-1' : 'sm:order-3'
          const height =
            i === 0 ? 'sm:pb-8 sm:pt-6' : i === 1 ? 'sm:pb-5 sm:pt-4' : 'sm:pb-3 sm:pt-3'
          return (
            <Card
              key={entry.login}
              size="sm"
              className={cn(
                order,
                height,
                entry.login === user?.login && 'ring-2 ring-primary/40'
              )}
            >
              <CardHeader className="items-center text-center">
                <span
                  className={cn(
                    'flex size-8 items-center justify-center rounded-full text-sm font-bold tabular-nums',
                    rankStyle(entry.rank)
                  )}
                >
                  {entry.rank}
                </span>
                <Avatar className="size-12 mx-auto mt-2">
                  <AvatarFallback>{initials(entry.displayName)}</AvatarFallback>
                </Avatar>
                <CardTitle className="mt-2 text-sm sm:text-base">
                  {entry.displayName}
                </CardTitle>
                <CardDescription>@{entry.login}</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col items-center gap-1 pt-0">
                <p className="text-xl font-semibold tabular-nums">
                  {entry.points.toLocaleString()}
                </p>
                <p className="text-xs text-muted-foreground">
                  {entry.accuracy}% accuracy
                </p>
              </CardContent>
            </Card>
          )
        })}
      </section>

      {/* Full table — card list on mobile, table on md+ */}
      <section className="flex flex-col gap-3 md:hidden">
        {rest.map((entry) => (
          <Card
            key={entry.login}
            size="sm"
            className={cn(
              entry.login === user?.login && 'ring-2 ring-primary/40'
            )}
          >
            <CardContent className="flex items-center gap-3 pt-(--card-spacing)">
              <span
                className={cn(
                  'flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-bold tabular-nums',
                  rankStyle(entry.rank)
                )}
              >
                {entry.rank}
              </span>
              <Avatar size="sm">
                <AvatarFallback>{initials(entry.displayName)}</AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">
                  {entry.displayName}
                  {entry.login === user?.login && (
                    <Badge variant="secondary" className="ml-1.5 align-middle">
                      You
                    </Badge>
                  )}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  @{entry.login} · {entry.accuracy}%
                </p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-sm font-semibold tabular-nums">
                  {entry.points.toLocaleString()}
                </p>
                <p className="text-[0.65rem] text-muted-foreground">
                  {entry.streak > 0 ? `${entry.streak} streak` : '—'}
                </p>
              </div>
            </CardContent>
          </Card>
        ))}
      </section>

      <Card className="hidden md:block overflow-hidden py-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-16">Rank</TableHead>
              <TableHead>Player</TableHead>
              <TableHead className="text-right">Predictions</TableHead>
              <TableHead className="text-right">Accuracy</TableHead>
              <TableHead className="text-right">Streak</TableHead>
              <TableHead className="text-right">Points</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {leaderboard.map((entry) => (
              <TableRow
                key={entry.login}
                className={cn(
                  entry.login === user?.login && 'bg-primary/5'
                )}
              >
                <TableCell>
                  <span
                    className={cn(
                      'inline-flex size-7 items-center justify-center rounded-full text-xs font-bold tabular-nums',
                      rankStyle(entry.rank)
                    )}
                  >
                    {entry.rank}
                  </span>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2.5">
                    <Avatar size="sm">
                      <AvatarFallback>
                        {initials(entry.displayName)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col">
                      <span className="font-medium">
                        {entry.displayName}
                        {entry.login === user?.login && (
                          <Badge variant="secondary" className="ml-1.5">
                            You
                          </Badge>
                        )}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        @{entry.login}
                      </span>
                    </div>
                  </div>
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {entry.predictions}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {entry.accuracy}%
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {entry.streak > 0 ? entry.streak : '—'}
                </TableCell>
                <TableCell className="text-right font-semibold tabular-nums">
                  {entry.points.toLocaleString()}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  )
}
