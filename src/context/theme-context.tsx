import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

export type Theme = 'light' | 'dark' | 'system'
export type ResolvedTheme = 'light' | 'dark'

const STORAGE_KEY = 'pool-predict-theme'

type ThemeContextValue = {
  /** User preference: light, dark, or follow the machine */
  theme: Theme
  /** Actual appearance after resolving "system" */
  resolvedTheme: ResolvedTheme
  setTheme: (theme: Theme) => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

function getSystemTheme(): ResolvedTheme {
  if (typeof window === 'undefined') return 'light'
  return window.matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light'
}

function readStoredTheme(): Theme {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw === 'light' || raw === 'dark' || raw === 'system') return raw
  } catch {
    /* ignore */
  }
  return 'system'
}

function applyThemeClass(resolved: ResolvedTheme) {
  const root = document.documentElement
  root.classList.toggle('dark', resolved === 'dark')
  root.style.colorScheme = resolved

  const meta = document.querySelector('meta[name="theme-color"]')
  if (meta) {
    meta.setAttribute(
      'content',
      resolved === 'dark' ? '#001030' : '#f5f8fc'
    )
  }
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => readStoredTheme())
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>(() => {
    const preferred = readStoredTheme()
    return preferred === 'system' ? getSystemTheme() : preferred
  })

  const setTheme = useCallback((next: Theme) => {
    try {
      localStorage.setItem(STORAGE_KEY, next)
    } catch {
      /* ignore */
    }
    setThemeState(next)
  }, [])

  useEffect(() => {
    const resolved = theme === 'system' ? getSystemTheme() : theme
    setResolvedTheme(resolved)
    applyThemeClass(resolved)

    if (theme !== 'system') return

    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => {
      const next = getSystemTheme()
      setResolvedTheme(next)
      applyThemeClass(next)
    }

    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [theme])

  const value = useMemo(
    () => ({ theme, resolvedTheme, setTheme }),
    [theme, resolvedTheme, setTheme]
  )

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  )
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) {
    throw new Error('useTheme must be used within ThemeProvider')
  }
  return ctx
}
