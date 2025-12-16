import type { ThemeJSONDefinition } from "./types"
import orangeSoda from "../themes/orange-soda.json"
import grapeSoda from "../themes/grape-sode.json"

const parsedThemes = [orangeSoda, grapeSoda] as ThemeJSONDefinition[]

export const themeRegistry: ThemeJSONDefinition[] = parsedThemes

export const DEFAULT_THEME_ID = themeRegistry[0]?.id ?? "orangeSoda"

export const getThemeById = (id?: string) =>
  themeRegistry.find((theme) => theme.id === id) ?? themeRegistry[0]
