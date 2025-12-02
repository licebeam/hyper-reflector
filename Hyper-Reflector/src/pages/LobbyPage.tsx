import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useCallback,
} from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  useMessageStore,
  useUserStore,
  useSettingsStore,
} from "../state/store";
import { useTranslation } from "react-i18next";
import {
  Stack,
  Box,
  Button,
  Input,
  Flex,
  Text,
  IconButton,
  CollapsibleContent,
  CollapsibleRoot,
  CollapsibleTrigger,
  createListCollection,
} from "@chakra-ui/react";
import type { SelectValueChangeDetails } from "@chakra-ui/react";
import {
  SelectContent,
  SelectItem,
  SelectRoot,
  SelectTrigger,
  SelectValueText,
} from "../components/chakra/ui/select";
import {
  Send,
  Search,
  ChevronDown,
  ChevronUp,
  ArrowDown,
  Swords,
} from "lucide-react";
import UserCardSmall from "../components/UserCard/UserCardSmall";
import type { TUser } from "../types/user";
import { toaster } from "../components/chakra/ui/toaster";
import { highlightMentions } from "../utils/chatFormatting";
import { resolvePingBetweenUsers } from "../utils/ping";
import MatchCard from "../components/UserCard/MatchCard";
import { DEBUG_MOCK_MATCH_ID } from "../layout/helpers/mockUsers";

const MAX_MESSAGE_LENGTH = 120;

type EloFilter = "ALL" | "ROOKIE" | "INTERMEDIATE" | "EXPERT";
type PingFilter = "ALL" | "FAST" | "MODERATE" | "SLOW" | "UNKNOWN";

type SelectOption = { label: string; value: string };

const ELO_OPTION_DEFS: Array<{ value: EloFilter; labelKey: string }> = [
  { value: "ALL", labelKey: "Lobby.elo.all" },
  { value: "ROOKIE", labelKey: "Lobby.elo.rookie" },
  { value: "INTERMEDIATE", labelKey: "Lobby.elo.intermediate" },
  { value: "EXPERT", labelKey: "Lobby.elo.expert" },
];

const PING_OPTION_DEFS: Array<{
  value: PingFilter;
  labelKey: string;
  fallback: string;
}> = [
  { value: "ALL", labelKey: "Lobby.ping.all", fallback: "All pings" },
  { value: "FAST", labelKey: "Lobby.ping.fast", fallback: "< 80 ms" },
  {
    value: "MODERATE",
    labelKey: "Lobby.ping.moderate",
    fallback: "80 - 160 ms",
  },
  { value: "SLOW", labelKey: "Lobby.ping.slow", fallback: "> 160 ms" },
  {
    value: "UNKNOWN",
    labelKey: "Lobby.ping.unknown",
    fallback: "Ping unknown",
  },
];

export default function LobbyPage() {
  const theme = useSettingsStore((s) => s.theme);
  const { t } = useTranslation();
  const globalUser = useUserStore((s) => s.globalUser);
  const lobbyUsers = useUserStore((s) => s.lobbyUsers);
  const currentMatches = useUserStore((s) => s.currentMatches);
  const chatMessages = useMessageStore((s) => s.chatMessages);
  const [message, setMessage] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [countryFilter, setCountryFilter] = useState("ALL");
  const [eloFilter, setEloFilter] = useState<EloFilter>("ALL");
  const mutedUsers = useSettingsStore((s) => s.mutedUsers);
  const [pingFilter, setPingFilter] = useState<PingFilter>("ALL");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const lobbyRoster = useMemo<TUser[]>(() => {
    if (lobbyUsers.length) {
      return lobbyUsers;
    }
    return globalUser ? [globalUser] : [];
  }, [globalUser, lobbyUsers]);

  const mentionHandles = useMemo(() => {
    const handles = new Set<string>();
    lobbyRoster.forEach((user) => {
      if (user.userName?.trim()) handles.add(user.userName.trim());
      if (Array.isArray(user.knownAliases)) {
        user.knownAliases.forEach((alias) => {
          if (alias?.trim()) handles.add(alias.trim());
        });
      }
    });
    return Array.from(handles);
  }, [lobbyRoster]);

  const countryCodes = useMemo(() => {
    const codes = new Set<string>();
    lobbyRoster.forEach((user) => {
      if (user.countryCode) {
        codes.add(user.countryCode.toUpperCase());
      }
    });
    return Array.from(codes).sort();
  }, [lobbyRoster]);

  const countryOptions = useMemo<SelectOption[]>(() => {
    const items: SelectOption[] = [
      { label: t("Lobby.allCountries"), value: "ALL" },
    ];
    countryCodes.forEach((code) => items.push({ label: code, value: code }));
    return items;
  }, [countryCodes, t]);

  const countryCollection = useMemo(
    () =>
      createListCollection<SelectOption>({
        items: countryOptions,
        itemToValue: (item) => item.value,
        itemToString: (item) => item.label,
      }),
    [countryOptions]
  );

  const localizedEloOptions = useMemo<SelectOption[]>(
    () =>
      ELO_OPTION_DEFS.map(({ value, labelKey }) => ({
        value,
        label: t(labelKey),
      })),
    [t]
  );

  const eloCollection = useMemo(
    () =>
      createListCollection<SelectOption>({
        items: localizedEloOptions,
        itemToValue: (item) => item.value,
        itemToString: (item) => item.label,
      }),
    [localizedEloOptions]
  );

  const localizedPingOptions = useMemo<SelectOption[]>(
    () =>
      PING_OPTION_DEFS.map(({ value, labelKey, fallback }) => ({
        value,
        label: t(labelKey, { defaultValue: fallback }),
      })),
    [t]
  );

  const pingCollection = useMemo(
    () =>
      createListCollection<SelectOption>({
        items: localizedPingOptions,
        itemToValue: (item) => item.value,
        itemToString: (item) => item.label,
      }),
    [localizedPingOptions]
  );

  const navigate = useNavigate();

  useEffect(() => {
    if (
      countryFilter !== "ALL" &&
      !countryOptions.some((option) => option.value === countryFilter)
    ) {
      setCountryFilter("ALL");
    }
  }, [countryFilter, countryOptions]);

  useEffect(() => {
    if (
      pingFilter !== "ALL" &&
      !localizedPingOptions.some((option) => option.value === pingFilter)
    ) {
      setPingFilter("ALL");
    }
  }, [localizedPingOptions, pingFilter]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "auto", block: "end" });
  }, []);

  const sendMessage = useCallback(() => {
    const trimmed = message.trim();
    if (!trimmed.length) {
      return;
    }
    if (trimmed.length > MAX_MESSAGE_LENGTH) {
      setMessage(trimmed.slice(0, MAX_MESSAGE_LENGTH));
      return;
    }

    window.dispatchEvent(
      new CustomEvent("ws:send-message", {
        detail: {
          text: trimmed,
          onSuccess: () => setMessage(""),
          onError: (error?: string) => {
            if (!error) return;
            toaster.error({
              title: "Unable to send message",
              description: error,
            });
          },
        },
      })
    );
  }, [message]);

  function useAutoScrollOnNewContent(
    ref: React.RefObject<HTMLElement | null>,
    deps: any[],
    pad = 120
  ) {
    useLayoutEffect(() => {
      const el = ref.current;
      if (!el) return;
      const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
      const isNearBottom = distFromBottom < pad;
      if (isNearBottom) {
        el.scrollTop = el.scrollHeight;
      }
    }, deps);
  }

  const handleCountryChange = (
    details: SelectValueChangeDetails<SelectOption>
  ) => {
    const next = details.items[0]?.value ?? "ALL";
    setCountryFilter(next);
  };

  const handleEloChange = (details: SelectValueChangeDetails<SelectOption>) => {
    const next = (details.items[0]?.value as EloFilter | undefined) ?? "ALL";
    setEloFilter(next);
  };

  const handlePingChange = (
    details: SelectValueChangeDetails<SelectOption>
  ) => {
    const next = (details.items[0]?.value as PingFilter | undefined) ?? "ALL";
    setPingFilter(next);
  };

  const formatChatTimestamp = (timestamp?: number) => {
    if (!timestamp) {
      return "";
    }
    try {
      const date = new Date(timestamp);
      return `${date.toLocaleDateString()} ${date.toLocaleTimeString()}`;
    } catch {
      return "";
    }
  };

  const visibleChatMessages = useMemo(
    () =>
      chatMessages.filter((msg) => {
        const senderId =
          msg.senderUid ||
          msg.challengeChallengerId ||
          (typeof (msg as any).senderId === "string"
            ? (msg as any).senderId
            : undefined);
        if (senderId && mutedUsers.includes(senderId)) {
          return false;
        }
        return true;
      }),
    [chatMessages, mutedUsers]
  );

  const filteredUsers = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return lobbyRoster
      .filter((user) => {
        if (
          user.currentMatchId &&
          user.currentMatchId !== DEBUG_MOCK_MATCH_ID
        ) {
          return false;
        }
        return true;
      })
      .filter((user) => {
        const matchesSearch =
          !query || user.userName.toLowerCase().includes(query);

        const matchesCountry =
          countryFilter === "ALL" ||
          user.countryCode.toUpperCase() === countryFilter;

        let matchesElo = true;
        switch (eloFilter) {
          case "ROOKIE":
            matchesElo = user.accountElo < 1500;
            break;
          case "INTERMEDIATE":
            matchesElo = user.accountElo >= 1500 && user.accountElo < 2000;
            break;
          case "EXPERT":
            matchesElo = user.accountElo >= 2000;
            break;
          default:
            matchesElo = true;
            break;
        }

        const pingInfo = resolvePingBetweenUsers(user, globalUser);
        const pingValue = pingInfo.ping;
        let matchesPing = true;
        switch (pingFilter) {
          case "FAST":
            matchesPing = pingValue !== null && pingValue < 80;
            break;
          case "MODERATE":
            matchesPing =
              pingValue !== null && pingValue >= 80 && pingValue <= 160;
            break;
          case "SLOW":
            matchesPing = pingValue !== null && pingValue > 160;
            break;
          case "UNKNOWN":
            matchesPing = pingValue === null;
            break;
          default:
            matchesPing = true;
            break;
        }

        return matchesSearch && matchesCountry && matchesElo && matchesPing;
      })
      .sort((a, b) => a.userName.localeCompare(b.userName));
  }, [
    countryFilter,
    eloFilter,
    globalUser,
    lobbyRoster,
    pingFilter,
    searchQuery,
  ]);

  const endRef = useRef<HTMLDivElement>(null);
  const boxRef = useRef<HTMLDivElement | null>(null);
  useAutoScrollOnNewContent(boxRef, [visibleChatMessages.length]);

  const scrollChatToBottom = (behavior: ScrollBehavior = "smooth") => {
    const el = boxRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior });
    setShowScrollButton(false);
  };

  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const handleScroll = () => {
      const distanceFromBottom =
        el.scrollHeight - el.scrollTop - el.clientHeight;
      setShowScrollButton(distanceFromBottom > 120);
    };
    handleScroll();
    el.addEventListener("scroll", handleScroll);
    return () => el.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    if (distanceFromBottom <= 24) {
      setShowScrollButton(false);
    }
  }, [visibleChatMessages.length]);

  return (
    <Box display="flex" maxH="100%" minH="100%">
      <Box
        display="flex"
        flexDirection="column"
        maxH="100%"
        minH="100%"
        flex="9"
        position="relative"
      >
        <Stack
          key="chat"
          scrollbarWidth="thin"
          id="chatbox-id"
          minH={0}
          overflowY={"scroll"}
          ref={boxRef}
        >
          {visibleChatMessages.map((msg) => {
            const isSelf = msg.userName === globalUser?.userName;
            const isChallenge = msg.role === "challenge";
            const challengeStatus = msg.challengeStatus;
            const responderLabel =
              msg.challengeResponder && msg.challengeResponder.length
                ? msg.challengeResponder
                : "Unknown player";
            const messageHtml = highlightMentions(
              msg.text ?? "failed message",
              mentionHandles
            );

            const handleChallengeDecision = (accepted: boolean) => {
              window.dispatchEvent(
                new CustomEvent("lobby:challenge-response", {
                  detail: {
                    messageId: msg.id,
                    accepted,
                    responderName: globalUser?.userName,
                    kind: msg.challengeKind ?? "match",
                  },
                })
              );
            };

            return (
              <Stack
                bgColor={"bg.emphasized"}
                padding={"2"}
                key={msg.id + "lobby"}
              >
                <Flex
                  justifyContent="space-between"
                  gap="2"
                  alignItems="center"
                >
                  <Text
                    fontWeight="semibold"
                    color={isSelf ? `${theme.colorPalette}.500` : undefined}
                  >
                    {msg.userName}
                  </Text>
                  <Text fontSize="xs" color="gray.500">
                    {formatChatTimestamp(msg.timeStamp)}
                  </Text>
                </Flex>
                {isChallenge ? (
                  <Stack gap="2">
                    <Flex alignItems="center" gap="2">
                      <Swords size={16} />
                      <Text maxW="60ch" whiteSpace="pre-wrap">
                        {msg.text || "Incoming challenge"}
                      </Text>
                    </Flex>
                    {challengeStatus ? (
                      <Text
                        fontSize="xs"
                        color={
                          challengeStatus === "accepted"
                            ? `${theme.colorPalette}.500`
                            : "red.300"
                        }
                      >
                        {`Challenge ${challengeStatus} by ${responderLabel}.`}
                      </Text>
                    ) : (
                      <Flex gap="2">
                        <Button
                          size="sm"
                          colorPalette={theme.colorPalette}
                          onClick={() => handleChallengeDecision(true)}
                        >
                          Accept
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleChallengeDecision(false)}
                        >
                          Decline
                        </Button>
                      </Flex>
                    )}
                  </Stack>
                ) : (
                  <Box
                    maxW="60ch"
                    sx={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}
                    dangerouslySetInnerHTML={{ __html: messageHtml }}
                  />
                )}
              </Stack>
            );
          })}
          <div ref={endRef}></div>
        </Stack>
        <Stack flex="1" height="100%" flexDirection={"column-reverse"}>
          <Flex gap="2" padding="8px">
            <Input
              placeholder={t("Lobby.messagePlaceholder")}
              maxW="300px"
              autoFocus
              maxLength={MAX_MESSAGE_LENGTH}
              onChange={(e) =>
                setMessage(e.target.value.slice(0, MAX_MESSAGE_LENGTH))
              }
              type="text"
              value={message}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  sendMessage();
                }
              }}
            />
            <Button
              id="message-send-btn"
              onClick={sendMessage}
              colorPalette={theme.colorPalette}
            >
              <Send />
            </Button>
          </Flex>
        </Stack>
        <Box
          position="absolute"
          bottom="40px"
          right="20px"
          transition="opacity 0.2s ease, transform 0.2s ease"
          opacity={showScrollButton ? 1 : 0}
          pointerEvents={showScrollButton ? "auto" : "none"}
          transform={showScrollButton ? "translateY(0)" : "translateY(8px)"}
        >
          <IconButton
            colorPalette={theme.colorPalette}
            aria-label={t("Lobby.scrollToLatest")}
            onClick={() => scrollChatToBottom()}
            size="sm"
            variant="solid"
          >
            <ArrowDown size={16} />
          </IconButton>
        </Box>
      </Box>
      <Box
        scrollbarWidth="thin"
        display="flex"
        flexDirection="column"
        maxH="100%"
        minH="100%"
        flex="4"
        overflow="hidden"
      >
        <CollapsibleRoot
          open={filtersOpen}
          onOpenChange={({ open }) => setFiltersOpen(open)}
          width="100%"
        >
          <Flex align="center" justify="space-between" px="4" py="2">
            <Text fontSize="sm" fontWeight="semibold">
              {t("Lobby.filters")}
            </Text>
            <CollapsibleTrigger asChild>
              <IconButton
                colorPalette={theme.colorPalette}
                aria-label={
                  filtersOpen ? t("Lobby.hideFilters") : t("Lobby.showFilters")
                }
                variant="ghost"
                size="sm"
              >
                {filtersOpen ? (
                  <ChevronUp size={16} />
                ) : (
                  <ChevronDown size={16} />
                )}
              </IconButton>
            </CollapsibleTrigger>
          </Flex>
          <CollapsibleContent>
            <Stack padding="4" gap="3">
              <Box position="relative">
                <Input
                  colorPalette={theme.colorPalette}
                  pl="8"
                  placeholder={t("Lobby.searchPlaceholder")}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  aria-label="Search users"
                />
                <Box
                  pointerEvents="none"
                  position="absolute"
                  insetY="0"
                  left="3"
                  display="flex"
                  alignItems="center"
                  color="gray.500"
                >
                  <Search size={16} />
                </Box>
              </Box>
              <Flex gap="2" flexWrap="wrap">
                <SelectRoot<SelectOption>
                  collection={countryCollection}
                  value={[countryFilter]}
                  onValueChange={handleCountryChange}
                  width="200px"
                >
                  <SelectTrigger clearable={countryFilter !== "ALL"}>
                    <SelectValueText placeholder={t("Lobby.allCountries")} />
                  </SelectTrigger>
                  <SelectContent>
                    {countryOptions.map((option) => (
                      <SelectItem key={option.value} item={option}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </SelectRoot>
                <SelectRoot<SelectOption>
                  collection={eloCollection}
                  value={[eloFilter]}
                  onValueChange={handleEloChange}
                  width="200px"
                >
                  <SelectTrigger clearable={eloFilter !== "ALL"}>
                    <SelectValueText placeholder={t("Lobby.elo.all")} />
                  </SelectTrigger>
                  <SelectContent>
                    {localizedEloOptions.map((option) => (
                      <SelectItem key={option.value} item={option}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </SelectRoot>
                <SelectRoot<SelectOption>
                  collection={pingCollection}
                  value={[pingFilter]}
                  onValueChange={handlePingChange}
                  width="200px"
                >
                  <SelectTrigger clearable={pingFilter !== "ALL"}>
                    <SelectValueText
                      placeholder={"All pings"}
                      // placeholder={t("Lobby.ping.all", {
                      //   defaultValue: "All pings",
                      // })}
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {localizedPingOptions.map((option) => (
                      <SelectItem key={option.value} item={option}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </SelectRoot>
              </Flex>
            </Stack>
          </CollapsibleContent>
        </CollapsibleRoot>

        <Box borderTopWidth="1px" borderColor="gray.700" />
        <Stack
          flex="1"
          overflowY="auto"
          padding="4"
          gap="2"
          scrollbarWidth="thin"
        >
          <Text fontSize="sm" color="gray.500">
            {t("Lobby.showingUsers", {
              count: filteredUsers.length,
              total: lobbyRoster.length,
            })}
          </Text>
          {filteredUsers.length === 0 ? (
            <Text fontSize="sm" color="gray.500">
              {t("Lobby.noMatches")}
            </Text>
          ) : (
            filteredUsers.map((user) => (
              <UserCardSmall
                key={user.uid}
                user={user}
                isSelf={user.uid === globalUser?.uid}
                onChallenge={(target) =>
                  window.dispatchEvent(
                    new CustomEvent("lobby:challenge-user", {
                      detail: { targetUid: target.uid },
                    })
                  )
                }
                onRpsChallenge={(target) =>
                  window.dispatchEvent(
                    new CustomEvent("lobby:rps-duel", {
                      detail: { targetUid: target.uid },
                    })
                  )
                }
                onViewProfile={(target) =>
                  navigate({
                    to: "/profile/$userId",
                    params: { userId: target.uid },
                  })
                }
              />
            ))
          )}
        </Stack>
        {currentMatches.length ? (
          <Box
            padding="3"
            maxHeight="120px"
            overflowY="scroll"
            scrollbarWidth="thin"
          >
            <Box borderTopWidth="1px" borderColor="gray.700" pt="2" />
            <Stack gap="2">
              <Text fontSize="sm" color="gray.400">
                Current matches ({currentMatches.length})
              </Text>
              {currentMatches.map((match) => (
                <MatchCard key={match.id} match={match} />
              ))}
            </Stack>
          </Box>
        ) : null}
      </Box>
    </Box>
  );
}
