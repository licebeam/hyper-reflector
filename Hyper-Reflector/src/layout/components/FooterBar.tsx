import { Box, Flex, Text, type BoxProps } from "@chakra-ui/react";
import type { TFunction } from "i18next";

type FooterBarProps = {
  mutedLabelColor?: string;
  statusColor: string;
  statusLabel: string;
  styles: BoxProps;
  t: TFunction;
};

export function FooterBar({
  mutedLabelColor,
  statusColor,
  statusLabel,
  styles,
  t,
}: FooterBarProps) {
  return (
    <Box
      h="24px"
      display="flex"
      justifyContent="space-between"
      alignItems="center"
      px="4"
      flexShrink={0}
      {...styles}
    >
      {/* These links no longer work, needs to be resolved */}
      <Box display="flex" gap="8px">
        <a href="https://hyper-reflector.com/" target="_blank" rel="noreferrer">
          <Text textStyle="xs">{t("Layout.footer.linksLabel")}</Text>
        </a>
        <a href="https://discord.gg/fsQEVzXwbt" target="_blank" rel="noreferrer">
          <Text textStyle="xs">{t("Layout.footer.discord")}</Text>
        </a>
        <a
          href="https://github.com/Hyper-Reflector-Team"
          target="_blank"
          rel="noreferrer"
        >
          <Text textStyle="xs">{t("Layout.footer.github")}</Text>
        </a>
      </Box>

      <Flex alignItems="center" gap="3">
        <Box display="flex" alignItems="center" gap="2">
          <Box
            width="10px"
            height="10px"
            borderRadius="9999px"
            backgroundColor={statusColor}
          />
          <Text textStyle="xs" color={mutedLabelColor}>
            {statusLabel}
          </Text>
        </Box>
        <Text textStyle="xs">{t("Layout.footer.version")}</Text>
      </Flex>
    </Box>
  );
}
