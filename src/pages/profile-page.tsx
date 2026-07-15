import {
  CrosshairIcon,
  FlameIcon,
  LogOutIcon,
  MapPinIcon,
  TargetIcon,
  TrophyIcon,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/auth-context'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'

export function ProfilePage() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  if (!user) return null

  const initials = user.displayName
    .split(' ')
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

  const winRate =
    user.wins + user.losses > 0
      ? Math.round((user.wins / (user.wins + user.losses)) * 100)
      : 0

  function handleLogout() {
    logout()
    navigate('/login', { replace: true })
  }

  const stats = [
    {
      label: 'Points',
      value: user.points.toLocaleString(),
      icon: TrophyIcon,
    },
    {
      label: 'Rank',
      value: `#${user.rank}`,
      icon: TargetIcon,
    },
    {
      label: 'Accuracy',
      value: `${user.accuracy}%`,
      icon: CrosshairIcon,
    },
    {
      label: 'Streak',
      value: String(user.streak),
      icon: FlameIcon,
    },
  ]

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-1.5">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          Profile
        </h1>
        <p className="text-sm text-muted-foreground">
          Your prediction record and campus identity.
        </p>
      </section>

      <Card>
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <Avatar className="size-16 sm:size-20">
              <AvatarImage src={user.avatarUrl} alt={user.login} />
              <AvatarFallback className="text-lg">{initials}</AvatarFallback>
            </Avatar>
            <div className="flex min-w-0 flex-col gap-1">
              <CardTitle className="truncate text-xl sm:text-2xl">
                {user.displayName}
              </CardTitle>
              <CardDescription className="flex flex-wrap items-center gap-2">
                <span>@{user.login}</span>
                <Badge variant="secondary" className="font-normal">
                  lvl {user.level}
                </Badge>
              </CardDescription>
              <p className="flex items-center gap-1 text-xs text-muted-foreground">
                <MapPinIcon className="size-3.5" />
                {user.campus}
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            className="w-full sm:w-auto"
            onClick={handleLogout}
          >
            <LogOutIcon data-icon="inline-start" />
            Log out
          </Button>
        </CardHeader>
      </Card>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map(({ label, value, icon: Icon }) => (
          <Card key={label} size="sm">
            <CardContent className="flex flex-col gap-2 pt-(--card-spacing)">
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Icon className="size-3.5" />
                <span className="text-xs">{label}</span>
              </div>
              <p className="text-2xl font-semibold tabular-nums tracking-tight">
                {value}
              </p>
            </CardContent>
          </Card>
        ))}
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Season record</CardTitle>
          <CardDescription>
            Wins and losses from settled predictions
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="grid grid-cols-3 gap-3 text-center sm:gap-6">
            <div className="flex flex-col gap-1">
              <span className="text-2xl font-semibold tabular-nums text-primary">
                {user.wins}
              </span>
              <span className="text-xs text-muted-foreground">Wins</span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-2xl font-semibold tabular-nums">
                {user.losses}
              </span>
              <span className="text-xs text-muted-foreground">Losses</span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-2xl font-semibold tabular-nums">
                {winRate}%
              </span>
              <span className="text-xs text-muted-foreground">Win rate</span>
            </div>
          </div>

          <Separator />

          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Total predictions</span>
              <span className="font-medium tabular-nums">{user.predictions}</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{ width: `${winRate}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              {user.wins} of {user.wins + user.losses} settled picks correct
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
