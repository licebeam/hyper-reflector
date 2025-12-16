export type ThemeColorRampKey =
  | "50"
  | "100"
  | "200"
  | "300"
  | "400"
  | "500"
  | "600"
  | "700"
  | "800"
  | "900"

export type ThemeColorRamp = Record<ThemeColorRampKey, string>

export type ThemePaletteDefinition = {
  name: string
  colors: ThemeColorRamp
}

export type ThemeSemanticColors = {
  background: string
  canvas: string
  muted: string
  emphasized: string
  surface: string
  border: string
  card: string
  popover: string
  overlay: string
  text: string
  textMuted: string
  heading: string
  primary: string
  secondary: string
  success: string
  warning: string
  danger: string
  info: string
}

export type ThemeJSONDefinition = {
  id: string
  name: string
  description?: string
  mode: "light" | "dark"
  accentPalette: ThemePaletteDefinition
  neutralPalette?: ThemePaletteDefinition
  semanticColors: ThemeSemanticColors
}
