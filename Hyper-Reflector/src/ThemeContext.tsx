import { createContext, useContext, useState } from 'react'
import {
  getThemeById,
  resolveVars,
  DEFAULT_THEME_ID,
  type V2Theme,
  type ThemeVars,
  type ThemeOverrides,
  type ThemePreference,
} from './theme'

type ThemeContextValue = {
  theme: V2Theme
  vars: ThemeVars
  overrides: ThemeOverrides
  setThemeId: (id: string) => void
  setOverride: (key: keyof ThemeOverrides, value: string) => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

const STORAGE_KEY = 'v2_theme_pref'

function loadPref(): ThemePreference {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw) as ThemePreference
  } catch { /* ignore */ }
  return { id: DEFAULT_THEME_ID }
}

function savePref(pref: ThemePreference) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(pref))
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [pref, setPref] = useState<ThemePreference>(() => loadPref())

  const theme = getThemeById(pref.id)
  const overrides = pref.overrides ?? {}
  const vars = resolveVars(theme, overrides)

  const setThemeId = (id: string) => {
    const next: ThemePreference = { ...pref, id }
    setPref(next)
    savePref(next)
  }

  const setOverride = (key: keyof ThemeOverrides, value: string) => {
    const next: ThemePreference = {
      ...pref,
      overrides: { ...pref.overrides, [key]: value },
    }
    setPref(next)
    savePref(next)
  }

  return (
    <ThemeContext.Provider value={{ theme, vars, overrides, setThemeId, setOverride }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useV2Theme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useV2Theme must be inside ThemeProvider')
  return ctx
}
