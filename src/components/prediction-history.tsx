import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CheckIcon, Clock3Icon, PencilIcon, Trash2Icon, XIcon } from 'lucide-react'
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
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'

function initials(name: string) {
  return name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
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
      const predictedScore = decision === 'validate' ? Number(score) : null
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
    (score !== '' && Number.isInteger(parsedScore) && parsedScore >= 0 && parsedScore <= 100)
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
    <Card size="sm">
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
          <Badge variant="secondary">Exam {prediction.examCode}</Badge>
        </div>

        <div className="flex items-center justify-between gap-2">
          <p className="flex items-center gap-1.5 text-sm font-semibold">
            {prediction.prediction === 'validate' ? (
              <><CheckIcon className="size-4 text-emerald-600" /> Validate · {prediction.predictedScore}</>
            ) : (
              <><XIcon className="size-4 text-red-500" /> Not validate</>
            )}
          </p>
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <Clock3Icon className="size-3.5" /> {prediction.examEnded ? 'Ended' : 'Open'}
          </span>
        </div>

        {editable && !editing ? (
          <div className="grid grid-cols-2 gap-2 border-t pt-3">
            <Button type="button" size="sm" variant="outline" onClick={beginEditing}>
              <PencilIcon data-icon="inline-start" /> Change
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="text-destructive hover:text-destructive"
              onClick={() => deleteMutation.mutate()}
              disabled={deleteMutation.isPending}
            >
              <Trash2Icon data-icon="inline-start" />
              {deleteMutation.isPending ? 'Cancelling…' : 'Cancel bet'}
            </Button>
          </div>
        ) : null}

        {editable && editing ? (
          <div className="flex flex-col gap-3 rounded-lg border p-3">
            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                size="sm"
                variant={decision === 'validate' ? 'default' : 'outline'}
                onClick={() => setDecision('validate')}
              >
                Validate
              </Button>
              <Button
                type="button"
                size="sm"
                variant={decision === 'not_validate' ? 'default' : 'outline'}
                onClick={() => {
                  setDecision('not_validate')
                  setScore('')
                }}
              >
                Not validate
              </Button>
            </div>
            {decision === 'validate' ? (
              <Input
                type="number"
                min={0}
                max={100}
                step={1}
                value={score}
                onChange={(event) => setScore(event.target.value)}
                aria-label={`Exact score for @${prediction.poolerLogin}`}
                placeholder="Exact score · 0–100"
              />
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
          </div>
        ) : null}
        {mutationError ? <p className="text-xs text-destructive">{mutationError}</p> : null}
      </CardContent>
    </Card>
  )
}

export function PredictionHistory({ poolId, campusId, intraUserId, initialData }: PredictionHistoryProps) {
  const historyQuery = useQuery({
    queryKey: ['prediction-history', campusId, poolId, intraUserId],
    queryFn: () => api.predictionHistory(poolId, intraUserId, campusId),
    initialData,
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
  const predictions = historyQuery.data.predictions.toSorted(
    (left, right) => left.examCode.localeCompare(right.examCode) || left.poolerLogin.localeCompare(right.poolerLogin)
  )

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
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
              ? 'Your saved predictions across Exam 00–03.'
              : 'Only predictions from exams that have ended are visible.'}
          </p>
        </div>
      </div>

      {predictions.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            {isViewer
              ? 'You have not made a prediction in this pool yet.'
              : 'No completed-exam predictions are available for this player.'}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {predictions.map((prediction) => (
            <PredictionCard
              key={prediction.id}
              poolId={poolId}
              campusId={campusId}
              prediction={prediction}
              editable={isViewer && !prediction.examEnded}
            />
          ))}
        </div>
      )}
    </section>
  )
}
