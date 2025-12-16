import {
  Box,
  Button,
  Flex,
  Heading,
  Input,
  SelectValueChangeDetails,
  SimpleGrid,
  Spinner,
  Stack,
  Text,
  createListCollection,
} from "@chakra-ui/react"
import {
  SelectContent,
  SelectItem,
  SelectRoot,
  SelectTrigger,
  SelectValueText,
} from "../chakra/ui/select"
import SelectableFlairButton from "../SelectableFlairButton"
import TitleBadge from "../TitleBadge"
import type { TUser, TUserTitle } from "../../types/user"

type PoolOption = { label: string; value: "conditional" | "global" }

const POOL_OPTIONS: PoolOption[] = [
  { label: "Conditional flair pool", value: "conditional" },
  { label: "Global flair pool", value: "global" },
]

type FlairToolsPanelProps = {
  accentColor: string
  previewTitle: TUserTitle
  titleDraft: string
  onTitleDraftChange: (value: string) => void
  bgColor: string
  onBgColorChange: (value: string) => void
  textColor: string
  onTextColorChange: (value: string) => void
  borderColor: string
  onBorderColorChange: (value: string) => void
  poolType: "conditional" | "global"
  onPoolTypeChange: (value: "conditional" | "global") => void
  creating: boolean
  onCreateFlair: () => void
  searchTerm: string
  onSearchTermChange: (value: string) => void
  searchResults: Partial<TUser>[]
  searchLoading: boolean
  searchError: string | null
  onSearch: () => void
  selectedUser: Partial<TUser> | null
  onSelectUser: (user: Partial<TUser>) => void
  flairsLoading: boolean
  conditionalFlairs: TUserTitle[]
  selectedConditionalFlair: TUserTitle | null
  onSelectConditionalFlair: (flair: TUserTitle) => void
  onAssignFlair: () => void
  assigning: boolean
}

export function FlairToolsPanel({
  accentColor,
  previewTitle,
  titleDraft,
  onTitleDraftChange,
  bgColor,
  onBgColorChange,
  textColor,
  onTextColorChange,
  borderColor,
  onBorderColorChange,
  poolType,
  onPoolTypeChange,
  creating,
  onCreateFlair,
  searchTerm,
  onSearchTermChange,
  searchResults,
  searchLoading,
  searchError,
  onSearch,
  selectedUser,
  onSelectUser,
  flairsLoading,
  conditionalFlairs,
  selectedConditionalFlair,
  onSelectConditionalFlair,
  onAssignFlair,
  assigning,
}: FlairToolsPanelProps) {
  const poolCollection = createListCollection<PoolOption>({
    items: POOL_OPTIONS,
  })

  return (
    <Stack gap={6}>
      <Box
        bg="gray.900"
        borderWidth="1px"
        borderColor="gray.800"
        borderRadius="lg"
        p="5"
      >
        <Stack gap={4}>
          <Heading size="md">Create title flair</Heading>
          <Stack
            direction={{ base: "column", md: "row" }}
            gap={3}
            align="flex-end"
          >
            <Box flex="1">
              <Text fontSize="sm" color="gray.400" mb="1">
                Flair name
              </Text>
              <Input
                placeholder="Event champion"
                value={titleDraft}
                onChange={(event) => onTitleDraftChange(event.target.value)}
              />
            </Box>
            <Stack direction="column" gap={2}>
              <Text fontSize="sm" color="gray.400">
                Pool
              </Text>
              <SelectRoot<PoolOption>
                collection={poolCollection}
                value={[poolType]}
                onValueChange={(event: SelectValueChangeDetails<PoolOption>) =>
                  onPoolTypeChange(
                    (event.value[0] as "conditional" | "global") ?? "conditional"
                  )
                }
                maxW="160px"
                color="gray.400"
              >
                <SelectTrigger>
                  <SelectValueText placeholder="Choose a pool" />
                </SelectTrigger>
                <SelectContent>
                  {poolCollection.items.map((option) => (
                    <SelectItem item={option} key={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </SelectRoot>
            </Stack>
            <Stack direction="column" gap={2}>
              <Text fontSize="sm" color="gray.400">
                Background
              </Text>
              <Flex align="center" gap={2}>
                <Input
                  type="color"
                  value={bgColor}
                  onChange={(event) => onBgColorChange(event.target.value)}
                  minW="24px"
                />
              </Flex>
            </Stack>
            <Stack direction="column" gap={2}>
              <Text fontSize="sm" color="gray.400">
                Text
              </Text>
              <Flex align="center" gap={2}>
                <Input
                  type="color"
                  value={textColor}
                  onChange={(event) => onTextColorChange(event.target.value)}
                  minW="24px"
                />
              </Flex>
            </Stack>
            <Stack direction="column" gap={2}>
              <Text fontSize="sm" color="gray.400">
                Border
              </Text>
              <Flex align="center" gap={2}>
                <Input
                  type="color"
                  value={borderColor}
                  onChange={(event) => onBorderColorChange(event.target.value)}
                  minW="24px"
                />
              </Flex>
            </Stack>
            <Button
              colorPalette={accentColor}
              onClick={onCreateFlair}
              loading={creating}
              minW="160px"
            >
              Create flair
            </Button>
          </Stack>
          <Stack gap={3}>
            <Text fontSize="sm" color="gray.400">
              Preview
            </Text>
            <Box
              px="3"
              py="2"
              borderWidth="1px"
              borderColor="gray.800"
              borderRadius="lg"
              display="inline-flex"
            >
              <TitleBadge title={previewTitle} />
            </Box>
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
          <Heading size="md">Assign flair to player</Heading>
          <Stack gap={3} direction={{ base: "column", md: "row" }}>
            <Box flex="1">
              <Text fontSize="sm" color="gray.400" mb="1">
                Search players
              </Text>
              <Flex gap={2}>
                <Input
                  value={searchTerm}
                  onChange={(event) => onSearchTermChange(event.target.value)}
                  placeholder="Name or UID"
                />
                <Button
                  colorPalette={accentColor}
                  onClick={onSearch}
                  loading={searchLoading}
                >
                  Search
                </Button>
              </Flex>
              {searchError ? (
                <Text mt="2" fontSize="xs" color="red.300">
                  {searchError}
                </Text>
              ) : null}
            </Box>
            <Stack flex="1" gap={2}>
              <Text fontSize="sm" color="gray.400">
                Selected player
              </Text>
              {selectedUser ? (
                <Box
                  borderWidth="1px"
                  borderColor="gray.700"
                  borderRadius="md"
                  p="3"
                >
                  <Text>{selectedUser.userName ?? selectedUser.uid}</Text>
                  <Text fontSize="xs" color="gray.500">
                    UID: {selectedUser.uid}
                  </Text>
                  <TitleBadge title={selectedUser.userTitle} />
                </Box>
              ) : (
                <Text fontSize="sm" color="gray.500">
                  Pick a player from the search results.
                </Text>
              )}
            </Stack>
          </Stack>
          <Stack gap={3}>
            {searchLoading ? (
              <Flex justify="center" py="4">
                <Spinner />
              </Flex>
            ) : (
              <Stack gap={2}>
                {searchResults.map((user, index) => {
                  const userId =
                    user.uid ??
                    user.userEmail ??
                    user.userName ??
                    `search-result-${index}`
                  return (
                    <Button
                      key={userId}
                      variant="outline"
                      onClick={() => onSelectUser(user)}
                      justifyContent="space-between"
                      size="sm"
                    >
                      <Box textAlign="left">
                        <Text fontWeight="semibold">
                          {user.userName || user.uid}
                        </Text>
                        <Text fontSize="xs" color="gray.500">
                          UID: {user.uid}
                        </Text>
                      </Box>
                      <TitleBadge title={user.userTitle} />
                    </Button>
                  )
                })}
              </Stack>
            )}
          </Stack>
          <Box height="1px" bg="gray.800" width="full" />
          <Stack gap={3}>
            <Text fontSize="sm" color="gray.400">
              Conditional flair pool
            </Text>
            {flairsLoading ? (
              <Flex justify="center" py="4">
                <Spinner />
              </Flex>
            ) : conditionalFlairs.length ? (
              <SimpleGrid columns={{ base: 1, md: 2, xl: 3 }} gap="3">
                {conditionalFlairs.map((flair, index) => (
                  <SelectableFlairButton
                    key={`conditional-${flair.title}-${index}`}
                    flair={flair}
                    isActive={
                      selectedConditionalFlair?.title === flair.title &&
                      selectedConditionalFlair?.bgColor === flair.bgColor &&
                      selectedConditionalFlair?.color === flair.color &&
                      selectedConditionalFlair?.border === flair.border
                    }
                    onClick={() => onSelectConditionalFlair(flair)}
                  />
                ))}
              </SimpleGrid>
            ) : (
              <Text fontSize="sm" color="gray.500">
                No conditional flairs yet. Create one to grant exclusive titles.
              </Text>
            )}
          </Stack>
          <Button
            colorPalette={accentColor}
            disabled={!selectedUser || !selectedConditionalFlair}
            onClick={onAssignFlair}
            loading={assigning}
          >
            Assign flair
          </Button>
        </Stack>
      </Box>
    </Stack>
  )
}
