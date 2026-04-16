export type ThemeVars = {
  '--v2-bg': string
  '--v2-surface': string
  '--v2-hover': string
  '--v2-border': string
  '--v2-accent': string
  '--v2-accent-hover': string
  '--v2-accent-fg': string
  '--v2-text': string
  '--v2-muted': string
  // Fun options — individually overridable
  '--v2-chat-msg': string
  '--v2-name-self': string
  '--v2-name-other': string
  // Animated gradient background
  '--v2-grad-from': string
  '--v2-grad-to': string
  // Pattern overlay opacity (0–1 as a string, e.g. "0.12")
  '--v2-pattern-opacity': string
}

export type ThemeOverrides = Partial<
  Pick<ThemeVars, '--v2-chat-msg' | '--v2-name-self' | '--v2-name-other' | '--v2-pattern-opacity'>
>

export type V2Theme = {
  id: string
  name: string
  vars: ThemeVars
}

export type ThemePreference = {
  id: string
  overrides?: ThemeOverrides
}

// ── Theme definitions ──────────────────────────────────────────────────────────

export const THEMES: V2Theme[] = [
  {
    id: 'dark-orange',
    name: 'Dark Orange',
    vars: {
      '--v2-bg': '#111827',
      '--v2-surface': '#1f2937',
      '--v2-hover': '#374151',
      '--v2-border': '#374151',
      '--v2-accent': '#f97316',
      '--v2-accent-hover': '#ea580c',
      '--v2-accent-fg': '#ffffff',
      '--v2-text': '#f9fafb',
      '--v2-muted': '#9ca3af',
      '--v2-chat-msg': '#f9fafb',
      '--v2-name-self': '#fb923c',
      '--v2-name-other': '#60a5fa',
      '--v2-grad-from': '#1f2937',
      '--v2-grad-to': '#111827',
      '--v2-pattern-opacity': '0.12',
    },
  },
  {
    id: 'midnight-purple',
    name: 'Midnight Purple',
    vars: {
      '--v2-bg': '#0d0a1e',
      '--v2-surface': '#1a1035',
      '--v2-hover': '#2d1f56',
      '--v2-border': '#3d2b6b',
      '--v2-accent': '#a855f7',
      '--v2-accent-hover': '#9333ea',
      '--v2-accent-fg': '#ffffff',
      '--v2-text': '#ede9fe',
      '--v2-muted': '#9d87c3',
      '--v2-chat-msg': '#e2d9f3',
      '--v2-name-self': '#c084fc',
      '--v2-name-other': '#34d399',
      '--v2-grad-from': '#1a1035',
      '--v2-grad-to': '#0d0a1e',
      '--v2-pattern-opacity': '0.1',
    },
  },
  {
    id: 'neon-teal',
    name: 'Neon Teal',
    vars: {
      '--v2-bg': '#050f10',
      '--v2-surface': '#0a1f21',
      '--v2-hover': '#112d30',
      '--v2-border': '#1a4045',
      '--v2-accent': '#14b8a6',
      '--v2-accent-hover': '#0d9488',
      '--v2-accent-fg': '#ffffff',
      '--v2-text': '#e0fdfa',
      '--v2-muted': '#6ea8a4',
      '--v2-chat-msg': '#e0fdfa',
      '--v2-name-self': '#2dd4bf',
      '--v2-name-other': '#a78bfa',
      '--v2-grad-from': '#0a1f21',
      '--v2-grad-to': '#050f10',
      '--v2-pattern-opacity': '0.1',
    },
  },
  {
    id: 'crimson-night',
    name: 'Crimson Night',
    vars: {
      '--v2-bg': '#0f0408',
      '--v2-surface': '#1c060f',
      '--v2-hover': '#2a0d1a',
      '--v2-border': '#3d1226',
      '--v2-accent': '#e11d48',
      '--v2-accent-hover': '#be123c',
      '--v2-accent-fg': '#ffffff',
      '--v2-text': '#fef2f2',
      '--v2-muted': '#a07080',
      '--v2-chat-msg': '#fef2f2',
      '--v2-name-self': '#fb7185',
      '--v2-name-other': '#60a5fa',
      '--v2-grad-from': '#1c060f',
      '--v2-grad-to': '#0f0408',
      '--v2-pattern-opacity': '0.1',
    },
  },
]

export const DEFAULT_THEME_ID = 'dark-orange'

// Preset swatch palettes for fun overrides
export const CHAT_MSG_SWATCHES = ['#f9fafb', '#e2d9f3', '#d1fae5', '#fef3c7', '#ffe4e6', '#a0f0ed']
export const NAME_SELF_SWATCHES = ['#fb923c', '#c084fc', '#34d399', '#60a5fa', '#f472b6', '#facc15']
export const NAME_OTHER_SWATCHES = ['#60a5fa', '#34d399', '#fb923c', '#c084fc', '#f472b6', '#facc15']

export function getThemeById(id: string): V2Theme {
  return THEMES.find(t => t.id === id) ?? THEMES[0]
}

export function resolveVars(theme: V2Theme, overrides?: ThemeOverrides): ThemeVars {
  return { ...theme.vars, ...overrides }
}
