import { useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'motion/react'
import { CheckIcon, Maximize2Icon, XIcon } from 'lucide-react'
import { useAuth } from '@/context/auth-context'
import { matches } from '@/lib/mock-data'
import type { Match } from '@/types'
import { FridayLineChart } from '@/components/friday-line-chart'
import { PlayerDetailDialog } from '@/components/player-detail-dialog'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardFooter,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

type Decision = 'validate' | 'not-validate' | null

function initials(name: string) {
  return name
    .split(' ')
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

function MatchCard({ match }: { match: Match }) {
  const [decision, setDecision] = useState<Decision>(null)
  const [score, setScore] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [expanded, setExpanded] = useState(false)

  function handleValidate() {
    setDecision('validate')
    setSubmitted(false)
  }

  function handleNotValidate() {
    setDecision('not-validate')
    setScore('')
    setSubmitted(true)
  }

  function handleSubmitScore(e: React.FormEvent) {
    e.preventDefault()
    if (!score.trim()) return
    setSubmitted(true)
  }

  return (
    <>
      <motion.div
        layout
        whileHover={{ y: -2 }}
        transition={{ type: 'spring', stiffness: 400, damping: 28 }}
        className="relative z-0 transition-[z-index] hover:z-30 focus-within:z-30"
      >
      <Card size="sm" className="relative h-full overflow-visible">
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="absolute top-2 right-2 z-10 text-muted-foreground transition-transform duration-200 hover:scale-110 hover:text-foreground active:scale-95"
          aria-label={`Expand @${match.login} details`}
          onClick={() => setExpanded(true)}
        >
          <Maximize2Icon />
        </Button>

        <CardContent className="flex flex-col gap-4 pt-(--card-spacing)">
          {/* Avatar left · login + full name right */}
          <div className="flex items-center gap-3 pr-8">
            <Avatar className="size-14 shrink-0 sm:size-16">
              <AvatarImage src={match.avatarUrl} alt={match.login} />
              <AvatarFallback className="text-base">
                {initials(match.fullName)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex flex-col gap-0.5">
              <p className="truncate text-base font-semibold tracking-tight">
                @{match.login}
              </p>
              <p className="truncate text-sm text-muted-foreground">
                {match.fullName}
              </p>
            </div>
          </div>

          {/* Validate / Not validate */}
          <div className="grid grid-cols-2 gap-2">
            <Button
              type="button"
              size="sm"
              variant={decision === 'validate' ? 'default' : 'outline'}
              className={cn(
                'w-full',
                decision === 'validate' &&
                  'bg-emerald-600 text-white hover:bg-emerald-600/90 dark:bg-emerald-500 dark:hover:bg-emerald-500/90'
              )}
              onClick={handleValidate}
              disabled={submitted && decision === 'not-validate'}
            >
              <CheckIcon data-icon="inline-start" />
              Validate
            </Button>
            <Button
              type="button"
              size="sm"
              variant={decision === 'not-validate' ? 'default' : 'outline'}
              className={cn(
                'w-full',
                decision === 'not-validate' &&
                  'bg-red-600 text-white hover:bg-red-600/90 dark:bg-red-500 dark:hover:bg-red-500/90'
              )}
              onClick={handleNotValidate}
              disabled={submitted && decision === 'validate'}
            >
              <XIcon data-icon="inline-start" />
              Not validate
            </Button>
          </div>

          {/* Exact score when validating */}
          {decision === 'validate' && !submitted && (
            <form
              onSubmit={handleSubmitScore}
              className="flex flex-col gap-2 rounded-lg border border-border p-3"
            >
              <Label htmlFor={`score-${match.id}`} className="text-xs">
                Exact score
              </Label>
              <div className="flex gap-2">
                <Input
                  id={`score-${match.id}`}
                  value={score}
                  onChange={(e) => setScore(e.target.value)}
                  placeholder="e.g. 85"
                  className="h-8"
                  autoFocus
                  required
                />
                <Button type="submit" size="sm" disabled={!score.trim()}>
                  Submit
                </Button>
              </div>
            </form>
          )}

          {submitted && decision === 'validate' && (
            <p className="text-xs text-emerald-600 dark:text-emerald-400">
              Validated · score <span className="font-medium">{score}</span>
            </p>
          )}
          {submitted && decision === 'not-validate' && (
            <p className="text-xs text-red-600 dark:text-red-400">
              Marked as not validated
            </p>
          )}
        </CardContent>

        <CardFooter className="relative z-10 flex-col items-stretch overflow-visible">
          <FridayLineChart fridays={match.fridays} login={match.login} />
        </CardFooter>
      </Card>
      </motion.div>

      <PlayerDetailDialog
        match={match}
        open={expanded}
        onOpenChange={setExpanded}
      />
    </>
  )
}

export function HomePage() {
  const { user } = useAuth()

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
          Hey, <span className="text-primary">@{user?.login}</span>
        </p>
        <Button asChild variant="secondary" className="w-full sm:w-auto">
          <Link to="/leaderboard">View leaderboard</Link>
        </Button>
      </section>

      <section className="flex gap-8 sm:gap-12">
        <p className="flex flex-col gap-0.5">
          <span className="text-xs text-muted-foreground">Rank</span>
          <span className="font-display text-5xl leading-none tracking-wide text-blue-500 sm:text-6xl dark:text-blue-400">
            #{user?.rank}
          </span>
        </p>
        <p className="flex flex-col gap-0.5">
          <span className="text-xs text-muted-foreground">Points</span>
          <span className="text-3xl font-semibold tracking-tight tabular-nums text-blue-500 sm:text-4xl dark:text-blue-400">
            {user?.points.toLocaleString()}
          </span>
        </p>
      </section>

      <section className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-lg font-semibold tracking-tight">Players</h2>
          <span className="text-xs text-muted-foreground tabular-nums">
            {matches.length} total
          </span>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {matches.map((match) => (
            <MatchCard key={match.id} match={match} />
          ))}
        </div>
      </section>
    </div>
  )
}
