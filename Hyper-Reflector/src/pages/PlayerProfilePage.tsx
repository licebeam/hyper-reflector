import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Avatar,
  Box,
  Button,
  CardBody,
  CardHeader,
  CardRoot,
  Flex,
  Heading,
  IconButton,
  Input,
  SimpleGrid,
  Spinner,
  Stack,
  Text,
  useDisclosure,
  useToken,
} from "@chakra-ui/react";
import { useNavigate, useParams } from "@tanstack/react-router";
import {
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  RefreshCcw,
  Save,
} from "lucide-react";
import {
  RegExpMatcher,
  englishDataset,
  englishRecommendedTransformers,
} from "obscenity";
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip as RechartTooltip,
} from "recharts";
import { auth } from "../utils/firebase";
import api from "../external-api/requests";
import { useUserStore } from "../state/store";
import TitleBadge from "../components/TitleBadge";
import WinStreakIndicator from "../components/WinStreakIndicator";
import SelectableFlairButton from "../components/SelectableFlairButton";
import type { TUser, TUserTitle } from "../types/user";
import { toaster } from "../components/chakra/ui/toaster";
import {
  DrawerBody,
  DrawerCloseTrigger,
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
  DrawerRoot,
} from "../components/chakra/ui/drawer";
import { requestSocketStateUpdate } from "../layout/helpers/socketBridge";

type SuperArtStats = {
  wins?: number;
  losses?: number;
};

type PlayerCharacterStats = {
  picks: number;
  superChoice?: Array<SuperArtStats> | Record<string, SuperArtStats>;
};

type PlayerStats = {
  totalWins?: number;
  totalLosses?: number;
  totalGames?: number;
  longestWinStreak?: number;
  winStreak?: number;
  accountElo?: number;
  characters?: Record<string, PlayerCharacterStats>;
};

type PlayerMatch = {
  id?: string;
  sessionId?: string;
  timestamp?: number;
  player1Name?: string;
  player2Name?: string;
  p1Wins?: number;
  p2Wins?: number;
};

const matcher = new RegExpMatcher({
  ...englishDataset.build(),
  ...englishRecommendedTransformers,
});

function normalizeSuperChoices(
  choice?: PlayerCharacterStats["superChoice"]
): SuperArtStats[] {
  if (!choice) return [];
  if (Array.isArray(choice)) return choice;
  return Object.values(choice);
}

function CharacterSuperArtDonut({
  name,
  stats,
  colors,
}: {
  name: string;
  stats: PlayerCharacterStats;
  colors: readonly string[];
}) {
  const superChoices = normalizeSuperChoices(stats.superChoice);
  const saData = [0, 1, 2].map((index) => {
    const entry = superChoices[index];
    return {
      name: `SA ${index + 1}`,
      value: (entry?.wins || 0) + (entry?.losses || 0),
      color: colors[index] || colors[0],
    };
  });
  const hasData = saData.some((entry) => entry.value > 0);

  return (
    <Stack
      gap={2}
      align="center"
      borderWidth="1px"
      borderColor="gray.800"
      borderRadius="lg"
      padding="4"
    >
      <Text fontWeight="semibold">{name}</Text>
      {hasData ? (
        <Box w="140px" h="140px">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <RechartTooltip />
              <Pie
                innerRadius={40}
                outerRadius={60}
                isAnimationActive={false}
                data={saData}
                dataKey="value"
              >
                {saData.map((item, index) => (
                  <Cell key={item.name} fill={colors[index] || colors[0]} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        </Box>
      ) : (
        <Text fontSize="xs" color="gray.500">
          No data
        </Text>
      )}
      <Text fontSize="sm" color="gray.400">
        Picks {stats.picks || 0}
      </Text>
    </Stack>
  );
}

export default function PlayerProfilePage() {
  const params = useParams({ from: "/profile/$userId" });
  const requestedUserId = params?.userId;
  const globalUser = useUserStore((s) => s.globalUser);
  const setGlobalUser = useUserStore((s) => s.setGlobalUser);
  const setLobbyUsers = useUserStore((s) => s.setLobbyUsers);
  const navigate = useNavigate();
  const profileUid = requestedUserId || globalUser?.uid || null;
  const isSelf = Boolean(profileUid && profileUid === globalUser?.uid);
  const superArtColors = useToken("colors", [
    "yellow.500",
    "orange.500",
    "blue.500",
  ]);

  const [profile, setProfile] = useState<TUser | null>(null);
  const [playerStats, setPlayerStats] = useState<PlayerStats | null>(null);
  const [titles, setTitles] = useState<TUserTitle[]>([]);
  const [matches, setMatches] = useState<PlayerMatch[]>([]);
  const [matchCursor, setMatchCursor] = useState<{
    last?: string | null;
    first?: string | null;
    total?: number;
  }>({});
  const [profileLoading, setProfileLoading] = useState(true);
  const [matchesLoading, setMatchesLoading] = useState(true);
  const [nameDraft, setNameDraft] = useState("");
  const [nameInvalid, setNameInvalid] = useState(false);
  const [pendingTitle, setPendingTitle] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [isTitleDrawerOpen, setTitleDrawerOpen] = useState(false);
  const charDisclosure = useDisclosure({ defaultOpen: false });
  const matchesDisclosure = useDisclosure({ defaultOpen: false });

  const normalizeUserForProfile = useCallback(
    (user: TUser | (TUser & { winStreak?: number })) => {
      const streak =
        typeof (user as any).winStreak === "number"
          ? (user as any).winStreak
          : 0;
      const longest =
        typeof (user as any).longestWinStreak === "number"
          ? (user as any).longestWinStreak
          : undefined;
      return { ...user, winStreak: streak, longestWinStreak: longest };
    },
    []
  );

  const canEdit = isSelf && Boolean(profileUid);

  const winStats = useMemo(() => {
    const totalGames = playerStats?.totalGames ?? 0;
    const totalWins = playerStats?.totalWins ?? 0;
    const totalLosses = playerStats?.totalLosses ?? 0;
    const winRate =
      totalGames > 0 ? ((totalWins / totalGames) * 100).toFixed(1) : "0.0";
    return { totalGames, totalWins, totalLosses, winRate };
  }, [playerStats]);

  const characterEntries = useMemo(() => {
    if (!playerStats?.characters) return [];
    return Object.entries(playerStats.characters).sort(
      (a, b) => (b[1]?.picks || 0) - (a[1]?.picks || 0)
    );
  }, [playerStats]);

  const mergeTitlePools = useCallback(
    (base: TUserTitle[], extras?: TUserTitle[]) => {
      if (!extras || !extras.length) return base;
      const seen = new Set(base.map((title) => (title.title || "").trim()));
      const filtered = extras.filter((entry) => {
        const key = (entry.title || "").trim();
        return key.length && !seen.has(key);
      });
      if (!filtered.length) return base;
      return [...base, ...filtered];
    },
    []
  );

  const titleOptions = useMemo(
    () =>
      titles.map((title, index) => ({
        label: title.title,
        value: String(index),
        data: title,
      })),
    [titles]
  );

  const currentWinStreak = profile?.winStreak ?? 0;
  const currentElo = playerStats?.accountElo ?? profile?.accountElo;
  const displayElo =
    currentElo !== undefined && currentElo !== null
      ? Math.round(currentElo)
      : null;

  useEffect(() => {
    if (!profileUid || !auth.currentUser) {
      setProfile(null);
      setPlayerStats(null);
      setMatches([]);
      return;
    }
    setProfileLoading(true);
    let normalizedUserProfile: TUser | null = null;
    const loadProfile = async () => {
      try {
        const [userData, statsData, titlesData] = await Promise.all([
          api.getUserData(auth, profileUid),
          api.getPlayerStats(auth, profileUid),
          canEdit ? api.getAllTitles(auth, profileUid) : Promise.resolve(null),
        ]);
        if (userData) {
          const normalizedUser = normalizeUserForProfile(userData as TUser);
          setProfile(normalizedUser);
          setNameDraft(normalizedUser.userName || "");
          normalizedUserProfile = normalizedUser;
        }
        if (statsData?.playerStatSet) {
          setPlayerStats(statsData.playerStatSet as PlayerStats);
        } else if (statsData) {
          setPlayerStats(statsData as PlayerStats);
        }
        const serverTitles =
          titlesData?.titleData?.titles &&
          Array.isArray(titlesData.titleData.titles)
            ? (titlesData.titleData.titles as TUserTitle[])
            : [];
        const assignedTitles = Array.isArray(
          normalizedUserProfile?.assignedFlairs
        )
          ? normalizedUserProfile.assignedFlairs
          : [];
        if (serverTitles.length || assignedTitles.length) {
          setTitles(mergeTitlePools(serverTitles, assignedTitles));
        } else {
          setTitles([]);
        }
      } catch (error) {
        console.error("Failed to load profile", error);
        toaster.create({
          title: "Unable to load profile",
          description: "Please try again shortly.",
        });
      } finally {
        setProfileLoading(false);
      }
    };
    void loadProfile();
  }, [profileUid, canEdit, normalizeUserForProfile, mergeTitlePools]);

  const fetchMatches = useCallback(
    async (direction: "initial" | "next" | "prev") => {
      if (!profileUid || !auth.currentUser) return;
      setMatchesLoading(true);
      try {
        const nextCursor: string | null =
          direction === "next" ? matchCursor.last ?? null : null;
        const prevCursor: string | null =
          direction === "prev" ? matchCursor.first ?? null : null;
        const response = await (
          api.getUserMatches as unknown as (
            auth: unknown,
            userId: string,
            lastMatchId?: string | null,
            firstMatchId?: string | null
          ) => Promise<any>
        )(auth, profileUid, nextCursor, prevCursor);
        if (response?.matches) {
          setMatches(response.matches as PlayerMatch[]);
          setMatchCursor({
            last: response.lastVisible,
            first: response.firstVisible,
            total: response.totalMatches,
          });
        } else if (direction === "initial") {
          setMatches([]);
          setMatchCursor({});
        }
      } catch (error) {
        console.error("Failed to load matches", error);
        toaster.create({
          title: "Unable to load matches",
          description: "Try again later.",
        });
      } finally {
        setMatchesLoading(false);
      }
    },
    [profileUid, matchCursor.last, matchCursor.first]
  );

  useEffect(() => {
    if (profileUid && auth.currentUser) {
      void fetchMatches("initial");
    }
  }, [fetchMatches, profileUid]);

  useEffect(() => {
    if (!nameDraft.trim()) {
      setNameInvalid(true);
      return;
    }
    setNameInvalid(matcher.hasMatch(nameDraft));
  }, [nameDraft]);

  useEffect(() => {
    if (!profile || !titles.length) return;
    const currentTitleIndex = titles.findIndex(
      (title) => title.title === profile.userTitle?.title
    );
    if (currentTitleIndex >= 0) {
      setPendingTitle(String(currentTitleIndex));
    } else {
      setPendingTitle("");
    }
  }, [profile, titles]);

  const saveProfileChanges = async () => {
    if (!canEdit || !profile || !auth.currentUser) return;
    const payload: Record<string, unknown> = {};
    const trimmedName = nameDraft.trim();
    if (!nameInvalid && trimmedName && trimmedName !== profile.userName) {
      payload.userName = trimmedName;
    }
    if (pendingTitle) {
      const selected = titleOptions.find(
        (option) => option.value === pendingTitle
      )?.data;
      if (selected && selected.title !== profile.userTitle?.title) {
        payload.userTitle = selected;
      }
    }
    if (!Object.keys(payload).length) {
      toaster.create({
        title: "Nothing to update",
        description: "Change your name or title before saving.",
      });
      return;
    }
    setSaving(true);
    try {
      await api.updateUserData(auth, payload);
      setProfile((prev) => (prev ? { ...prev, ...payload } : prev));
      if (isSelf && globalUser) {
        const nextViewer = { ...globalUser, ...payload };
        setGlobalUser(nextViewer);
        const currentLobbyUsers = useUserStore.getState().lobbyUsers;
        setLobbyUsers(
          currentLobbyUsers.map((entry) =>
            entry.uid === nextViewer.uid ? { ...entry, ...payload } : entry
          )
        );
      }
      if (payload.userName) {
        requestSocketStateUpdate({ key: "userName", value: payload.userName });
      }
      if (payload.userTitle) {
        requestSocketStateUpdate({
          key: "userTitle",
          value: payload.userTitle,
        });
      }
      toaster.create({
        title: "Profile updated",
      });
    } catch (error) {
      console.error("Failed to update profile", error);
      toaster.create({
        title: "Update failed",
        description: "Please try again shortly.",
      });
    } finally {
      setSaving(false);
    }
  };

  if (!profileUid) {
    return (
      <Stack gap={6} padding="8">
        <Heading size="lg">Player profile</Heading>
        <Text color="gray.400">
          Select a player from the search page to view their profile.
        </Text>
        <Button onClick={() => navigate({ to: "/profile" })}>
          Back to profiles
        </Button>
      </Stack>
    );
  }

  return (
    <Stack gap={8} padding={{ base: 4, md: 8 }}>
      <Flex
        justify="space-between"
        align={{ base: "stretch", md: "center" }}
        direction={{ base: "column", md: "row" }}
        gap={4}
      >
        <Button variant="ghost" onClick={() => navigate({ to: "/profile" })}>
          <Flex align="center" gap="2">
            <ArrowLeft size={16} />
            <span>Back to profiles</span>
          </Flex>
        </Button>
        <Button
          variant="outline"
          onClick={() => {
            void fetchMatches("initial");
            if (profileUid && auth.currentUser) {
              setProfileLoading(true);
              void (async () => {
                try {
                  const userData = await api.getUserData(auth, profileUid);
                  if (userData) {
                    const normalizedUser = normalizeUserForProfile(
                      userData as TUser
                    );
                    setProfile(normalizedUser);
                    setNameDraft(normalizedUser.userName || "");
                  }
                } finally {
                  setProfileLoading(false);
                }
              })();
            }
          }}
          disabled={!profile}
        >
          <Flex align="center" gap="2">
            <RefreshCcw size={16} />
            <span>Refresh data</span>
          </Flex>
        </Button>
      </Flex>

      <CardRoot bg="gray.900" borderWidth="1px" borderColor="gray.700">
        <CardBody>
          {profileLoading || !profile ? (
            <Flex justify="center" padding="8">
              <Spinner />
            </Flex>
          ) : (
            <Stack gap={6}>
              <Flex
                gap={6}
                direction={{ base: "column", md: "row" }}
                align={{ base: "flex-start", md: "center" }}
              >
                <Stack align="center" gap="2">
                  <Avatar.Root size="2xl" variant="outline">
                    <Avatar.Fallback name={profile.userName} />
                    <Avatar.Image src={profile.userProfilePic || undefined} />
                  </Avatar.Root>
                  <WinStreakIndicator value={currentWinStreak} />
                </Stack>
                <Stack gap={2} flex="1">
                  <Flex
                    align={{ base: "flex-start", md: "center" }}
                    gap="3"
                    wrap="wrap"
                  >
                    <Heading size="lg">{profile.userName}</Heading>
                    <Text fontSize="sm" color="gray.400">
                      ELO {displayElo !== null ? displayElo : "—"}
                    </Text>
                  </Flex>
                  <TitleBadge title={profile.userTitle} />
                  {/* <Text fontSize="sm" color="gray.400">
                    UID: {profile.uid}
                  </Text> */}
                  {/* <Text fontSize="sm" color="gray.400">
                    Country: {profile.countryCode || "Unknown"}
                  </Text> */}
                  <div>
                    <span
                      //  @ts-ignore // this is needed for the country code css library.
                      class={`fi fi-${
                        profile.countryCode?.toLowerCase() || "xx"
                      }`}
                    />
                  </div>
                  {Array.isArray(profile.knownAliases) &&
                  profile.knownAliases.length ? (
                    <Text fontSize="sm" color="gray.500">
                      Also known as:{" "}
                      {profile.knownAliases.slice(0, 5).join(", ")}
                    </Text>
                  ) : null}
                </Stack>
                {canEdit ? (
                  <Stack gap={4} flex="1">
                    <Box>
                      <Text fontSize="sm" color="gray.400" mb="1">
                        Display name
                      </Text>
                      <Input
                        value={nameDraft}
                        onChange={(event) => setNameDraft(event.target.value)}
                        _invalid={
                          nameInvalid ? { borderColor: "red.500" } : undefined
                        }
                      />
                      {nameInvalid ? (
                        <Text fontSize="xs" color="red.300" mt="1">
                          Please choose a different name.
                        </Text>
                      ) : null}
                    </Box>
                    <Box>
                      <Text fontSize="sm" color="gray.400" mb="1">
                        Title flair
                      </Text>
                      <Stack gap={2}>
                        <TitleBadge
                          title={
                            titleOptions.find(
                              (option) => option.value === pendingTitle
                            )?.data || profile.userTitle
                          }
                        />
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setTitleDrawerOpen(true)}
                        >
                          Change title flair
                        </Button>
                      </Stack>
                    </Box>
                    <Button
                      colorPalette="orange"
                      onClick={saveProfileChanges}
                      loading={saving}
                    >
                      <Flex align="center" gap="2">
                        <Save size={16} />
                        <span>Save profile</span>
                      </Flex>
                    </Button>
                  </Stack>
                ) : null}
              </Flex>
              <SimpleGrid columns={{ base: 1, md: 4 }} gap={4}>
                <StatCard label="Total games" value={winStats.totalGames} />
                <StatCard label="Wins" value={winStats.totalWins} />
                <StatCard label="Losses" value={winStats.totalLosses} />
                <StatCard label="Win rate" value={`${winStats.winRate}%`} />
              </SimpleGrid>
            </Stack>
          )}
        </CardBody>
      </CardRoot>

      <CardRoot bg="gray.900" borderWidth="1px" borderColor="gray.700">
        <CardHeader>
          <Flex justify="space-between" align="center">
            <Heading size="md">Character usage</Heading>
            <IconButton
              aria-label="Toggle character usage"
              variant="ghost"
              color="gray.400"
              size="sm"
              onClick={charDisclosure.onToggle}
            >
              {charDisclosure.open ? (
                <ChevronUp size={16} />
              ) : (
                <ChevronDown size={16} />
              )}
            </IconButton>
          </Flex>
        </CardHeader>
        {charDisclosure.open && (
          <CardBody>
            {characterEntries.length === 0 ? (
              <Text fontSize="sm" color="gray.500">
                No character data available yet.
              </Text>
            ) : (
              <SimpleGrid columns={{ base: 1, md: 2, xl: 3 }} gap={4}>
                {characterEntries.map(([name, stats]) => (
                  <CharacterSuperArtDonut
                    key={name}
                    name={name}
                    stats={stats}
                    colors={superArtColors}
                  />
                ))}
              </SimpleGrid>
            )}
          </CardBody>
        )}
      </CardRoot>

      <CardRoot bg="gray.900" borderWidth="1px" borderColor="gray.700">
        <CardHeader>
          <Flex justify="space-between" align="center">
            <Heading size="md">Recent matches</Heading>
            <Flex gap={2} align="center">
              {matchesDisclosure.open ? (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => fetchMatches("prev")}
                    disabled={!matchCursor.first || matchesLoading}
                  >
                    Newer
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => fetchMatches("next")}
                    disabled={!matchCursor.last || matchesLoading}
                  >
                    Older
                  </Button>
                </>
              ) : null}

              <IconButton
                aria-label="Toggle recent matches"
                variant="ghost"
                size="sm"
                color="gray.400"
                onClick={matchesDisclosure.onToggle}
              >
                {matchesDisclosure.open ? (
                  <ChevronUp size={16} />
                ) : (
                  <ChevronDown size={16} />
                )}
              </IconButton>
            </Flex>
          </Flex>
        </CardHeader>
        {matchesDisclosure.open && (
          <CardBody>
            {matchesLoading ? (
              <Flex justify="center" padding="8">
                <Spinner />
              </Flex>
            ) : matches.length === 0 ? (
              <Text fontSize="sm" color="gray.500">
                No matches recorded yet.
              </Text>
            ) : (
              <Stack gap={3}>
                {matches.map((match, index) => {
                  const date = match.timestamp
                    ? new Date(match.timestamp).toLocaleString()
                    : "Unknown date";
                  return (
                    <Box
                      key={match.id ?? `${match.sessionId}-${index}`}
                      borderWidth="1px"
                      borderColor="gray.800"
                      borderRadius="lg"
                      padding="4"
                    >
                      <Flex justify="space-between" align="center" mb="2">
                        <Heading size="sm">
                          Session {match.sessionId || "unknown"}
                        </Heading>
                        <Text fontSize="xs" color="gray.500">
                          {date}
                        </Text>
                      </Flex>
                      <Flex justify="space-between" align="center">
                        <Stack gap={1}>
                          <Text fontWeight="semibold">
                            {match.player1Name || "Player 1"}
                          </Text>
                          <Text fontSize="xs" color="gray.500">
                            Wins: {match.p1Wins ?? 0}
                          </Text>
                        </Stack>
                        <Text fontSize="sm" color="gray.400">
                          vs
                        </Text>
                        <Stack gap={1} textAlign="right">
                          <Text fontWeight="semibold">
                            {match.player2Name || "Player 2"}
                          </Text>
                          <Text fontSize="xs" color="gray.500">
                            Wins: {match.p2Wins ?? 0}
                          </Text>
                        </Stack>
                      </Flex>
                    </Box>
                  );
                })}
              </Stack>
            )}
          </CardBody>
        )}
      </CardRoot>

      <DrawerRoot
        open={isTitleDrawerOpen}
        onOpenChange={(detail) => setTitleDrawerOpen(detail.open)}
      >
        <DrawerContent maxW="md">
          <DrawerCloseTrigger />
          <DrawerHeader>
            <Stack gap={1}>
              <Heading size="md">Choose your title flair</Heading>
              <Text fontSize="sm" color="gray.400">
                Select a flair to preview it. Remember to save your profile to
                apply changes.
              </Text>
            </Stack>
          </DrawerHeader>
          <DrawerBody>
            {titleOptions.length ? (
              <Stack gap={3}>
                {titleOptions.map((option) => {
                  const isSelected = pendingTitle === option.value;
                  return (
                    <SelectableFlairButton
                      key={option.value}
                      flair={option.data}
                      label={option.data?.title}
                      isActive={isSelected}
                      onClick={() => setPendingTitle(option.value)}
                    />
                  );
                })}
              </Stack>
            ) : (
              <Text fontSize="sm" color="gray.500">
                No titles available yet.
              </Text>
            )}
          </DrawerBody>
          <DrawerFooter justifyContent="flex-end" gap="3">
            <Button variant="ghost" onClick={() => setTitleDrawerOpen(false)}>
              Close
            </Button>
            <Button
              colorPalette="orange"
              onClick={() => setTitleDrawerOpen(false)}
            >
              Use selected flair
            </Button>
          </DrawerFooter>
        </DrawerContent>
      </DrawerRoot>
    </Stack>
  );
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <Box
      borderWidth="1px"
      borderColor="gray.800"
      borderRadius="lg"
      padding="4"
      bg="gray.900"
    >
      <Text fontSize="sm" color="gray.500">
        {label}
      </Text>
      <Heading size="md">{value}</Heading>
    </Box>
  );
}
