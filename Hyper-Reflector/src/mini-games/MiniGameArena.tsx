import { useEffect, useMemo, useState } from "react";
import { Box, Button, Flex, Image, Stack, Text } from "@chakra-ui/react";
import { Trophy, XCircle } from "lucide-react";
import type { MiniGameChoice, MiniGameUiState } from "./types";
import { RPS_OPTIONS } from "./rps";
import {
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogRoot,
} from "../components/chakra/ui/dialog";

const INVITE_WINDOW_SECONDS = 30;
const CHOICE_WINDOW_SECONDS = 10;

type MiniGameArenaProps = {
  viewerId?: string;
  state: MiniGameUiState | null;
  opponentName?: string;
  onSubmitChoice: (choice: MiniGameChoice) => void;
  onDecline: () => void;
  onClose: () => void;
  onChooseSide?: (side: "player1" | "player2") => Promise<void> | void;
  sideSelectionPending?: boolean;
};

export default function MiniGameArena({
  viewerId,
  state,
  opponentName,
  onSubmitChoice,
  onDecline,
  onClose,
  onChooseSide,
  sideSelectionPending,
}: MiniGameArenaProps) {
  const [countdown, setCountdown] = useState(0);

  useEffect(() => {
    if (!state) return;
    const tick = () => {
      const remaining = Math.max(
        0,
        Math.ceil((state.expiresAt - Date.now()) / 1000)
      );
      setCountdown(remaining);
    };
    tick();
    const id = window.setInterval(tick, 250);
    return () => window.clearInterval(id);
  }, [state]);

  const result = state?.result ?? null;
  const hasResult = Boolean(result);
  const awaitingActivation = Boolean(
    state && state.phase === "invite" && !hasResult
  );
  const viewerIsWinner = result?.winnerUid === viewerId;
  const viewerIsLoser = result?.loserUid === viewerId;
  const showSideSelection =
    hasResult &&
    viewerIsWinner &&
    result?.outcome === "win" &&
    !state.sidePreferenceSubmitted &&
    (state.mode === "mock" || Boolean(onChooseSide));

  const title = useMemo(() => {
    if (!state) return "";
    if (hasResult) {
      if (result?.outcome === "draw") return "Duel Draw";
      if (result?.outcome === "declined") return "Challenge Declined";
      if (viewerIsWinner) return "Victory!";
      if (viewerIsLoser) return "Defeat";
      return "Duel Result";
    }
    if (state.phase === "invite") {
      return state.isInitiator ? "Waiting for opponent" : "Incoming Duel";
    }
    return "Rock Paper Scissors Duel";
  }, [state, hasResult, viewerIsWinner, viewerIsLoser]);

  if (!state) {
    return null;
  }

  const waitingForOpponent = state.status === "submitted" && !hasResult;
  const controlsDisabled =
    state.status !== "pending" || waitingForOpponent || awaitingActivation;
  const opponentUid =
    viewerId && state
      ? viewerId === state.challengerId
        ? state.opponentId
        : state.challengerId
      : state?.opponentId;
  const phaseDurationSeconds =
    state.phase === "invite" ? INVITE_WINDOW_SECONDS : CHOICE_WINDOW_SECONDS;
  const safeCountdown = Math.min(phaseDurationSeconds, countdown);
  const progressPercent = hasResult
    ? 100
    : Math.min(
        100,
        Math.max(
          0,
          ((phaseDurationSeconds - safeCountdown) /
            Math.max(1, phaseDurationSeconds)) *
            100
        )
      );
  const viewerRating =
    viewerId && result?.ratings ? result.ratings[viewerId] : undefined;
  const viewerRatingChange =
    viewerId && result?.ratingChanges
      ? result.ratingChanges[viewerId]
      : undefined;
  const opponentRating =
    opponentUid && result?.ratings ? result.ratings[opponentUid] : undefined;
  const opponentRatingChange =
    opponentUid && result?.ratingChanges
      ? result.ratingChanges[opponentUid]
      : undefined;

  const renderResultSummary = () => {
    if (!result) return null;
    const challengerChoice = result.choices[state.challengerId] || null;
    const opponentChoice = result.choices[state.opponentId] || null;
    return (
      <Stack gap="2" mt="3">
        <Flex justify="space-between">
          <Text fontWeight="semibold">You chose:</Text>
          <Text>
            {humanizeChoice(
              state.challengerId === viewerId
                ? challengerChoice
                : opponentChoice
            )}
          </Text>
        </Flex>
        <Flex justify="space-between">
          <Text fontWeight="semibold">Opponent chose:</Text>
          <Text>
            {humanizeChoice(
              state.challengerId === viewerId
                ? opponentChoice
                : challengerChoice
            )}
          </Text>
        </Flex>
        {result.ratings && (
          <Stack gap="1" mt="2">
            {viewerId ? (
              <RatingChangeLine
                label="Your ELO"
                rating={viewerRating}
                delta={viewerRatingChange}
              />
            ) : null}
            {opponentUid ? (
              <RatingChangeLine
                label={`${opponentName || "Opponent"} ELO`}
                rating={opponentRating}
                delta={opponentRatingChange}
              />
            ) : null}
          </Stack>
        )}
      </Stack>
    );
  };

  return (
    <DialogRoot
      open={Boolean(state)}
      onOpenChange={(details) => !details.open && onClose()}
    >
      <DialogContent bg="gray.900" color="white" maxW="560px">
        <DialogHeader>
          <Flex align="center" gap="2">
            {hasResult ? <Trophy size={20} /> : null}
            <Text>{title}</Text>
          </Flex>
        </DialogHeader>
        <DialogBody>
          {!hasResult || !result ? (
            <Stack gap="4">
              <Box bg="gray.700" borderRadius="full" h="2">
                <Box
                  bg="orange.400"
                  h="100%"
                  borderRadius="full"
                  transition="width 0.2s linear"
                  width={`${progressPercent}%`}
                />
              </Box>
              <Text textAlign="center" fontSize="sm" color="gray.300">
                {awaitingActivation
                  ? state.isInitiator
                    ? `Waiting for ${
                        opponentName || "your opponent"
                      } to accept (${countdown}s)`
                    : "Respond to the duel request in chat."
                  : waitingForOpponent
                  ? "Waiting for your opponent..."
                  : `Make your choice within ${countdown}s`}
              </Text>
              <Flex justify="space-between" gap="3">
                {RPS_OPTIONS.map((option) => (
                  <OptionCard
                    key={option.id}
                    option={option}
                    isDisabled={controlsDisabled}
                    isSelected={state.viewerChoice === option.id}
                    onSelect={() => onSubmitChoice(option.id)}
                  />
                ))}
              </Flex>
            </Stack>
          ) : (
            <>
              <Text fontSize="sm" color="gray.300">
                {result.outcome === "draw"
                  ? "Both players picked the same option."
                  : result.outcome === "declined"
                  ? "The challenge was declined."
                  : viewerIsWinner
                  ? "You won the duel!"
                  : viewerIsLoser
                  ? "You lost this duel."
                  : "The duel has concluded."}
              </Text>
              {renderResultSummary()}
            </>
          )}
        </DialogBody>
        <DialogFooter>
          {!hasResult || !result ? (
            <Flex w="100%" justify="flex-end">
              <Button variant="subtle" onClick={onDecline}>
                <Flex align="center" gap="2">
                  <XCircle size={16} />
                  {state.isInitiator
                    ? state.phase === "invite"
                      ? "Cancel invitation"
                      : "Cancel duel"
                    : "Decline"}
                </Flex>
              </Button>
            </Flex>
          ) : showSideSelection ? (
            <Stack w="100%" gap="3">
              <Text fontSize="sm" color="gray.300">
                You won the duel! Choose the side you’d like to start on for the
                next match against {opponentName || "this opponent"}. This
                preference lasts 1 hour.
              </Text>
              <Flex w="100%" justify="space-between" gap="3">
                <Button
                  colorPalette="orange"
                  flex="1"
                  loading={sideSelectionPending}
                  onClick={() => onChooseSide?.("player1")}
                >
                  Claim Player 1
                </Button>
                <Button
                  colorPalette="purple"
                  flex="1"
                  loading={sideSelectionPending}
                  onClick={() => onChooseSide?.("player2")}
                >
                  Claim Player 2
                </Button>
              </Flex>
            </Stack>
          ) : (
            <Button onClick={onClose} width="full">
              Close
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </DialogRoot>
  );
}

function OptionCard({
  option,
  isSelected,
  isDisabled,
  onSelect,
}: {
  option: (typeof RPS_OPTIONS)[number];
  isSelected: boolean;
  isDisabled: boolean;
  onSelect: () => void;
}) {
  return (
    <Button
      flex="1"
      variant={isSelected ? "solid" : "outline"}
      colorPalette={isSelected ? "orange" : "gray"}
      onClick={onSelect}
      disabled={isDisabled}
      display="flex"
      flexDirection="column"
      gap="2"
      height="auto"
      py="4"
    >
      <Image
        src={option.image}
        alt={option.label}
        boxSize="48px"
        objectFit="contain"
      />
      <Text fontWeight="semibold">{option.label}</Text>
      {/* <Text fontSize="xs" color="gray.300" textAlign="center">
                {option.description}
            </Text> */}
    </Button>
  );
}

function humanizeChoice(choice?: MiniGameChoice | null) {
  if (!choice) return "\u2014";
  return choice.charAt(0).toUpperCase() + choice.slice(1);
}

function RatingChangeLine({
  label,
  rating,
  delta,
}: {
  label: string;
  rating?: number;
  delta?: number;
}) {
  if (typeof rating !== "number" || typeof delta !== "number") {
    return null;
  }
  const color = delta > 0 ? "green.300" : delta < 0 ? "red.300" : "gray.300";
  const deltaLabel = delta > 0 ? `+${delta}` : delta.toString();
  return (
    <Flex justify="space-between" fontSize="sm">
      <Text color="gray.300">{label}</Text>
      <Text color={color}>
        {deltaLabel} ({rating})
      </Text>
    </Flex>
  );
}
