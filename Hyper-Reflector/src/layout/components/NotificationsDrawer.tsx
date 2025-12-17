import {
  Box,
  Button,
  Drawer,
  Flex,
  HStack,
  Stack,
  Switch,
  Text,
  VStack,
} from "@chakra-ui/react";
import type { TFunction } from "i18next";
import { Swords } from "lucide-react";
import { CHALLENGE_ACCEPT_LABEL, CHALLENGE_DECLINE_LABEL, NOTIFICATIONS_TITLE, NO_NOTIFICATIONS_MESSAGE } from "../helpers/constants";
import { formatTimestamp } from "../helpers/time";
import type { NotificationEntry } from "../types";

type NotificationsDrawerProps = {
  accentColor: string;
  globalUserName?: string;
  isOpen: boolean;
  mutedLabelColor?: string;
  notificationEntries: NotificationEntry[];
  notificationsMuted: boolean;
  onChallengeResponse: (messageId: string, accepted: boolean, responderName?: string) => void;
  onClearNotifications: () => void;
  onClose: () => void;
  onMiniGameResponse: (messageId: string, accepted: boolean, responderName?: string) => void;
  onToggleNotificationsMuted: (nextValue: boolean) => void;
  popoverSurfaceStyles: Record<string, any>;
  t: TFunction;
};

export function NotificationsDrawer({
  accentColor,
  globalUserName,
  isOpen,
  mutedLabelColor,
  notificationEntries,
  notificationsMuted,
  onChallengeResponse,
  onClearNotifications,
  onClose,
  onMiniGameResponse,
  onToggleNotificationsMuted,
  popoverSurfaceStyles,
  t,
}: NotificationsDrawerProps) {
  return (
    <Drawer.Root
      open={isOpen}
      onOpenChange={({ open }) => {
        if (!open) {
          onClose();
        }
      }}
      size="sm"
    >
      <Drawer.Backdrop />
      <Drawer.Positioner>
        <Drawer.Content {...popoverSurfaceStyles} color="fg.default">
          <Drawer.CloseTrigger />
          <Drawer.Header>
            <Flex justify="space-between" align="center" gap="3">
              <Drawer.Title>{NOTIFICATIONS_TITLE}</Drawer.Title>
              <Button
                size="xs"
                variant="ghost"
                onClick={onClearNotifications}
                disabled={notificationEntries.length === 0}
              >
                {t("Layout.buttons.clear")}
              </Button>
            </Flex>
            <Switch.Root
              colorPalette={accentColor}
              size="md"
              mt="2"
              display="flex"
              alignItems="center"
              justifyContent="space-between"
              gap="2"
              checked={notificationsMuted}
              onCheckedChange={(event) => onToggleNotificationsMuted(event.checked)}
            >
              <Switch.HiddenInput />
              <Switch.Label fontSize="sm" color={mutedLabelColor}>
                {t("Layout.notifications.mute")}
              </Switch.Label>
              <Switch.Control>
                <Switch.Thumb />
              </Switch.Control>
            </Switch.Root>
          </Drawer.Header>
          <Drawer.Body>
            <VStack align="stretch">
              {notificationEntries.length === 0 ? (
                <Text fontSize="sm" color={mutedLabelColor}>
                  {NO_NOTIFICATIONS_MESSAGE}
                </Text>
              ) : (
                notificationEntries.map(({ message: msg, kind }) => {
                  const isSelf = msg.userName === globalUserName;
                  const isChallenge = msg.role === "challenge" || kind === "challenge";
                  const challengeStatus = msg.challengeStatus;
                  const responderLabel =
                    msg.challengeResponder && msg.challengeResponder.length
                      ? msg.challengeResponder
                      : t("Layout.notifications.unknownPlayer");

                  return (
                    <Stack
                      key={msg.id}
                      borderWidth="1px"
                      borderRadius="md"
                      padding="3"
                      bg="bg.surface"
                      borderColor="border"
                    >
                      <Flex justifyContent="space-between" alignItems="center">
                        <Text fontWeight="semibold" color={isSelf ? `${accentColor}.500` : undefined}>
                          {msg.userName ?? t("Layout.notifications.unknownUser")}
                        </Text>
                        <Text fontSize="xs" color={mutedLabelColor}>
                          {formatTimestamp(msg.timeStamp)}
                        </Text>
                      </Flex>
                      <Box height="1px" bg="border" />
                      <Flex alignItems="center" gap="2">
                        {isChallenge ? <Swords size={16} /> : null}
                        <Text fontSize="sm" whiteSpace="pre-wrap">
                          {msg.text || t("Layout.notifications.noMessage")}
                        </Text>
                      </Flex>
                      {isChallenge ? (
                        challengeStatus ? (
                          <Text
                            fontSize="xs"
                            color={challengeStatus === "accepted" ? `${accentColor}.500` : "red.300"}
                          >
                            {challengeStatus === "accepted"
                              ? t("Layout.notifications.challengeAccepted", {
                                  name: responderLabel,
                                })
                              : t("Layout.notifications.challengeDeclined", {
                                  name: responderLabel,
                                })}
                          </Text>
                        ) : (
                          <HStack pt="1">
                            <Button
                              size="sm"
                              colorPalette={accentColor}
                              onClick={() =>
                                msg.challengeKind === "rps"
                                  ? onMiniGameResponse(msg.id, true, globalUserName)
                                  : onChallengeResponse(msg.id, true, globalUserName)
                              }
                            >
                              {CHALLENGE_ACCEPT_LABEL}
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() =>
                                msg.challengeKind === "rps"
                                  ? onMiniGameResponse(msg.id, false, globalUserName)
                                  : onChallengeResponse(msg.id, false, globalUserName)
                              }
                            >
                              {CHALLENGE_DECLINE_LABEL}
                            </Button>
                          </HStack>
                        )
                      ) : null}
                    </Stack>
                  );
                })
              )}
            </VStack>
          </Drawer.Body>
        </Drawer.Content>
      </Drawer.Positioner>
    </Drawer.Root>
  );
}
