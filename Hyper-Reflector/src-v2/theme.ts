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
  // Accent spotlight intensities — primary (top-center) and secondary (bottom-left)
  // Defaults: 22% / 9% for dark themes. Light themes should set these much lower.
  '--v2-spotlight-intensity'?: string
  '--v2-spotlight-secondary'?: string
  // CSS filter applied to the pattern overlay, e.g. 'invert(1)' for light themes
  '--v2-pattern-filter'?: string
  // mix-blend-mode for the pattern overlay, e.g. 'multiply' for light themes
  '--v2-pattern-blend'?: string
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
      '--v2-pattern-opacity': '0.22',
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
      '--v2-pattern-opacity': '0.2',
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
      '--v2-pattern-opacity': '0.2',
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
      '--v2-pattern-opacity': '0.2',
    },
  },
  {
    id: 'toxic-waste',
    name: 'Toxic Waste',
    vars: {
      '--v2-bg': '#060c04',
      '--v2-surface': '#0d1a08',
      '--v2-hover': '#152b0d',
      '--v2-border': '#1f3d14',
      '--v2-accent': '#a8d400',
      '--v2-accent-hover': '#88ab00',
      '--v2-accent-fg': '#060c04',
      '--v2-text': '#d8f0a0',
      '--v2-muted': '#5a7035',
      '--v2-chat-msg': '#e8f8b8',
      '--v2-name-self': '#b8e820',
      '--v2-name-other': '#f5c842',
      '--v2-grad-from': '#0d1a08',
      '--v2-grad-to': '#060c04',
      '--v2-pattern-opacity': '0.25',
    },
  },
  {
    id: 'deep-space',
    name: 'Deep Space',
    vars: {
      '--v2-bg': '#03010a',
      '--v2-surface': '#080516',
      '--v2-hover': '#100c24',
      '--v2-border': '#1c1637',
      '--v2-accent': '#6366f1',
      '--v2-accent-hover': '#4f46e5',
      '--v2-accent-fg': '#ffffff',
      '--v2-text': '#eef2ff',
      '--v2-muted': '#7878a8',
      '--v2-chat-msg': '#eef2ff',
      '--v2-name-self': '#818cf8',
      '--v2-name-other': '#34d399',
      '--v2-grad-from': '#080516',
      '--v2-grad-to': '#03010a',
      '--v2-pattern-opacity': '0.18',
    },
  },
  {
    id: 'cassette-futurism',
    name: 'Cassette Futurism',
    vars: {
      '--v2-bg': '#e8e0d0',
      '--v2-surface': '#dfd6c4',
      '--v2-hover': '#e8e0d0',
      '--v2-border': '#cec4b4',
      '--v2-accent': '#c93800',
      '--v2-accent-hover': '#a82d00',
      '--v2-accent-fg': '#ffffff',
      '--v2-text': '#18130e',
      '--v2-muted': '#4a3f35',
      '--v2-chat-msg': '#18130e',
      '--v2-name-self': '#c93800',
      '--v2-name-other': '#1060c0',
      '--v2-grad-from': '#faf6ef',
      '--v2-grad-to': '#f2ece0',
      '--v2-pattern-opacity': '0.9',
      '--v2-spotlight-intensity': '4%',
      '--v2-spotlight-secondary': '2%',
      '--v2-pattern-filter': 'invert(1) contrast(1100)',
      '--v2-pattern-blend': 'darken',
    },
  },
  {
    id: 'nostromo',
    name: 'Nostromo',
    vars: {
      '--v2-bg': '#06080a',
      '--v2-surface': '#0c1214',
      '--v2-hover': '#141e22',
      '--v2-border': '#1d2d32',
      '--v2-accent': '#cf6d27',
      '--v2-accent-hover': '#b05a1a',
      '--v2-accent-fg': '#06080a',
      '--v2-text': '#c4a36a',
      '--v2-muted': '#5c6b60',
      '--v2-chat-msg': '#b09050',
      '--v2-name-self': '#cf6d27',
      '--v2-name-other': '#4ab09a',
      '--v2-grad-from': '#0c1214',
      '--v2-grad-to': '#06080a',
      '--v2-pattern-opacity': '0.28',
    },
  },
]

export const DEFAULT_THEME_ID = 'dark-orange'

// Preset swatch palettes for fun overrides
export const CHAT_MSG_SWATCHES = [
  // Light
  '#f9fafb', '#e2d9f3', '#d1fae5', '#fef3c7', '#ffe4e6', '#a0f0ed',
  // Dark
  '#18130e', '#1e293b', '#1a1a2e', '#0f2417', '#2d1b00', '#1a0a0a',
]
export const NAME_SELF_SWATCHES = [
  // Light / vivid
  '#fb923c', '#c084fc', '#34d399', '#60a5fa', '#f472b6', '#facc15',
  // Dark
  '#c93800', '#7c3aed', '#065f46', '#1d4ed8', '#9d174d', '#854d0e',
]
export const NAME_OTHER_SWATCHES = [
  // Light / vivid
  '#60a5fa', '#34d399', '#fb923c', '#c084fc', '#f472b6', '#facc15',
  // Dark
  '#1d4ed8', '#065f46', '#c93800', '#7c3aed', '#9d174d', '#854d0e',
]

export function getThemeById(id: string): V2Theme {
  return THEMES.find(t => t.id === id) ?? THEMES[0]
}

export function resolveVars(theme: V2Theme, overrides?: ThemeOverrides): ThemeVars {
  return { ...theme.vars, ...overrides }
}
