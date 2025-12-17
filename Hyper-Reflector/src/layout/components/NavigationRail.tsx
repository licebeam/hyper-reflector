import { Box, IconButton, Image, Stack, type StackProps } from "@chakra-ui/react";
import type { TFunction } from "i18next";
import {
  FlaskConical,
  LucideHome,
  MessageCircle,
  Settings,
  ShieldHalf,
  UserRound,
} from "lucide-react";
import hrLogo from "../../assets/logo.svg";

type NavigationRailProps = {
  accentColor: string;
  isAdmin: boolean;
  isAuthenticated: boolean;
  onNavigate: (path: string) => void;
  panelStyles: StackProps;
  t: TFunction;
};

export function NavigationRail({
  accentColor,
  isAdmin,
  isAuthenticated,
  onNavigate,
  panelStyles,
  t,
}: NavigationRailProps) {
  return (
    <Stack gap="24px" padding="12px" {...panelStyles}>
      <Box height="64px" alignSelf="center" flex="1">
        <Image src={hrLogo} height="64px" />
      </Box>

      {isAuthenticated ? (
        <Stack alignItems="center" gap="24px" flex="2">
          <IconButton
            colorPalette={accentColor}
            width="40px"
            height="40px"
            onClick={() => onNavigate("/home")}
            aria-label={t("Layout.aria.home")}
          >
            <LucideHome />
          </IconButton>
          <IconButton
            colorPalette={accentColor}
            width="40px"
            height="40px"
            onClick={() => onNavigate("/lobby")}
            aria-label={t("Layout.aria.lobby")}
          >
            <MessageCircle />
          </IconButton>
          <IconButton
            colorPalette={accentColor}
            width="40px"
            height="40px"
            onClick={() => onNavigate("/lab")}
            aria-label={t("Layout.aria.lab")}
          >
            <FlaskConical />
          </IconButton>
          <IconButton
            colorPalette={accentColor}
            width="40px"
            height="40px"
            onClick={() => onNavigate("/profile")}
            aria-label={t("Layout.aria.profile")}
          >
            <UserRound />
          </IconButton>
          {isAdmin ? (
            <IconButton
              colorPalette={accentColor}
              width="40px"
              height="40px"
              onClick={() => onNavigate("/admin")}
              aria-label={t("Layout.aria.admin")}
            >
              <ShieldHalf />
            </IconButton>
          ) : null}
        </Stack>
      ) : null}

      {isAuthenticated ? (
        <Stack alignItems="center" flex="1" gap="24px" justifyContent="flex-end">
          <IconButton
            colorPalette={accentColor}
            width="40px"
            height="40px"
            onClick={() => onNavigate("/settings")}
            aria-label={t("Layout.aria.settings")}
          >
            <Settings />
          </IconButton>
        </Stack>
      ) : null}
    </Stack>
  );
}
