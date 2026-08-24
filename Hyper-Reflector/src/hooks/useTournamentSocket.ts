import { useEffect, useRef, useState } from "react";

type TournamentSocketTransport = {
  tournamentChangeSignals: Record<string, number>;
  sendTournamentSubscribe: (tournamentId: string) => void;
  sendTournamentUnsubscribe: (tournamentId: string) => void;
  notifyTournamentChanged: (tournamentId: string) => void;
};

/**
 * Subscribes to live-update notifications for a single tournament and exposes
 * a `refetchSignal` that increments whenever another viewer's action changes
 * it — components should refetch the tournament/bracket when this changes.
 *
 * This is a thin wrapper around the transport primitives useWebSocket already
 * exposes (see its "Tournament viewer relay" section) — no tournament domain
 * logic lives here, only the subscribe lifecycle and the refetch trigger.
 */
export function useTournamentSocket(tournamentId: string | null, transport: TournamentSocketTransport) {
  const { tournamentChangeSignals, sendTournamentSubscribe, sendTournamentUnsubscribe, notifyTournamentChanged } = transport;
  const [refetchSignal, setRefetchSignal] = useState(0);
  const lastSeenRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    if (!tournamentId) return;
    sendTournamentSubscribe(tournamentId);
    return () => sendTournamentUnsubscribe(tournamentId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tournamentId]);

  useEffect(() => {
    if (!tournamentId) return;
    const latest = tournamentChangeSignals[tournamentId];
    if (latest !== undefined && latest !== lastSeenRef.current) {
      lastSeenRef.current = latest;
      setRefetchSignal((n) => n + 1);
    }
  }, [tournamentId, tournamentChangeSignals]);

  const notifyChanged = () => {
    if (tournamentId) notifyTournamentChanged(tournamentId);
  };

  return { refetchSignal, notifyChanged };
}
