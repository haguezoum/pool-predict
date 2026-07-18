import { useQuery } from '@tanstack/react-query'
import { motion, useReducedMotion } from 'motion/react'
import { ArrowLeftIcon } from 'lucide-react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { PredictionHistory } from '@/components/prediction-history'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { api } from '@/lib/api'
import { useMobileViewport } from '@/lib/use-mobile-viewport'
import { useAuth } from '@/context/auth-context'

export function PlayerProfilePage() {
  const { user } = useAuth()
  const reducedMotion = useReducedMotion()
  const mobileViewport = useMobileViewport()
  const streamlinedMotion = Boolean(reducedMotion) || mobileViewport
  const { intraUserId: intraUserIdParam } = useParams()
  const [searchParams] = useSearchParams()
  const requestedPoolId = searchParams.get('poolId')
  const intraUserId = Number(intraUserIdParam)
  const poolQuery = useQuery({
    queryKey: ['pool', user?.campusId, 'current'],
    queryFn: () => api.currentPool(user!.campusId),
    enabled: !requestedPoolId && Boolean(user?.campusId),
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
    <motion.div
      className="flex flex-col gap-6"
      initial={streamlinedMotion ? false : { opacity: 0, y: 10, filter: 'blur(3px)' }}
      animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
      transition={{ duration: streamlinedMotion ? 0 : 0.22, ease: [0.2, 0, 0, 1] }}
    >
      <Button asChild variant="ghost" className="w-fit">
        <Link to="/leaderboard"><ArrowLeftIcon data-icon="inline-start" /> Back to leaderboard</Link>
      </Button>
      {poolId && user ? (
        <PredictionHistory
          poolId={poolId}
          campusId={user.campusId}
          intraUserId={intraUserId}
        />
      ) : null}
    </motion.div>
  )
}
