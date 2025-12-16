import { useMemo } from "react"
import { useSettingsStore } from "../state/store"
import { getThemeById } from "./registry"

export const useActiveThemeDefinition = () => {
  const preference = useSettingsStore((s) => s.theme)
  return useMemo(() => getThemeById(preference?.id), [preference?.id])
}

export const useAccentColorName = () => {
  const preference = useSettingsStore((s) => s.theme)
  return preference?.colorPalette ?? "hyperOrange"
}
