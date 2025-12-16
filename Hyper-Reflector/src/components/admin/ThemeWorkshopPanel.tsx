import { useMemo, useState, useEffect, useCallback } from "react"
import {
  Box,
  Button,
  ChakraProvider,
  Flex,
  Heading,
  Input,
  Portal,
  SimpleGrid,
  Stack,
  Text,
  Textarea,
  createListCollection,
} from "@chakra-ui/react"
import {
  SelectContent,
  SelectItem,
  SelectRoot,
  SelectTrigger,
  SelectValueText,
} from "../chakra/ui/select"
import { toaster } from "../chakra/ui/toaster"
import { themeRegistry } from "../../theme/registry"
import type {
  ThemeJSONDefinition,
  ThemeColorRampKey,
} from "../../theme/types"
import { createChakraThemeFromDefinition } from "../../theme/factory"
import { useDebouncedValue } from "../../hooks/useDebouncedValue"

const RAMP_KEYS: ThemeColorRampKey[] = [
  "50",
  "100",
  "200",
  "300",
  "400",
  "500",
  "600",
  "700",
  "800",
  "900",
]

const DEFAULT_THEME_TEMPLATE: ThemeJSONDefinition = {
  id: "custom-theme",
  name: "Custom Theme",
  description: "Draft generated in the admin panel.",
  mode: "dark",
  accentPalette: themeRegistry[0]?.accentPalette ?? {
    name: "accent",
    colors: {
      "50": "#fff4e6",
      "100": "#ffe4c7",
      "200": "#ffc38f",
      "300": "#ffa45c",
      "400": "#ff8a33",
      "500": "#ff6f0b",
      "600": "#f45f05",
      "700": "#cc4402",
      "800": "#aa3600",
      "900": "#872b00",
    },
  },
  neutralPalette: themeRegistry[0]?.neutralPalette ?? {
    name: "neutral",
    colors: {
      "50": "#f4f4f5",
      "100": "#d4d4d8",
      "200": "#a1a1aa",
      "300": "#71717a",
      "400": "#52525b",
      "500": "#3f3f46",
      "600": "#27272a",
      "700": "#18181b",
      "800": "#0f0f10",
      "900": "#09090b",
    },
  },
  semanticColors:
    themeRegistry[0]?.semanticColors ?? {
      background: "#05060f",
      canvas: "#03050c",
      muted: "#0d1221",
      emphasized: "#141b2e",
      surface: "#19203a",
      border: "#1f2a40",
      card: "#111827",
      popover: "#0f172a",
      overlay: "#01030a",
      text: "#f8fafc",
      textMuted: "#9da8c7",
      heading: "#f1f5f9",
      primary: "#ff6f0b",
      secondary: "#fcd34d",
      success: "#16a34a",
      warning: "#fbbf24",
      danger: "#f87171",
      info: "#38bdf8",
    },
}

const cloneTheme = (definition: ThemeJSONDefinition): ThemeJSONDefinition =>
  JSON.parse(JSON.stringify(definition)) as ThemeJSONDefinition

export function ThemeWorkshopPanel() {
  const initialTheme =
    themeRegistry[0] !== undefined
      ? cloneTheme(themeRegistry[0])
      : cloneTheme(DEFAULT_THEME_TEMPLATE)
  const [themeDraft, setThemeDraft] =
    useState<ThemeJSONDefinition>(initialTheme)
  const [mode, setMode] = useState<"light" | "dark">(initialTheme.mode)
  const [selectedThemeId, setSelectedThemeId] = useState<string>(
    themeRegistry[0]?.id ?? DEFAULT_THEME_TEMPLATE.id
  )
  const [previewVisible, setPreviewVisible] = useState(false)
  const themeJson = useMemo(
    () => JSON.stringify(themeDraft, null, 2),
    [themeDraft]
  )
  const previewSource = useDebouncedValue(themeDraft, 150)
  const previewTheme = useMemo(
    () => createChakraThemeFromDefinition(previewSource),
    [previewSource]
  )
  const themeOptions = useMemo(
    () => [
      ...themeRegistry.map((theme) => ({ label: theme.name, value: theme.id })),
      { label: "Blank template", value: DEFAULT_THEME_TEMPLATE.id },
    ],
    []
  )
  const themeCollection = useMemo(
    () => createListCollection({ items: themeOptions }),
    [themeOptions]
  )

  useEffect(() => {
    setThemeDraft((prev) => ({ ...prev, mode }))
  }, [mode])

  const loadThemeById = useCallback(
    (id: string) => {
      if (id === DEFAULT_THEME_TEMPLATE.id) {
        const template = cloneTheme(DEFAULT_THEME_TEMPLATE)
        setThemeDraft(template)
        setMode(template.mode)
        return
      }
      const existing =
        themeRegistry.find((theme) => theme.id === id) ??
        themeRegistry[0] ??
        DEFAULT_THEME_TEMPLATE
      const cloned = cloneTheme(existing)
      setThemeDraft(cloned)
      setMode(cloned.mode)
    },
    []
  )

  const handleFieldChange = (
    field: keyof ThemeJSONDefinition,
    value: string
  ) => setThemeDraft((prev) => ({ ...prev, [field]: value }))

  const handleSemanticColorChange = (
    key: keyof ThemeJSONDefinition["semanticColors"],
    value: string
  ) =>
    setThemeDraft((prev) => ({
      ...prev,
      semanticColors: { ...prev.semanticColors, [key]: value },
    }))

  const handlePaletteColorChange = (
    palette: "accentPalette" | "neutralPalette",
    shade: ThemeColorRampKey,
    value: string
  ) =>
    setThemeDraft((prev) => ({
      ...prev,
      [palette]: {
        ...prev[palette],
        colors: { ...prev[palette]?.colors, [shade]: value },
      },
    }))

  const handleCopyJson = async () => {
    try {
      await navigator.clipboard.writeText(themeJson)
      toaster.create({
        title: "Theme JSON copied",
        description: "Drop it into /src/themes and register it.",
      })
    } catch (error) {
      console.error("Clipboard copy failed", error)
      toaster.create({
        title: "Copy failed",
        description: "Clipboard blocked. Copy manually instead.",
      })
    }
  }

  const handleDownloadJson = () => {
    try {
      const blob = new Blob([themeJson], { type: "application/json" })
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement("a")
      anchor.href = url
      anchor.download = `${themeDraft.id || "theme"}.json`
      anchor.click()
      URL.revokeObjectURL(url)
      toaster.create({
        title: "JSON downloaded",
        description: "Check your downloads folder for the theme file.",
      })
    } catch (error) {
      console.error("Download failed", error)
      toaster.create({
        title: "Download failed",
        description: "Unable to create a file. Try copying the JSON instead.",
      })
    }
  }

  return (
    <Stack gap={6} mt={4}>
      <Box
        bg="gray.900"
        borderWidth="1px"
        borderColor="gray.800"
        borderRadius="lg"
        p="5"
      >
        <Stack gap={4}>
          <Flex
            gap={3}
            direction={{ base: "column", md: "row" }}
            justify="space-between"
          >
            <Heading size="md">Theme metadata</Heading>
            <SelectRoot
              value={[selectedThemeId]}
              collection={themeCollection}
              maxW={{ base: "full", md: "260px" }}
              onValueChange={(details) => {
                const nextId =
                  (details.value[0] as string) ?? DEFAULT_THEME_TEMPLATE.id
                setSelectedThemeId(nextId)
                loadThemeById(nextId)
              }}
            >
              <SelectTrigger>
                <SelectValueText placeholder="Load existing theme" />
              </SelectTrigger>
              <SelectContent>
                {themeCollection.items.map((option) => (
                  <SelectItem item={option} key={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </SelectRoot>
          </Flex>
          <SimpleGrid columns={{ base: 1, md: 2 }} gap={4}>
            <Stack>
              <Text fontSize="sm" color="gray.400">
                Theme ID
              </Text>
              <Input
                value={themeDraft.id}
                onChange={(event) => handleFieldChange("id", event.target.value)}
              />
            </Stack>
            <Stack>
              <Text fontSize="sm" color="gray.400">
                Display name
              </Text>
              <Input
                value={themeDraft.name}
                onChange={(event) =>
                  handleFieldChange("name", event.target.value)
                }
              />
            </Stack>
          </SimpleGrid>
          <Stack>
            <Text fontSize="sm" color="gray.400">
              Description
            </Text>
            <Textarea
              value={themeDraft.description ?? ""}
              onChange={(event) =>
                handleFieldChange("description", event.target.value)
              }
              rows={3}
            />
          </Stack>
          <Stack direction={{ base: "column", md: "row" }} gap={3}>
            <Stack flex="1">
              <Text fontSize="sm" color="gray.400">
                Accent palette name
              </Text>
              <Input
                value={themeDraft.accentPalette.name}
                onChange={(event) =>
                  setThemeDraft((prev) => ({
                    ...prev,
                    accentPalette: {
                      ...prev.accentPalette,
                      name: event.target.value,
                    },
                  }))
                }
              />
            </Stack>
            <Stack flex="1">
              <Text fontSize="sm" color="gray.400">
                Neutral palette name
              </Text>
              <Input
                value={themeDraft.neutralPalette?.name ?? ""}
                onChange={(event) =>
                  setThemeDraft((prev) => ({
                    ...prev,
                    neutralPalette: {
                      ...(prev.neutralPalette ?? {
                        name: event.target.value || "neutral",
                        colors: prev.accentPalette.colors,
                      }),
                      name: event.target.value,
                    },
                  }))
                }
              />
            </Stack>
            <Stack w={{ base: "full", md: "200px" }}>
              <Text fontSize="sm" color="gray.400">
                Mode
              </Text>
              <SelectRoot
                value={[mode]}
                onValueChange={(event) =>
                  setMode((event.value[0] as "light" | "dark") ?? "dark")
                }
                maxW="200px"
              >
                <SelectTrigger>
                  <SelectValueText placeholder="Choose mode" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem item={{ label: "Dark", value: "dark" }}>
                    Dark
                  </SelectItem>
                  <SelectItem item={{ label: "Light", value: "light" }}>
                    Light
                  </SelectItem>
                </SelectContent>
              </SelectRoot>
            </Stack>
          </Stack>
        </Stack>
      </Box>
      <Box
        bg="gray.900"
        borderWidth="1px"
        borderColor="gray.800"
        borderRadius="lg"
        p="5"
      >
        <Stack gap={4}>
          <Heading size="md">Palette ramps</Heading>
          <Text fontSize="sm" color="gray.400">
            Adjust each step of your accent and neutral ramps. These values
            hydrate Chakra tokens for the theme.
          </Text>
          <Stack gap={3}>
            <Text fontWeight="semibold">
              Accent ({themeDraft.accentPalette.name})
            </Text>
            <SimpleGrid columns={{ base: 2, md: 5 }} gap={3}>
              {RAMP_KEYS.map((key) => (
                <Stack key={`accent-${key}`}>
                  <Text fontSize="xs" color="gray.400">
                    {key}
                  </Text>
                  <Input
                    type="color"
                    value={themeDraft.accentPalette.colors[key]}
                    onChange={(event) =>
                      handlePaletteColorChange(
                        "accentPalette",
                        key,
                        event.target.value
                      )
                    }
                  />
                </Stack>
              ))}
            </SimpleGrid>
          </Stack>
          {themeDraft.neutralPalette ? (
            <Stack gap={3}>
              <Text fontWeight="semibold">
                Neutral ({themeDraft.neutralPalette.name})
              </Text>
              <SimpleGrid columns={{ base: 2, md: 5 }} gap={3}>
                {RAMP_KEYS.map((key) => (
                  <Stack key={`neutral-${key}`}>
                    <Text fontSize="xs" color="gray.400">
                      {key}
                    </Text>
                    <Input
                      type="color"
                      value={themeDraft.neutralPalette.colors[key]}
                      onChange={(event) =>
                        handlePaletteColorChange(
                          "neutralPalette",
                          key,
                          event.target.value
                        )
                      }
                    />
                  </Stack>
                ))}
              </SimpleGrid>
            </Stack>
          ) : null}
        </Stack>
      </Box>
      <Box
        bg="gray.900"
        borderWidth="1px"
        borderColor="gray.800"
        borderRadius="lg"
        p="5"
      >
        <Stack gap={4}>
          <Heading size="md">Semantic colors</Heading>
          <SimpleGrid columns={{ base: 1, md: 2, xl: 3 }} gap={4}>
            {Object.entries(themeDraft.semanticColors).map(([key, value]) => (
              <Stack key={key}>
                <Text fontSize="sm" color="gray.400" textTransform="capitalize">
                  {key.replace(/([A-Z])/g, " $1")}
                </Text>
                <Input
                  type="color"
                  value={value}
                  onChange={(event) =>
                    handleSemanticColorChange(
                      key as keyof ThemeJSONDefinition["semanticColors"],
                      event.target.value
                    )
                  }
                />
              </Stack>
            ))}
          </SimpleGrid>
        </Stack>
      </Box>
      <Box
        bg="gray.900"
        borderWidth="1px"
        borderColor="gray.800"
        borderRadius="lg"
        p="5"
      >
        <Stack gap={4}>
          <Flex justify="space-between" align="center" gap={3}>
            <Heading size="md">Live preview</Heading>
            <Button variant="outline" onClick={() => setPreviewVisible(true)}>
              Open live preview
            </Button>
          </Flex>
          <ChakraProvider value={previewTheme}>
            <Stack
              gap={3}
              borderWidth="1px"
              borderColor="border"
              borderRadius="lg"
              p="4"
              bg="bg.canvas"
            >
              <Heading size="sm">{themeDraft.name}</Heading>
              <Text color="fg.muted">{themeDraft.description}</Text>
              <Stack direction={{ base: "column", md: "row" }} gap={3}>
                <Button>Primary action</Button>
                <Button variant="outline">Secondary</Button>
                <Button variant="ghost">Ghost</Button>
              </Stack>
              <Stack
                borderWidth="1px"
                borderColor="border"
                borderRadius="md"
                p="3"
                bg="bg.surface"
                gap={2}
              >
                <Text fontWeight="semibold">Surface sample</Text>
                <Text color="fg.muted">
                  Confirm contrast and readability within cards.
                </Text>
              </Stack>
            </Stack>
          </ChakraProvider>
        </Stack>
      </Box>
      <Box
        bg="gray.900"
        borderWidth="1px"
        borderColor="gray.800"
        borderRadius="lg"
        p="5"
      >
        <Stack gap={3}>
          <Heading size="md">Export</Heading>
          <Text fontSize="sm" color="gray.400">
            Copy or download the JSON, then place it inside{" "}
            <code>src/themes</code> and register it.
          </Text>
          <Textarea value={themeJson} readOnly rows={12} fontFamily="mono" />
          <Stack direction={{ base: "column", sm: "row" }} gap={3}>
            <Button flex="1" onClick={handleCopyJson}>
              Copy JSON
            </Button>
            <Button flex="1" variant="outline" onClick={handleDownloadJson}>
              Download JSON
            </Button>
          </Stack>
        </Stack>
      </Box>

      {previewVisible ? (
        <Portal>
          <Box
            position="fixed"
            inset="0"
            bg="rgba(0,0,0,0.8)"
            zIndex={1000}
            display="flex"
            alignItems="center"
            justifyContent="center"
            p="6"
          >
            <Box maxW="960px" width="full">
              <ChakraProvider value={previewTheme}>
                <Stack
                  gap={4}
                  bg="bg.canvas"
                  borderRadius="lg"
                  borderWidth="1px"
                  borderColor="border"
                  p={{ base: 4, md: 6 }}
                  shadow="xl"
                >
                  <Flex justify="space-between" align="center">
                    <Heading size="md">
                      {themeDraft.name} - Live preview
                    </Heading>
                    <Button variant="outline" onClick={() => setPreviewVisible(false)}>
                      Close
                    </Button>
                  </Flex>
                  <Text color="fg.muted">{themeDraft.description}</Text>
                  <Stack direction={{ base: "column", md: "row" }} gap={3}>
                    <Button>Primary action</Button>
                    <Button variant="outline">Secondary</Button>
                    <Button variant="ghost">Ghost</Button>
                  </Stack>
                  <SimpleGrid columns={{ base: 1, md: 2 }} gap={3}>
                    <Box
                      borderWidth="1px"
                      borderColor="border"
                      borderRadius="md"
                      p="4"
                      bg="bg.surface"
                    >
                      <Heading size="sm" mb="2">
                        Surface section
                      </Heading>
                      <Text color="fg.muted">
                        Use this to confirm card backgrounds and text colors look
                        cohesive.
                      </Text>
                    </Box>
                    <Box
                      borderWidth="1px"
                      borderColor="border"
                      borderRadius="md"
                      p="4"
                      bg="bg.surface"
                    >
                      <Heading size="sm" mb="2">
                        Accent controls
                      </Heading>
                      <Stack direction="row" gap={2}>
                        <Button size="sm">Accept</Button>
                        <Button size="sm" variant="outline">
                          Cancel
                        </Button>
                      </Stack>
                      <Text color="fg.muted" mt="2">
                        Buttons inside the overlay reflect the latest palette settings.
                      </Text>
                    </Box>
                  </SimpleGrid>
                </Stack>
              </ChakraProvider>
            </Box>
          </Box>
        </Portal>
      ) : null}
    </Stack>
  )
}
