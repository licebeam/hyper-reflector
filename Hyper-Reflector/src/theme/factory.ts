import { createSystem, defaultConfig, defineConfig, defineRecipe } from "@chakra-ui/react"
import type {
  ThemeJSONDefinition,
  ThemeColorRamp,
  ThemeColorRampKey,
  ThemePaletteDefinition,
} from "./types"

const rampToTokens = (ramp?: ThemeColorRamp) => {
  if (!ramp) return undefined
  return Object.entries(ramp).reduce<Record<string, { value: string }>>(
    (acc, [step, value]) => {
      acc[step] = { value }
      return acc
    },
    {}
  )
}

const registerPalette = (palette?: ThemePaletteDefinition) => {
  if (!palette) return {}
  return { [palette.name]: rampToTokens(palette.colors) ?? {} }
}

const createPaletteSemanticTokens = (definition: ThemeJSONDefinition) => {
  const paletteTokens: Record<string, Record<string, { value: string }>> = {}
  const isDark = definition.mode === "dark"

  const register = (palette?: ThemePaletteDefinition) => {
    if (!palette) return
    const getColor = (shade: ThemeColorRampKey) => palette.colors[shade]

    paletteTokens[palette.name] = {
      contrast: {
        value: isDark ? definition.semanticColors.background : definition.semanticColors.text,
      },
      fg: { value: isDark ? getColor("100") : getColor("800") },
      subtle: { value: isDark ? getColor("900") : getColor("100") },
      muted: { value: isDark ? getColor("800") : getColor("200") },
      emphasized: { value: isDark ? getColor("700") : getColor("300") },
      solid: { value: isDark ? getColor("500") : getColor("600") },
      focusRing: { value: isDark ? getColor("300") : getColor("400") },
    }
  }

  register(definition.accentPalette)
  register(definition.neutralPalette)

  return paletteTokens
}

const createButtonRecipe = () => {
  return defineRecipe({
    base: {
      fontWeight: "semibold",
      borderRadius: "l2",
      transitionProperty: "common",
      transitionDuration: "200ms",
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      gap: "2",
      cursor: "pointer",
      _focusVisible: {
        outline: "3px solid",
        outlineColor: "colorPalette.focusRing",
        outlineOffset: "2px",
      },
      _disabled: {
        opacity: 0.5,
        cursor: "not-allowed",
      },
    },
    variants: {
      variant: {
        solid: {
          bg: "colorPalette.solid",
          color: "colorPalette.contrast",
          borderColor: "transparent",
          _hover: { bg: "colorPalette.emphasized" },
          _active: { bg: "colorPalette.emphasized" },
        },
        outline: {
          borderWidth: "1px",
          borderColor: "colorPalette.emphasized",
          color: "colorPalette.fg",
          bg: "transparent",
          _hover: { bg: "colorPalette.subtle" },
          _active: { bg: "colorPalette.muted" },
        },
        ghost: {
          color: "colorPalette.fg",
          bg: "transparent",
          _hover: { bg: "colorPalette.subtle" },
          _active: { bg: "colorPalette.muted" },
        },
        subtle: {
          bg: "colorPalette.subtle",
          color: "colorPalette.fg",
          _hover: { bg: "colorPalette.muted" },
          _active: { bg: "colorPalette.muted" },
        },
        surface: {
          bg: "bg.surface",
          borderWidth: "1px",
          borderColor: "border.default",
          color: "fg.default",
          _hover: { bg: "bg.emphasized" },
          _active: { bg: "bg.emphasized" },
        },
        plain: {
          color: "colorPalette.fg",
          bg: "transparent",
          _hover: { color: "colorPalette.emphasized" },
          _active: { color: "colorPalette.emphasized" },
        },
      },
      size: {
        sm: {
          h: "8",
          px: "3",
          fontSize: "xs",
        },
        md: {
          h: "10",
          px: "4",
          fontSize: "sm",
        },
        lg: {
          h: "12",
          px: "5",
          fontSize: "md",
        },
      },
    },
    defaultVariants: {
      variant: "solid",
      size: "md",
    },
  })
}

export const createChakraThemeFromDefinition = (definition: ThemeJSONDefinition) => {
  const tokens = {
    colors: {
      ...registerPalette(definition.accentPalette),
      ...registerPalette(definition.neutralPalette),
    },
  }

  const colors = definition.semanticColors
  const paletteSemanticTokens = createPaletteSemanticTokens(definition)

  const semanticTokens = {
    colors: {
      "bg.canvas": { value: colors.canvas },
      "bg.surface": { value: colors.surface },
      "bg.muted": { value: colors.muted },
      "bg.emphasized": { value: colors.emphasized },
      "bg.overlay": { value: colors.overlay },
      "bg.card": { value: colors.card },
      "bg.popover": { value: colors.popover },
      "fg.default": { value: colors.text },
      "fg.muted": { value: colors.textMuted },
      "fg.on-accent": { value: colors.background },
      border: { value: colors.border },
      "border.default": { value: colors.border },
      "accent.default": { value: colors.primary },
      "accent.muted": { value: colors.secondary },
      "accent.emphasis": { value: colors.primary },
      success: { value: colors.success },
      warning: { value: colors.warning },
      danger: { value: colors.danger },
      info: { value: colors.info },
      ...paletteSemanticTokens,
    },
  }

  const accentRoot = definition.accentPalette.name

  const config = defineConfig({
    theme: {
      tokens,
      semanticTokens,
      recipes: {
        button: createButtonRecipe(),
      },
      styles: {
        global: {
          html: {
            bg: "bg.canvas",
            color: "fg.default",
            colorPalette: accentRoot,
          },
          body: {
            bg: "bg.canvas",
            color: "fg.default",
            colorPalette: accentRoot,
          },
          ".chakra-theme": {
            colorPalette: accentRoot,
          },
        },
      },
    },
  })

  return createSystem(defaultConfig, config)
}
