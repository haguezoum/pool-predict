import { useQuery } from '@tanstack/react-query'
import { CheckIcon, Clock3Icon, XIcon } from 'lucide-react'
import { api } from '@/lib/api'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
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
  intraUserId: number
}

export function PredictionHistory({ poolId, intraUserId }: PredictionHistoryProps) {
  const historyQuery = useQuery({
    queryKey: ['prediction-history', poolId, intraUserId],
    queryFn: () => api.predictionHistory(poolId, intraUserId),
    staleTime: 60_000,
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
            <Card key={prediction.id} size="sm">
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
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </section>
  )
}
