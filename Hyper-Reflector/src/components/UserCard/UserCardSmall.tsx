import { Avatar, Box, Button, Flex, Stack, Text } from "@chakra-ui/react";
import { useEffect, useMemo, useState } from "react";
import type { KeyboardEvent, MouseEvent } from "react";
import { Tooltip } from "../chakra/ui/tooltip";
import "/node_modules/flag-icons/css/flag-icons.min.css";
import { TUser } from "../../types/user";
import TitleBadge from "../TitleBadge";
import WinStreakIndicator from "../WinStreakIndicator";
import { useUserStore, useSettingsStore } from "../../state/store";
import { resolvePingBetweenUsers } from "../../utils/ping";

type UserCardSmallProps = {
  user: TUser | undefined;
  isSelf?: boolean;
  onChallenge?: (user: TUser) => void;
  onViewProfile?: (user: TUser) => void;
  onRpsChallenge?: (user: TUser) => void;
};

export default function UserCardSmall({
  user,
  isSelf,
  onChallenge,
  onViewProfile,
  onRpsChallenge,
}: UserCardSmallProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const isInteractive = Boolean(!isSelf && user);
  const viewer = useUserStore((state) => state.globalUser);
  const mutedUsers = useSettingsStore((state) => state.mutedUsers);
  const toggleMutedUser = useSettingsStore((state) => state.toggleMutedUser);
  const isMuted = Boolean(user && mutedUsers.includes(user.uid));

  useEffect(() => {
    setMenuOpen(false);
  }, [user?.uid]);

  if (!user) {
    return null;
  }

  const toggleMenu = () => {
    if (!isInteractive) return;
    setMenuOpen((prev) => !prev);
  };

  const handleKeyToggle = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!isInteractive) return;
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      toggleMenu();
    }
  };

  const handleChallenge = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    if (!isInteractive || !onChallenge) return;
    onChallenge(user);
    setMenuOpen(false);
  };

  const handleRpsChallenge = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    if (!isInteractive || !onRpsChallenge) return;
    onRpsChallenge(user);
    setMenuOpen(false);
  };

  const handleViewProfile = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    if (!onViewProfile) return;
    onViewProfile(user);
    setMenuOpen(false);
  };

  const handleToggleMute = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    if (!user) return;
    toggleMutedUser(user.uid);
    setMenuOpen(false);
  };

  const pingInfo = useMemo(
    () => resolvePingBetweenUsers(user, viewer),
    [user, viewer]
  );
  const pingLabel = useMemo(() => {
    if (pingInfo.ping === null) return undefined;
    const value = Math.round(pingInfo.ping);
    return `${value} ms`;
  }, [pingInfo.ping]);

  const viewerPreference = useMemo(() => {
    if (!viewer?.sidePreferences || !user?.uid) return null;
    const entry = viewer.sidePreferences[user.uid];
    if (!entry) return null;
    if (entry.expiresAt <= Date.now()) return null;
    return entry;
  }, [viewer?.sidePreferences, user?.uid]);

  const preferenceLabel = useMemo(() => {
    if (!viewerPreference) return null;
    const remainingMs = viewerPreference.expiresAt - Date.now();
    const remainingMinutes = Math.max(0, Math.ceil(remainingMs / 60000));
    return `${
      viewerPreference.side === "player1" ? "P1" : "P2"
    } -> ${remainingMinutes}m`;
  }, [viewerPreference]);

  return (
    <Stack
      borderWidth="1px"
      borderColor="gray.800"
      borderRadius="l2"
      bg="bg.canvas"
      _hover={isInteractive ? { borderColor: "gray.500" } : undefined}
    >
      <Flex
        alignItems="center"
        gap="1"
        padding="1"
        cursor={isInteractive ? "pointer" : "default"}
        role={isInteractive ? "button" : undefined}
        tabIndex={isInteractive ? 0 : -1}
        onClick={toggleMenu}
        onKeyDown={handleKeyToggle}
        justifyContent="space-between"
      >
        <Box display="flex" gap="2" alignItems="center">
          <Box>
            <Avatar.Root variant="outline" size="sm">
              <Avatar.Fallback name={user.userName} />
              <Avatar.Image src={user.userProfilePic} />
            </Avatar.Root>
          </Box>
          <Stack gap="1" justifyContent="center" minW="100px">
            <Text fontWeight="semibold" fontSize="xs">
              {user.userName}
            </Text>
            <TitleBadge title={user.userTitle} />
          </Stack>
          <Box gap="1" display="flex">
            <Stack>
              <Text fontSize="xs" color="gray.500">
                ELO {user.accountElo ?? "--"}
              </Text>
              <WinStreakIndicator value={user.winStreak ?? 0} size="sm" />
            </Stack>
          </Box>
          <Box display="flex" gap="2">
            <Tooltip
              content={`${user.countryCode || "Unknown"}`}
              openDelay={200}
              closeDelay={100}
            >
              <div>
                <span
                  //  @ts-ignore // this is needed for the country code css library.
                  class={`fi fi-${user.countryCode?.toLowerCase() || "xx"}`}
                />
              </div>
            </Tooltip>
            <Box display="flex" gap="1" alignItems="center">
              <Box minW="40px">
                {pingLabel ? (
                  <Tooltip
                    content={
                      pingInfo.isUnstable
                        ? `Unstable ping ${pingLabel}`
                        : pingLabel
                    }
                    openDelay={200}
                    closeDelay={100}
                  >
                    <Text
                      fontSize="xs"
                      color={pingInfo.isUnstable ? "orange.300" : "gray.400"}
                    >
                      {pingLabel}
                    </Text>
                  </Tooltip>
                ) : (
                  <Text fontSize="xs" color="gray.600">
                    Ping unknown
                  </Text>
                )}
              </Box>
            </Box>
          </Box>
        </Box>
      </Flex>
      {menuOpen && isInteractive ? (
        <Box paddingX="3" paddingBottom="3">
          <Stack gap="0">
            {preferenceLabel ? (
              <Text fontSize="xs" color="orange.300">
                Side lock: {preferenceLabel}
              </Text>
            ) : null}
          </Stack>
          <Stack gap="2">
            {/* {user.knownAliases.length ? (
              <Text fontSize="xs" color="gray.400">
                Also known as: {user.knownAliases.join(", ")}
              </Text>
            ) : null} */}
            <Button size="sm" colorPalette="orange" onClick={handleChallenge}>
              Challenge player
            </Button>
            {onRpsChallenge ? (
              <Button
                size="sm"
                colorPalette="purple"
                variant="outline"
                onClick={handleRpsChallenge}
              >
                Side Select Duel
              </Button>
            ) : null}
            {onViewProfile ? (
              <Button size="sm" variant="subtle" onClick={handleViewProfile}>
                View profile
              </Button>
            ) : null}
            <Button
              size="sm"
              variant={isMuted ? "solid" : "outline"}
              colorPalette={isMuted ? "green" : "neutral"}
              onClick={handleToggleMute}
            >
              {isMuted ? "Unmute player" : "Mute player"}
            </Button>
          </Stack>
        </Box>
      ) : null}
    </Stack>
  );
}
