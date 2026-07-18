import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import {
  CheckIcon,
  ChevronDownIcon,
  Clock3Icon,
  HistoryIcon,
  ListChecksIcon,
  PencilIcon,
  Trash2Icon,
  XIcon,
} from 'lucide-react'
import type {
  Prediction,
  PredictionHistoryEntryView,
  PredictionHistoryView,
} from '@shared/contracts'
import { api, ApiError } from '@/lib/api'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { GlassSurface } from '@/components/ui/glass-surface'
import { Input } from '@/components/ui/input'
import { SegmentedControl } from '@/components/ui/segmented-control'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

function initials(name: string) {
  return name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

function validationPredictionLabel(predictedScore: number | null) {
  return predictedScore === null ? 'Validate' : `Validate · exact ${predictedScore}`
}

function actualResultLabel(actualValidated: boolean | null, actualScore: number | null) {
  if (actualValidated === null) return 'Pending'
  if (!actualValidated) return 'Not validated'
  return actualScore === null ? 'Validated' : `Validated · ${actualScore}`
}

type PredictionHistoryProps = {
  poolId: string
  campusId: number
  intraUserId: number
  initialData?: PredictionHistoryView
}

type PredictionCardProps = {
  poolId: string
  campusId: number
  prediction: PredictionHistoryEntryView
  editable: boolean
}

function PredictionCard({ poolId, campusId, prediction, editable }: PredictionCardProps) {
  const queryClient = useQueryClient()
  const reducedMotion = useReducedMotion()
  const [editing, setEditing] = useState(false)
  const [decision, setDecision] = useState<Prediction>(prediction.prediction)
  const [score, setScore] = useState(prediction.predictedScore?.toString() ?? '')

  async function refreshPredictions() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['prediction-history', campusId, poolId] }),
      queryClient.invalidateQueries({ queryKey: ['bets', campusId, poolId] }),
    ])
  }

  const saveMutation = useMutation({
    mutationFn: () => {
      const predictedScore =
        decision === 'validate' && score !== '' ? Number(score) : null
      return api.saveBet(prediction.examId, prediction.poolerIntraId, campusId, {
        prediction: decision,
        predictedScore,
      })
    },
    onSuccess: async () => {
      setEditing(false)
      await refreshPredictions()
    },
  })

  const deleteMutation = useMutation({
    mutationFn: () => api.deleteBet(prediction.examId, prediction.poolerIntraId, campusId),
    onSuccess: refreshPredictions,
  })

  const parsedScore = Number(score)
  const scoreIsValid =
    decision === 'not_validate' ||
    score === '' ||
    (Number.isInteger(parsedScore) && parsedScore >= 0 && parsedScore <= 100)
  const mutationError =
    saveMutation.error instanceof ApiError
      ? saveMutation.error.message
      : deleteMutation.error instanceof ApiError
        ? deleteMutation.error.message
        : null

  function beginEditing() {
    setDecision(prediction.prediction)
    setScore(prediction.predictedScore?.toString() ?? '')
    setEditing(true)
  }

  return (
    <Card size="sm" className="hover:shadow-[var(--shadow-content-hover)]">
      <CardContent className="flex flex-col gap-4 pt-(--card-spacing)">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <Avatar size="sm">
              <AvatarImage src={prediction.poolerAvatarUrl} alt={prediction.poolerLogin} />
              <AvatarFallback>{initials(prediction.poolerDisplayName)}</AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">@{prediction.poolerLogin}</p>
              <p className="truncate text-xs text-muted-foreground">{prediction.poolerDisplayName}</p>
            </div>
          </div>
        </div>

        {prediction.examEnded ? (
          <div
            className={cn(
              'grid grid-cols-2 gap-3 rounded-xl bg-muted/26 p-3 shadow-[0_0_0_1px_var(--separator)_inset]',
              prediction.outcome === 'wrong' &&
                'bg-destructive/7 shadow-[0_0_0_1px_color-mix(in_oklch,var(--destructive),transparent_68%)_inset]',
              (prediction.outcome === 'correct' || prediction.outcome === 'exact') &&
                'bg-success/7 shadow-[0_0_0_1px_color-mix(in_oklch,var(--success),transparent_68%)_inset]'
            )}
          >
            <div className="min-w-0">
              <p className="text-[0.6875rem] font-medium uppercase tracking-wide text-muted-foreground">
                Prediction
              </p>
              <p className="mt-1 flex items-center gap-1.5 text-sm font-semibold">
                {prediction.prediction === 'validate' ? (
                  <>
                    <CheckIcon className="size-4 shrink-0" />
                    <span>
                      {validationPredictionLabel(prediction.predictedScore)}
                    </span>
                  </>
                ) : (
                  <>
                    <XIcon className="size-4 shrink-0" />
                    <span>Not validate</span>
                  </>
                )}
              </p>
            </div>
            <div className="min-w-0 border-l border-[var(--separator)] pl-3">
              <p className="text-[0.6875rem] font-medium uppercase tracking-wide text-muted-foreground">
                Actual result
              </p>
              <p className="mt-1 flex items-center gap-1.5 text-sm font-semibold">
                {prediction.actualValidated === true ? (
                  <CheckIcon className="size-4 shrink-0" />
                ) : prediction.actualValidated === false ? (
                  <XIcon className="size-4 shrink-0" />
                ) : (
                  <Clock3Icon className="size-4 shrink-0" />
                )}
                <span>
                  {actualResultLabel(prediction.actualValidated, prediction.actualScore)}
                </span>
              </p>
            </div>
            <p
              className={cn(
                'col-span-2 flex items-center gap-1.5 border-t border-[var(--separator)] pt-2 text-xs font-semibold',
                prediction.outcome === 'wrong' && 'text-destructive',
                (prediction.outcome === 'correct' || prediction.outcome === 'exact') &&
                  'text-success',
                prediction.outcome === null && 'text-muted-foreground'
              )}
            >
              {prediction.outcome === 'wrong' ? (
                <><XIcon className="size-3.5" /> Wrong guess</>
              ) : prediction.outcome === 'exact' ? (
                <><CheckIcon className="size-3.5" /> Correct · exact score</>
              ) : prediction.outcome === 'correct' ? (
                <><CheckIcon className="size-3.5" /> Correct prediction</>
              ) : (
                <><Clock3Icon className="size-3.5" /> Result pending</>
              )}
            </p>
          </div>
        ) : (
          <div className="flex min-h-10 items-center justify-between gap-2 rounded-xl bg-muted/30 px-3">
            <p className="flex items-center gap-1.5 text-sm font-semibold">
              {prediction.prediction === 'validate' ? (
                <>
                  <CheckIcon className="size-4 text-success" />
                  {validationPredictionLabel(prediction.predictedScore)}
                </>
              ) : (
                <><XIcon className="size-4 text-destructive" /> Not validate</>
              )}
            </p>
            <Badge variant="success">
              <Clock3Icon data-icon="inline-start" /> Open
            </Badge>
          </div>
        )}

        {editable && !editing ? (
          <div className="grid grid-cols-2 gap-2 border-t border-[var(--separator)] pt-3">
            <Button type="button" size="sm" variant="outline" onClick={beginEditing}>
              <PencilIcon data-icon="inline-start" /> Change
            </Button>
            <Button
              type="button"
              size="sm"
              variant="destructive"
              onClick={() => deleteMutation.mutate()}
              disabled={deleteMutation.isPending}
            >
              <Trash2Icon data-icon="inline-start" />
              {deleteMutation.isPending ? 'Cancelling…' : 'Cancel bet'}
            </Button>
          </div>
        ) : null}

        <AnimatePresence initial={false}>
          {editable && editing ? (
            <motion.div
            initial={reducedMotion ? false : { opacity: 0, y: 8, filter: 'blur(2px)' }}
            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            exit={
              reducedMotion
                ? { opacity: 0 }
                : { opacity: 0, y: -6, filter: 'blur(2px)' }
            }
            transition={{ duration: reducedMotion ? 0 : 0.18, ease: [0.2, 0, 0, 1] }}
            className="flex flex-col gap-3 rounded-xl bg-muted/34 p-3 shadow-[0_0_0_1px_var(--separator)_inset]"
          >
            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                size="sm"
                variant={decision === 'validate' ? 'success' : 'outline'}
                onClick={() => setDecision('validate')}
              >
                Validate
              </Button>
              <Button
                type="button"
                size="sm"
                variant={decision === 'not_validate' ? 'destructive-solid' : 'outline'}
                onClick={() => {
                  setDecision('not_validate')
                  setScore('')
                }}
              >
                Not validate
              </Button>
            </div>
            {decision === 'validate' ? (
              <div className="flex flex-col gap-1.5">
                <Input
                  type="number"
                  min={0}
                  max={100}
                  step={1}
                  value={score}
                  onChange={(event) => setScore(event.target.value)}
                  aria-label={`Optional exact score for @${prediction.poolerLogin}`}
                  placeholder="Optional exact score · 0–100"
                />
                <p className="text-xs text-muted-foreground">
                  Leave blank for +2. An exact score earns +3 total.
                </p>
              </div>
            ) : null}
            <div className="flex gap-2">
              <Button
                type="button"
                size="sm"
                onClick={() => saveMutation.mutate()}
                disabled={!scoreIsValid || saveMutation.isPending}
              >
                {saveMutation.isPending ? 'Saving…' : 'Save change'}
              </Button>
              <Button type="button" size="sm" variant="ghost" onClick={() => setEditing(false)}>
                Close
              </Button>
            </div>
            </motion.div>
          ) : null}
        </AnimatePresence>
        {mutationError ? <p className="text-xs text-destructive">{mutationError}</p> : null}
      </CardContent>
    </Card>
  )
}

function PredictionExamGroups({
  predictions,
  poolId,
  campusId,
  isViewer,
  emptyMessage,
}: {
  predictions: PredictionHistoryEntryView[]
  poolId: string
  campusId: number
  isViewer: boolean
  emptyMessage: string
}) {
  const groups = Array.from(
    predictions.reduce((byExam, prediction) => {
      const examPredictions = byExam.get(prediction.examCode) ?? []
      examPredictions.push(prediction)
      byExam.set(prediction.examCode, examPredictions)
      return byExam
    }, new Map<PredictionHistoryEntryView['examCode'], PredictionHistoryEntryView[]>())
  ).toSorted(([leftCode], [rightCode]) => leftCode.localeCompare(rightCode))

  if (groups.length === 0) {
    return (
      <Card className="bg-card/72">
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          {emptyMessage}
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {groups.map(([examCode, examPredictions]) => {
        const examEnded = examPredictions.every((prediction) => prediction.examEnded)
        const predictionCount = examPredictions.length

        return (
          <details
            key={examCode}
            open
            className="group overflow-hidden rounded-[1.75rem] bg-card shadow-[var(--shadow-content)]"
          >
            <summary className="flex min-h-16 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 outline-none transition-[background-color] duration-160 hover:bg-muted/42 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset [&::-webkit-details-marker]:hidden">
              <span className="flex min-w-0 items-center gap-3">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-sm font-semibold text-primary">
                  {examCode}
                </span>
                <span className="flex min-w-0 flex-col">
                  <span className="font-semibold tracking-tight">Exam {examCode}</span>
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {predictionCount} {predictionCount === 1 ? 'prediction' : 'predictions'}
                  </span>
                </span>
              </span>
              <span className="flex shrink-0 items-center gap-2">
                <Badge variant={examEnded ? 'secondary' : 'success'}>
                  {examEnded ? 'Ended' : 'Open'}
                </Badge>
                <ChevronDownIcon className="size-4 text-muted-foreground transition-transform duration-200 group-open:rotate-180" />
              </span>
            </summary>
            <div className="grid grid-cols-1 gap-3 border-t border-[var(--separator)] bg-muted/18 p-3 sm:grid-cols-2 xl:grid-cols-3">
              {examPredictions
                .toSorted((left, right) => left.poolerLogin.localeCompare(right.poolerLogin))
                .map((prediction) => (
                  <PredictionCard
                    key={prediction.id}
                    poolId={poolId}
                    campusId={campusId}
                    prediction={prediction}
                    editable={isViewer && !prediction.examEnded}
                  />
                ))}
            </div>
          </details>
        )
      })}
    </div>
  )
}

export function PredictionHistory({ poolId, campusId, intraUserId, initialData }: PredictionHistoryProps) {
  const [activeView, setActiveView] = useState<'predictions' | 'history'>('predictions')
  const historyQuery = useQuery({
    queryKey: ['prediction-history', campusId, poolId, intraUserId],
    queryFn: () => api.predictionHistory(poolId, intraUserId, campusId),
    placeholderData: initialData,
    refetchOnMount: 'always',
    staleTime: 5 * 60_000,
  })

  if (historyQuery.isPending) {
    return (
      <div className="flex flex-col gap-3">
        <Skeleton className="h-20" />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }, (_, index) => (
            <Skeleton key={index} className="h-32" />
          ))}
        </div>
      </div>
    )
  }

  if (historyQuery.error) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
          <p className="font-medium">Prediction history could not be loaded.</p>
          <p className="text-sm text-muted-foreground">Try again when 42 is available.</p>
          <Button variant="outline" onClick={() => historyQuery.refetch()}>Try again</Button>
        </CardContent>
      </Card>
    )
  }

  const { user, isViewer } = historyQuery.data
  const predictions = historyQuery.data.predictions
  const openPredictions = predictions.filter((prediction) => !prediction.examEnded)
  const previousPredictions = predictions.filter((prediction) => prediction.examEnded)

  return (
    <section className="flex flex-col gap-5">
      <GlassSurface variant="standard" className="flex items-center gap-3 rounded-[1.5rem] p-4">
        <Avatar className="size-12">
          <AvatarImage src={user.avatarUrl} alt={user.login} />
          <AvatarFallback>{initials(user.displayName)}</AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <h2 className="truncate text-lg font-semibold tracking-tight">
            {isViewer ? 'My predictions' : `@${user.login}'s predictions`}
          </h2>
          <p className="text-sm text-muted-foreground">
            {isViewer
              ? 'Review your open predictions or revisit previous exams.'
              : 'Only predictions from exams that have ended are visible.'}
          </p>
        </div>
      </GlassSurface>

      {isViewer ? (
        <>
          <SegmentedControl
            id="prediction-history-view"
            value={activeView}
            onValueChange={setActiveView}
            ariaLabel="My prediction views"
            items={[
              {
                value: 'predictions',
                label: 'My predictions',
                icon: ListChecksIcon,
                count: openPredictions.length,
                controls: 'my-predictions-panel',
              },
              {
                value: 'history',
                label: 'History',
                icon: HistoryIcon,
                count: previousPredictions.length,
                controls: 'prediction-history-panel',
              },
            ]}
          />

          {activeView === 'predictions' ? (
            <div id="my-predictions-panel" role="tabpanel">
              <PredictionExamGroups
                predictions={openPredictions}
                poolId={poolId}
                campusId={campusId}
                isViewer
                emptyMessage="You do not have any predictions for an open exam."
              />
            </div>
          ) : (
            <div id="prediction-history-panel" role="tabpanel">
              <PredictionExamGroups
                predictions={previousPredictions}
                poolId={poolId}
                campusId={campusId}
                isViewer
                emptyMessage="Your prediction history is empty."
              />
            </div>
          )}
        </>
      ) : (
        <PredictionExamGroups
          predictions={previousPredictions}
          poolId={poolId}
          campusId={campusId}
          isViewer={false}
          emptyMessage="No completed-exam predictions are available for this player."
        />
      )}
    </section>
  )
}
