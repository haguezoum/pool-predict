import { useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import {
  HomeIcon,
  LogOutIcon,
  PanelLeftCloseIcon,
  PanelLeftOpenIcon,
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
import { GlassSurface } from '@/components/ui/glass-surface'
import { cn } from '@/lib/utils'
import { useMobileViewport } from '@/lib/use-mobile-viewport'

const navItems = [
  { to: '/', label: 'Home', shortLabel: 'Home', icon: HomeIcon, end: true },
  {
    to: '/leaderboard',
    label: 'Leaderboard',
    shortLabel: 'Ranks',
    icon: TrophyIcon,
    end: false,
  },
  { to: '/profile', label: 'Profile', shortLabel: 'Profile', icon: UserIcon, end: false },
] as const

const pageTitles: Record<string, string> = {
  '/': 'Pool overview',
  '/leaderboard': 'Leaderboard',
  '/profile': 'Profile',
}

const SIDEBAR_COLLAPSED_STORAGE_KEY = 'pool-predict.sidebar-collapsed'

function NavLinks({
  scope,
  mobile = false,
  collapsed = false,
}: {
  scope: string
  mobile?: boolean
  collapsed?: boolean
}) {
  const reducedMotion = useReducedMotion()

  return (
    <nav
      aria-label={mobile ? 'Mobile navigation' : 'Main navigation'}
      className={cn(
        mobile
          ? 'grid grid-cols-3 gap-1'
          : cn('flex flex-col gap-1', collapsed && 'items-center')
      )}
    >
      {navItems.map(({ to, label, shortLabel, icon: Icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          className={({ isActive }) =>
            cn(
              'group relative flex min-h-11 items-center rounded-xl outline-none transition-[color,scale] duration-160 active:scale-[0.96]',
              mobile
                ? 'flex-col justify-center gap-0.5 px-2 py-1 text-[0.67rem]'
                : collapsed
                  ? 'size-11 justify-center p-0'
                  : 'gap-3 px-3 py-2.5 text-[0.8125rem] font-medium',
              isActive
                ? 'text-primary'
                : mobile
                  ? 'text-muted-foreground hover:text-foreground'
                  : 'text-[var(--sidebar-label)] hover:text-sidebar-foreground'
            )
          }
          aria-label={!mobile && collapsed ? label : undefined}
          title={!mobile && collapsed ? label : undefined}
        >
          {({ isActive }) => (
            <>
              {isActive ? (
                <motion.span
                  layoutId={`nav-selection-${scope}`}
                  className={cn(
                    'absolute inset-0 bg-[var(--sidebar-selection)]',
                    mobile ? 'rounded-xl' : collapsed ? 'rounded-[0.8rem]' : 'rounded-lg'
                  )}
                  transition={
                    reducedMotion
                      ? { duration: 0 }
                      : { type: 'spring', duration: 0.3, bounce: 0 }
                  }
                />
              ) : null}
              <Icon
                aria-hidden
                className={cn(
                  'relative z-10 shrink-0 transition-[color,scale] duration-160',
                  mobile ? 'size-[1.1rem]' : 'size-[1rem]',
                  isActive && 'text-primary'
                )}
              />
              {mobile || !collapsed ? (
                <span className="relative z-10">{mobile ? shortLabel : label}</span>
              ) : null}
            </>
          )}
        </NavLink>
      ))}
    </nav>
  )
}

function UserMenu({ compact = false }: { compact?: boolean }) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  if (!user) return null

  const initials = user.displayName
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

  function handleLogout() {
    void logout().then(() => navigate('/login', { replace: true }))
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className={cn(
            'rounded-2xl',
            compact
              ? 'size-10 p-0'
              : 'h-auto w-full justify-start gap-3 px-2 py-2 text-left'
          )}
          aria-label={compact ? `Open @${user.login} account menu` : undefined}
        >
          <Avatar size={compact ? 'default' : 'lg'}>
            <AvatarImage src={user.avatarUrl} alt={user.login} />
            <AvatarFallback>{initials}</AvatarFallback>
          </Avatar>
          {!compact ? (
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold">{user.displayName}</span>
              <span className="block truncate text-xs font-normal text-muted-foreground">
                @{user.login}
              </span>
            </span>
          ) : null}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align={compact ? 'end' : 'start'} sideOffset={8} className="w-56">
        <DropdownMenuLabel className="font-normal">
          <span className="flex flex-col gap-0.5">
            <span className="font-semibold">{user.displayName}</span>
            <span className="text-xs text-muted-foreground">@{user.login}</span>
          </span>
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
        <DropdownMenuGroup>
          <DropdownMenuItem variant="destructive" onClick={handleLogout}>
            <LogOutIcon />
            Log out
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export function AppShell() {
  const location = useLocation()
  const reducedMotion = useReducedMotion()
  const mobileViewport = useMobileViewport()
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    try {
      return localStorage.getItem(SIDEBAR_COLLAPSED_STORAGE_KEY) === '1'
    } catch {
      return false
    }
  })
  const pageTitle =
    pageTitles[location.pathname] ??
    (location.pathname.startsWith('/profile/') ? 'Player profile' : '1337X Bet')

  function toggleSidebar() {
    setSidebarCollapsed((current) => {
      const next = !current
      try {
        localStorage.setItem(SIDEBAR_COLLAPSED_STORAGE_KEY, next ? '1' : '0')
      } catch {
        // The sidebar still works when storage is unavailable.
      }
      return next
    })
  }

  return (
    <div
      className={cn(
        'app-atmosphere min-h-svh md:grid md:transition-[grid-template-columns] md:duration-240 md:ease-[cubic-bezier(0.2,0,0,1)]',
        sidebarCollapsed
          ? 'md:grid-cols-[4.75rem_minmax(0,1fr)]'
          : 'md:grid-cols-[15rem_minmax(0,1fr)]'
      )}
    >
      <aside className="sticky top-0 hidden h-svh p-3 pr-0 md:block">
        <GlassSurface
          variant="regular"
          className={cn(
            'sidebar-surface flex h-full flex-col rounded-2xl transition-[padding] duration-200',
            sidebarCollapsed ? 'p-2' : 'p-3'
          )}
        >
          <div
            className={cn(
              'mb-4 flex min-h-12 items-center',
              sidebarCollapsed ? 'justify-center' : 'gap-1'
            )}
          >
            {!sidebarCollapsed ? (
              <Link
                to="/"
                className="flex min-w-0 flex-1 items-center gap-2 rounded-xl px-1 outline-none"
              >
                <span className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-background/46">
                  <img
                    src="/wa-validi.webp"
                    alt=""
                    className="h-10 w-auto translate-y-1 object-contain"
                  />
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-[0.8125rem] font-semibold tracking-[-0.01em]">
                    1337X Bet
                  </span>
                  <span className="block truncate text-[0.6875rem] text-[var(--sidebar-label)]">
                    Pool predictor
                  </span>
                </span>
              </Link>
            ) : null}
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="shrink-0 rounded-xl text-[var(--sidebar-label)] hover:bg-[var(--sidebar-selection)] hover:text-sidebar-foreground"
              onClick={toggleSidebar}
              aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              {sidebarCollapsed ? <PanelLeftOpenIcon /> : <PanelLeftCloseIcon />}
            </Button>
          </div>

          <NavLinks scope="desktop" collapsed={sidebarCollapsed} />

          <div
            className={cn(
              'mt-auto flex flex-col',
              sidebarCollapsed ? 'items-center gap-2' : 'gap-2'
            )}
          >
            {!sidebarCollapsed ? (
              <>
                <div className="px-3 text-[0.6875rem] font-semibold text-[var(--sidebar-label)]">
                  Appearance
                </div>
                <div className="flex items-center justify-between rounded-xl bg-black/4 p-1 dark:bg-white/5">
                  <span className="pl-2 text-xs text-[var(--sidebar-label)]">Theme</span>
                  <ThemeToggle />
                </div>
              </>
            ) : (
              <ThemeToggle />
            )}
            <UserMenu compact={sidebarCollapsed} />
            {!sidebarCollapsed ? (
              <p className="px-3 pb-1 text-[0.65rem] text-[var(--sidebar-label-muted)]">
                1337 Pool · 42 Network
              </p>
            ) : null}
          </div>
        </GlassSurface>
      </aside>

      <div className="flex min-w-0 flex-col">
        <header className="sticky top-0 z-40 px-3 pt-3 md:px-5 md:pt-3">
          <GlassSurface
            variant="clear"
            className="flex min-h-14 items-center justify-between gap-3 rounded-2xl px-3 py-2 md:px-4"
          >
            <div className="flex min-w-0 items-center gap-2.5">
              <Link
                to="/"
                className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-background/48 md:hidden"
                aria-label="Go home"
              >
                <img
                  src="/wa-validi.webp"
                  alt=""
                  className="h-10 w-auto translate-y-1 object-contain"
                />
              </Link>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold tracking-[-0.01em]">{pageTitle}</p>
                <p className="hidden text-xs text-muted-foreground sm:block">
                  Live pool predictions and progress
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <div className="md:hidden">
                <ThemeToggle />
              </div>
              <div className="md:hidden">
                <UserMenu compact />
              </div>
              <span className="hidden items-center gap-2 text-xs text-muted-foreground md:flex">
                <span className="size-2 rounded-full bg-success" />
                Live
              </span>
            </div>
          </GlassSurface>
        </header>

        <AnimatePresence initial={false} mode="wait">
          <motion.main
            key={location.pathname}
            className="mx-auto w-full max-w-7xl flex-1 px-4 pt-6 pb-[calc(env(safe-area-inset-bottom)+7.5rem)] sm:px-6 sm:pt-8 md:px-8 md:pb-10 lg:px-10"
            initial={
              reducedMotion
                ? false
                : mobileViewport
                  ? { opacity: 0, y: 4 }
                  : { opacity: 0, y: 10, filter: 'blur(3px)' }
            }
            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            exit={
              reducedMotion
                ? { opacity: 0 }
                : mobileViewport
                  ? { opacity: 0, y: -3 }
                  : { opacity: 0, y: -6, filter: 'blur(2px)' }
            }
            transition={{
              duration: reducedMotion ? 0 : mobileViewport ? 0.14 : 0.22,
              ease: [0.2, 0, 0, 1],
            }}
          >
            <Outlet />
          </motion.main>
        </AnimatePresence>

        <footer className="hidden py-5 text-center text-[0.68rem] text-muted-foreground md:block">
          Predictions stay private until each exam ends.
        </footer>
      </div>

      <GlassSurface
        variant="elevated"
        className="fixed right-3 bottom-[calc(env(safe-area-inset-bottom)+0.75rem)] left-3 z-40 rounded-[1.35rem] p-1.5 md:hidden"
      >
        <NavLinks scope="mobile" mobile />
      </GlassSurface>
    </div>
  )
}
