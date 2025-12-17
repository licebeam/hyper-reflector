import {
  Box,
  Button,
  Circle,
  Flex,
  Float,
  IconButton,
  Text,
  type FlexProps,
} from "@chakra-ui/react";
import type { TFunction } from "i18next";
import { Bell, BellOff } from "lucide-react";
import UserCard from "../../components/UserCard/UserCard";
import { DEFAULT_LOBBY_ID } from "../../state/store";

type HeaderBarProps = {
  accentColor: string;
  currentLobbyId?: string | null;
  isAuthenticated: boolean;
  isInMatch: boolean;
  notificationsMuted: boolean;
  unreadCount: number;
  onForceCloseMatch: () => void;
  onOpenLobbyManager: () => void;
  onOpenNotifications: () => void;
  styles: FlexProps;
  t: TFunction;
};

export function HeaderBar({
  accentColor,
  currentLobbyId,
  isAuthenticated,
  isInMatch,
  notificationsMuted,
  unreadCount,
  onForceCloseMatch,
  onOpenLobbyManager,
  onOpenNotifications,
  styles,
  t,
}: HeaderBarProps) {
  return (
    <Flex
      height="48px"
      alignItems="center"
      px="4"
      gap="3"
      justifyContent="space-between"
      {...styles}
    >
      {isAuthenticated ? (
        <Button
          size="sm"
          variant="outline"
          colorPalette={accentColor}
          onClick={onOpenLobbyManager}
        >
          {t("Layout.buttons.lobbyLabel", {
            lobby: currentLobbyId || DEFAULT_LOBBY_ID,
          })}
        </Button>
      ) : null}

      <Flex alignItems="center" gap="3">
        <UserCard />
        {isAuthenticated ? (
          <Box position="relative">
            <IconButton
              colorPalette={accentColor}
              width="40px"
              height="40px"
              onClick={onOpenNotifications}
              aria-label={t("Layout.aria.notifications")}
            >
              <Float placement="bottom-end">
                <Circle size="5" bg="accent.default" color="fg.on-accent">
                  <Text fontSize="xs">
                    {unreadCount > 99
                      ? t("Layout.notifications.countOverflow")
                      : unreadCount}
                  </Text>
                </Circle>
              </Float>
              {notificationsMuted ? <BellOff /> : <Bell />}
            </IconButton>
          </Box>
        ) : null}

        {isInMatch ? (
          <Button
            size="sm"
            variant="outline"
            colorPalette="red"
            onClick={onForceCloseMatch}
          >
            {t("Layout.buttons.forceCloseMatch")}
          </Button>
        ) : null}
      </Flex>
    </Flex>
  );
}
