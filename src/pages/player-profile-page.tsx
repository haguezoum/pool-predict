import { useQuery } from '@tanstack/react-query'
import { ArrowLeftIcon } from 'lucide-react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { PredictionHistory } from '@/components/prediction-history'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { api } from '@/lib/api'

export function PlayerProfilePage() {
  const { intraUserId: intraUserIdParam } = useParams()
  const [searchParams] = useSearchParams()
  const requestedPoolId = searchParams.get('poolId')
  const intraUserId = Number(intraUserIdParam)
  const poolQuery = useQuery({
    queryKey: ['pool', 'current'],
    queryFn: api.currentPool,
    enabled: !requestedPoolId,
    staleTime: 5 * 60_000,
  })
  const poolId = requestedPoolId ?? poolQuery.data?.id

  if (!Number.isInteger(intraUserId) || intraUserId <= 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
          <p className="font-medium">This player profile is invalid.</p>
          <Button asChild variant="outline"><Link to="/leaderboard">Back to leaderboard</Link></Button>
        </CardContent>
      </Card>
    )
  }

  if (!requestedPoolId && poolQuery.isPending) return <Skeleton className="h-80" />

  if (!requestedPoolId && poolQuery.error) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
          <p className="font-medium">The selected pool could not be loaded.</p>
          <Button variant="outline" onClick={() => poolQuery.refetch()}>Try again</Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <Button asChild variant="ghost" className="w-fit px-0 hover:bg-transparent">
        <Link to="/leaderboard"><ArrowLeftIcon data-icon="inline-start" /> Back to leaderboard</Link>
      </Button>
      {poolId ? <PredictionHistory poolId={poolId} intraUserId={intraUserId} /> : null}
    </div>
  )
}
