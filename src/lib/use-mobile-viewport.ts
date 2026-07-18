import { useSyncExternalStore } from 'react'

const MOBILE_VIEWPORT_QUERY = '(max-width: 767px)'

function subscribe(onChange: () => void) {
  const mediaQuery = window.matchMedia(MOBILE_VIEWPORT_QUERY)
  mediaQuery.addEventListener('change', onChange)
  return () => mediaQuery.removeEventListener('change', onChange)
}

function getSnapshot() {
  return window.matchMedia(MOBILE_VIEWPORT_QUERY).matches
}

function getServerSnapshot() {
  return false
}

export function useMobileViewport() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}
