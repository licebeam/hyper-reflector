import type { ThemeJSONDefinition } from "./types"

export type ThemePreference = {
  id: string
  name: string
  colorPalette: string
}

export const toThemePreference = (definition: ThemeJSONDefinition): ThemePreference => ({
  id: definition.id,
  name: definition.name,
  colorPalette: definition.accentPalette.name,
})
