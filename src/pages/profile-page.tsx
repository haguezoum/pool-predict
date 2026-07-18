import {
  CrosshairIcon,
  LogOutIcon,
  MapPinIcon,
  MinusCircleIcon,
  TargetIcon,
  TrophyIcon,
} from 'lucide-react'
import { motion, useReducedMotion } from 'motion/react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/auth-context'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { GlassSurface } from '@/components/ui/glass-surface'
import { Separator } from '@/components/ui/separator'

export function ProfilePage() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const reducedMotion = useReducedMotion()
  if (!user) return null

  const initials = user.displayName.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase()
  const stats = [
    { label: 'Total score', value: user.totalScore.toLocaleString(), icon: TrophyIcon },
    { label: 'Shared rank', value: `#${user.rank}`, icon: TargetIcon },
    { label: 'Accuracy', value: `${user.accuracy}%`, icon: CrosshairIcon },
    { label: 'Missed exams', value: String(user.missedExams), icon: MinusCircleIcon },
  ]

  function handleLogout() {
    void logout().then(() => navigate('/login', { replace: true }))
  }

  return (
    <motion.div
      className="flex flex-col gap-7"
      initial={reducedMotion ? false : 'hidden'}
      animate="visible"
      variants={{
        hidden: {},
        visible: { transition: { staggerChildren: reducedMotion ? 0 : 0.07 } },
      }}
    >
      <motion.section
        variants={{
          hidden: { opacity: 0, y: 10, filter: 'blur(3px)' },
          visible: { opacity: 1, y: 0, filter: 'blur(0px)' },
        }}
        transition={{ duration: 0.24, ease: [0.2, 0, 0, 1] }}
      >
      <GlassSurface variant="standard" className="rounded-[2rem] p-1">
        <Card className="bg-transparent shadow-none">
        <CardHeader className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <Avatar className="size-16 sm:size-20">
              <AvatarImage src={user.avatarUrl} alt={user.login} />
              <AvatarFallback className="text-lg">{initials}</AvatarFallback>
            </Avatar>
            <div className="flex min-w-0 flex-col gap-1">
              <CardTitle className="truncate text-xl sm:text-2xl">{user.displayName}</CardTitle>
              <CardDescription className="flex flex-wrap items-center gap-2">
                <span>@{user.login}</span>
                <Badge variant="secondary" className="font-normal">42 core</Badge>
              </CardDescription>
              <p className="flex items-center gap-1 text-xs text-muted-foreground">
                <MapPinIcon className="size-3.5" /> {user.campus}
              </p>
            </div>
          </div>
          <Button variant="outline" className="w-full sm:w-auto" onClick={handleLogout}>
            <LogOutIcon data-icon="inline-start" /> Log out
          </Button>
        </CardHeader>
        </Card>
      </GlassSurface>
      </motion.section>

      <motion.section
        variants={{
          hidden: { opacity: 0, y: 10 },
          visible: { opacity: 1, y: 0 },
        }}
        transition={{ duration: 0.22, ease: [0.2, 0, 0, 1] }}
        className="grid grid-cols-2 gap-3 lg:grid-cols-4"
      >
        {stats.map(({ label, value, icon: Icon }) => (
          <Card key={label} size="sm" className="hover:bg-card/96">
            <CardContent className="flex flex-col gap-2 pt-(--card-spacing)">
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Icon className="size-3.5" /> <span className="text-xs">{label}</span>
              </div>
              <p className="text-2xl font-semibold tabular-nums tracking-tight">{value}</p>
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
      <Card>
        <CardHeader>
          <CardTitle>Current pool record</CardTitle>
          <CardDescription>Settled prediction events from Exam 00–03</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="grid grid-cols-3 gap-3 text-center sm:gap-6">
            <div className="flex flex-col gap-1">
              <span className="text-2xl font-semibold tabular-nums text-success">{user.correct}</span>
              <span className="text-xs text-muted-foreground">Correct</span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-2xl font-semibold tabular-nums">{user.exactHits}</span>
              <span className="text-xs text-muted-foreground">Exact +3</span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-2xl font-semibold tabular-nums text-destructive">{user.wrong}</span>
              <span className="text-xs text-muted-foreground">Wrong</span>
            </div>
          </div>
          <Separator />
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Settled predictions</span>
            <span className="font-medium tabular-nums">{user.predictions}</span>
          </div>
          <div
            className="h-2.5 overflow-hidden rounded-full bg-muted"
            role="progressbar"
            aria-label="Prediction accuracy"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={user.accuracy}
          >
            <motion.div
              className="h-full rounded-full bg-primary"
              initial={reducedMotion ? false : { width: 0 }}
              animate={{ width: `${user.accuracy}%` }}
              transition={{ duration: reducedMotion ? 0 : 0.3, ease: [0.2, 0, 0, 1] }}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Each exam with zero predictions adds one −2 event. Partial participation avoids it.
          </p>
        </CardContent>
      </Card>
      </motion.div>
    </motion.div>
  )
}
