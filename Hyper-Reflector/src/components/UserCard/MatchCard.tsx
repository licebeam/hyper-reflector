import { Box, Flex, Stack, Text } from "@chakra-ui/react";
import "/node_modules/flag-icons/css/flag-icons.min.css";
import type { MatchPlayerSummary, MatchSummary } from "../../types/match";

type MatchCardProps = {
  match: MatchSummary;
};

export default function MatchCard({ match }: MatchCardProps) {
  const [playerOne, playerTwo] = normalizePlayers(match.players);
  const startedAt = new Date(match.startedAt);

  return (
    <Stack
      borderWidth="1px"
      borderColor="gray.700"
      borderRadius="md"
      bg="bg.canvas"
      p="1"
    >
      <Flex align="center" gap="2" justify="space-between">
        <MatchPlayer player={playerOne} />

        <Text fontSize="xs" color="gray.400">
          VS
        </Text>
        <MatchPlayer player={playerTwo} justify="flex-end" />
        <Text fontSize="xs" color="gray.500">
          {new Intl.DateTimeFormat(undefined, {
            hour: "numeric",
            minute: "numeric",
          }).format(startedAt)}
        </Text>
      </Flex>
    </Stack>
  );
}

function MatchPlayer({
  player,
  justify = "flex-start",
}: {
  player: MatchPlayerSummary | undefined;
  justify?: "flex-start" | "flex-end";
}) {
  if (!player) {
    return (
      <Flex flex="1" justify={justify} minW="0">
        <Text fontSize="cs" color="gray.500">
          Waiting...
        </Text>
      </Flex>
    );
  }

  return (
    <Flex
      flex="1"
      justify={justify}
      gap="2"
      minW="0"
      align="center"
      direction={justify === "flex-end" ? "row-reverse" : "row"}
    >
      <Box textAlign={justify === "flex-end" ? "right" : "left"} minW="0">
        <Text fontWeight="semibold" fontSize="xs">
          {player.userName || "Unknown"}
        </Text>
      </Box>
    </Flex>
  );
}

function normalizePlayers(players: MatchPlayerSummary[] = []) {
  if (players.length >= 2) return players;
  if (players.length === 1) return [players[0], undefined];
  return [undefined, undefined];
}
