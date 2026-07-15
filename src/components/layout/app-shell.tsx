import { useState } from 'react'
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'
import {
  HomeIcon,
  LogOutIcon,
  MenuIcon,
  TrophyIcon,
  UserIcon,
} from 'lucide-react'
import { useAuth } from '@/context/auth-context'
import { ThemeToggle } from '@/components/theme-toggle'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { cn } from '@/lib/utils'

const navItems = [
  { to: '/', label: 'Home', icon: HomeIcon, end: true },
  { to: '/leaderboard', label: 'Leaderboard', icon: TrophyIcon, end: false },
  { to: '/profile', label: 'Profile', icon: UserIcon, end: false },
] as const

function NavLinks({
  onNavigate,
  className,
}: {
  onNavigate?: () => void
  className?: string
}) {
  return (
    <nav className={cn('flex flex-col gap-1 md:flex-row md:items-center', className)}>
      {navItems.map(({ to, label, icon: Icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          onClick={onNavigate}
          className={({ isActive }) =>
            cn(
              'flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors md:py-2',
              isActive
                ? 'bg-primary/10 text-primary'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            )
          }
        >
          <Icon className="size-4 shrink-0" />
          {label}
        </NavLink>
      ))}
    </nav>
  )
}

export function AppShell() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [mobileOpen, setMobileOpen] = useState(false)

  const initials =
    user?.displayName
      .split(' ')
      .map((p) => p[0])
      .join('')
      .slice(0, 2)
      .toUpperCase() ?? '?'

  function handleLogout() {
    logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className="flex min-h-svh flex-col bg-background">
      <header className="sticky top-0 z-40 border-b border-border/80 bg-background/85 backdrop-blur-md">
        <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between gap-3 px-4 sm:h-16 sm:px-6">
          <div className="flex items-center gap-2 sm:gap-3">
            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
              <SheetTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="md:hidden"
                  aria-label="Open menu"
                >
                  <MenuIcon />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-[min(100%,18rem)] p-0">
                <SheetHeader className="border-b px-4 py-4 text-left">
                  <SheetTitle className="flex items-center gap-2 font-semibold tracking-tight">
                    <img
                      src="/logo.png"
                      alt=""
                      className="size-8 rounded-lg object-contain"
                    />
                    1337 Pool
                  </SheetTitle>
                </SheetHeader>
                <div className="p-3">
                  <NavLinks onNavigate={() => setMobileOpen(false)} />
                </div>
              </SheetContent>
            </Sheet>

            <Link
              to="/"
              className="flex items-center gap-2 font-semibold tracking-tight"
            >
              <img
                src="/logo.png"
                alt=""
                className="size-8 rounded-lg object-contain shadow-sm"
              />
              <span className="hidden sm:inline">1337 Pool</span>
            </Link>
          </div>

          <NavLinks className="hidden md:flex" />

          <div className="flex items-center gap-1">
            <ThemeToggle />

            {user && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    className="h-auto gap-2 rounded-full py-1 pl-1 pr-2 sm:pr-3"
                  >
                    <Avatar size="sm">
                      <AvatarImage src={user.avatarUrl} alt={user.login} />
                      <AvatarFallback>{initials}</AvatarFallback>
                    </Avatar>
                    <span className="hidden max-w-28 truncate text-sm font-medium sm:inline">
                      {user.login}
                    </span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-52">
                  <DropdownMenuLabel className="font-normal">
                    <div className="flex flex-col gap-0.5">
                      <span className="font-medium">{user.displayName}</span>
                      <span className="text-xs text-muted-foreground">
                        @{user.login}
                      </span>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuGroup>
                    <DropdownMenuItem asChild>
                      <Link to="/profile">
                        <UserIcon />
                        Profile
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link to="/leaderboard">
                        <TrophyIcon />
                        Leaderboard
                      </Link>
                    </DropdownMenuItem>
                  </DropdownMenuGroup>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem variant="destructive" onClick={handleLogout}>
                    <LogOutIcon />
                    Log out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 sm:px-6 sm:py-8">
        <Outlet />
      </main>

      <footer className="border-t border-border/60 py-4 text-center text-xs text-muted-foreground">
        1337 Pool · 42 Network
      </footer>
    </div>
  )
}
