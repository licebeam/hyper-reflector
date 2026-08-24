import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { ArrowLeft, Pencil, Plus, RefreshCcw, Trophy, X } from "lucide-react";
import api from "../external-api/requests";
import { auth } from "../utils/firebase";
import type { V2User, Tournament, TournamentRegistration, TournamentMatch } from "../types";
import { detectBrowserTimezone, formatInZone, formatViewerLocal } from "../utils/timezone";
import { useTournamentSocket } from "../hooks/useTournamentSocket";
import { TournamentCard } from "../components/tournament/TournamentCard";
import { CreateTournamentDialog } from "../components/tournament/CreateTournamentDialog";
import { EditTournamentDialog } from "../components/tournament/EditTournamentDialog";
import { BracketView } from "../components/tournament/BracketView";

type TournamentPageProps = {
  currentUser: V2User | null;
  tournamentChangeSignals: Record<string, number>;
  sendTournamentSubscribe: (tournamentId: string) => void;
  sendTournamentUnsubscribe: (tournamentId: string) => void;
  notifyTournamentChanged: (tournamentId: string) => void;
};

function Spinner({ size = 28 }: { size?: number }) {
  return (
    <div
      className="rounded-full border-2 border-t-transparent animate-spin"
      style={{ width: size, height: size, borderColor: "var(--v2-accent)", borderTopColor: "transparent" }}
    />
  );
}

function BlockingOverlay() {
  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.25)" }}
    >
      <Spinner size={32} />
    </div>
  );
}

// ── List view ──────────────────────────────────────────────────────────────────

function TournamentList({
  onSelect,
  onCreated,
}: {
  onSelect: (id: string) => void;
  onCreated: (id: string) => void;
}) {
  const { t } = useTranslation();
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [registrationCounts, setRegistrationCounts] = useState<Record<string, number>>({});
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);

  const load = useCallback(async (reset: boolean) => {
    setLoading(true);
    try {
      const res = await api.listTournaments(auth, 25, reset ? null : cursor);
      const list: Tournament[] = res?.tournaments ?? [];
      setTournaments((prev) => (reset ? list : [...prev, ...list]));
      setCursor(res?.nextCursor ?? null);
      const counts = await Promise.all(
        list.map(async (tour) => {
          const regRes = await api.listTournamentRegistrations(auth, tour.id);
          return [tour.id, (regRes?.registrations ?? []).length] as const;
        })
      );
      setRegistrationCounts((prev) => ({ ...prev, ...Object.fromEntries(counts) }));
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cursor]);

  useEffect(() => {
    void load(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="h-full overflow-y-scroll">
      <div className="max-w-3xl mx-auto p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Trophy size={18} style={{ color: "var(--v2-accent)" }} />
            <h1 className="text-lg font-semibold" style={{ color: "var(--v2-text)" }}>
              {t("tournamentPage.title")}
            </h1>
          </div>
          <button
            onClick={() => setCreateOpen(true)}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded transition-colors"
            style={{ background: "var(--v2-accent)", color: "var(--v2-accent-fg)" }}
          >
            <Plus size={13} /> {t("tournamentPage.createTournament")}
          </button>
        </div>

        {loading && tournaments.length === 0 && (
          <div className="flex justify-center py-10">
            <Spinner />
          </div>
        )}

        {!loading && tournaments.length === 0 && (
          <p className="text-sm text-center py-10" style={{ color: "var(--v2-muted)" }}>
            {t("tournamentPage.noTournamentsYet")}
          </p>
        )}

        <div className="space-y-2">
          {tournaments.map((tour) => (
            <TournamentCard
              key={tour.id}
              tournament={tour}
              registrationCount={registrationCounts[tour.id] ?? 0}
              onClick={() => onSelect(tour.id)}
            />
          ))}
        </div>

        {cursor && (
          <button
            onClick={() => void load(false)}
            disabled={loading}
            className="w-full flex items-center justify-center gap-1.5 text-xs py-2 rounded border transition-colors disabled:opacity-40"
            style={{ borderColor: "var(--v2-border)", color: "var(--v2-muted)" }}
          >
            {loading && tournaments.length > 0 && <Spinner size={12} />}
            {t("tournamentPage.loadMore")}
          </button>
        )}
      </div>

      {createOpen && (
        <CreateTournamentDialog
          onClose={() => setCreateOpen(false)}
          onCreate={async (params) => {
            const res = await api.createTournament(auth, params);
            if (res?.tournament) {
              setCreateOpen(false);
              onCreated(res.tournament.id);
              return true;
            }
            return false;
          }}
        />
      )}
    </div>
  );
}

// ── Detail view ────────────────────────────────────────────────────────────────

function TournamentDetail({
  tournamentId,
  currentUser,
  onBack,
  tournamentChangeSignals,
  sendTournamentSubscribe,
  sendTournamentUnsubscribe,
  notifyTournamentChanged,
}: {
  tournamentId: string;
  currentUser: V2User | null;
  onBack: () => void;
} & Pick<
  TournamentPageProps,
  "tournamentChangeSignals" | "sendTournamentSubscribe" | "sendTournamentUnsubscribe" | "notifyTournamentChanged"
>) {
  const { t } = useTranslation();
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [registrations, setRegistrations] = useState<TournamentRegistration[]>([]);
  const [matches, setMatches] = useState<TournamentMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionPending, setActionPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cancelConfirm, setCancelConfirm] = useState(false);
  const [mockCount, setMockCount] = useState("4");
  const [editOpen, setEditOpen] = useState(false);
  const [seedBy, setSeedBy] = useState<"registration" | "rating">("registration");

  const { refetchSignal, notifyChanged } = useTournamentSocket(tournamentId, {
    tournamentChangeSignals,
    sendTournamentSubscribe,
    sendTournamentUnsubscribe,
    notifyTournamentChanged,
  });

  const load = useCallback(async () => {
    setError(null);
    const [tourRes, regRes, matchRes] = await Promise.all([
      api.getTournament(auth, tournamentId),
      api.listTournamentRegistrations(auth, tournamentId),
      api.listTournamentMatches(auth, tournamentId),
    ]);
    if (!tourRes?.tournament) {
      setError(t("tournamentPage.loadFailed"));
      setLoading(false);
      return;
    }
    setTournament(tourRes.tournament);
    setRegistrations(regRes?.registrations ?? []);
    setMatches(matchRes?.matches ?? []);
    setLoading(false);
  }, [tournamentId, t]);

  useEffect(() => {
    setLoading(true);
    void load();
  }, [load, refetchSignal]);

  const isOrganizer = !!currentUser && !!tournament && currentUser.uid === tournament.organizerUid;
  const isRegistered = !!currentUser && registrations.some((r) => r.uid === currentUser.uid);

  const runAction = async (action: () => Promise<any>) => {
    setActionPending(true);
    try {
      const res = await action();
      if (res && !res.error) {
        notifyChanged();
        await load();
      }
      return res;
    } finally {
      setActionPending(false);
    }
  };

  const handleRefresh = async () => {
    setActionPending(true);
    try {
      await load();
    } finally {
      setActionPending(false);
    }
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Spinner />
      </div>
    );
  }

  if (!tournament) {
    return (
      <div className="h-full flex items-center justify-center">
        <p className="text-sm" style={{ color: "var(--v2-muted)" }}>
          {error || t("tournamentPage.loadFailed")}
        </p>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-scroll">
      {actionPending && <BlockingOverlay />}
      <div className="max-w-4xl mx-auto p-6 space-y-5">
        <div className="flex items-center justify-between">
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 text-sm transition-colors"
            style={{ color: "var(--v2-muted)" }}
          >
            <ArrowLeft size={14} /> {t("tournamentPage.backToTournaments")}
          </button>
          <button
            onClick={() => void handleRefresh()}
            disabled={actionPending}
            className="flex items-center gap-1 text-xs px-2 py-1 rounded border transition-colors disabled:opacity-40"
            style={{ borderColor: "var(--v2-border)", color: "var(--v2-muted)" }}
          >
            <RefreshCcw size={12} /> {t("playerProfilePage.refresh")}
          </button>
        </div>

        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-semibold" style={{ color: "var(--v2-text)" }}>
              {tournament.name}
            </h1>
            {isOrganizer && (
              <button
                onClick={() => setEditOpen(true)}
                disabled={actionPending}
                className="disabled:opacity-40"
                style={{ color: "var(--v2-muted)" }}
              >
                <Pencil size={13} />
              </button>
            )}
          </div>
          {tournament.description && (
            <p className="text-xs mt-1" style={{ color: "var(--v2-muted)" }}>{tournament.description}</p>
          )}
          {tournament.startDate && (
            <p className="text-xs mt-1" style={{ color: "var(--v2-muted)" }}>
              {t("tournamentPage.startsOn", { date: formatViewerLocal(tournament.startDate) })}
              {tournament.timezone && tournament.timezone !== detectBrowserTimezone() && (
                <span className="ml-1">
                  ({t("tournamentPage.organizerTime", { time: formatInZone(tournament.startDate, tournament.timezone) })})
                </span>
              )}
            </p>
          )}
        </div>

        {error && <p className="text-xs" style={{ color: "#f87171" }}>{error}</p>}

        {/* Registration */}
        {currentUser && tournament.status === "registration_open" && (
          <div
            className="rounded-lg border px-4 py-3 flex items-center justify-between"
            style={{ borderColor: "var(--v2-border)", background: "var(--v2-surface)" }}
          >
            <span className="text-xs" style={{ color: "var(--v2-muted)" }}>
              {isRegistered
                ? t("tournamentPage.youAreRegistered")
                : t("tournamentPage.registeredCount", { count: registrations.length })}
            </span>
            <button
              onClick={() =>
                void runAction(() =>
                  isRegistered
                    ? api.withdrawFromTournament(auth, tournamentId)
                    : api.registerForTournament(auth, tournamentId)
                )
              }
              disabled={actionPending}
              className="text-xs px-3 py-1.5 rounded transition-colors disabled:opacity-40"
              style={
                isRegistered
                  ? { border: "1px solid var(--v2-border)", color: "var(--v2-muted)" }
                  : { background: "var(--v2-accent)", color: "var(--v2-accent-fg)" }
              }
            >
              {isRegistered ? t("tournamentPage.withdraw") : t("tournamentPage.register")}
            </button>
          </div>
        )}

        {/* Registrants */}
        {tournament.status === "registration_open" && (
          <div
            className="rounded-lg border px-4 py-3 space-y-2"
            style={{ borderColor: "var(--v2-border)", background: "var(--v2-surface)" }}
          >
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: "var(--v2-muted)" }}>
                {t("tournamentPage.registrants")}
              </p>
              {isOrganizer && (
                <div className="flex items-center gap-1.5">
                  <input
                    type="number"
                    min={1}
                    max={64}
                    value={mockCount}
                    onChange={(e) => setMockCount(e.target.value)}
                    className="w-14 text-xs px-2 py-1 rounded border outline-none"
                    style={{ background: "var(--v2-hover)", borderColor: "var(--v2-border)", color: "var(--v2-text)" }}
                  />
                  <button
                    onClick={() =>
                      void runAction(() =>
                        api.addMockTournamentPlayers(auth, tournamentId, parseInt(mockCount, 10) || 1)
                      )
                    }
                    disabled={actionPending}
                    className="text-xs px-2.5 py-1 rounded border transition-colors disabled:opacity-40"
                    style={{ borderColor: "var(--v2-border)", color: "var(--v2-muted)" }}
                  >
                    {t("tournamentPage.addMockPlayers")}
                  </button>
                </div>
              )}
            </div>
            {registrations.length === 0 ? (
              <p className="text-xs" style={{ color: "var(--v2-muted)" }}>
                {t("tournamentPage.noRegistrantsYet")}
              </p>
            ) : (
              <ul className="space-y-1">
                {registrations.map((r) => (
                  <li key={r.uid} className="flex items-center justify-between text-xs">
                    <span style={{ color: "var(--v2-text)" }}>
                      {r.userName}
                      {r.isMock && (
                        <span
                          className="ml-1.5 text-[9px] px-1 py-0.5 rounded"
                          style={{ color: "var(--v2-muted)", background: "var(--v2-hover)" }}
                        >
                          {t("tournamentPage.mockLabel")}
                        </span>
                      )}
                    </span>
                    {isOrganizer && (
                      <button
                        onClick={() => void runAction(() => api.removeTournamentRegistration(auth, tournamentId, r.uid))}
                        disabled={actionPending}
                        className="disabled:opacity-40"
                        style={{ color: "var(--v2-muted)" }}
                      >
                        <X size={12} />
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {/* Organizer controls */}
        {isOrganizer && tournament.status !== "completed" && tournament.status !== "cancelled" && (
          <div
            className="rounded-lg border px-4 py-3 space-y-2"
            style={{ borderColor: "var(--v2-border)", background: "var(--v2-surface)" }}
          >
            <p className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: "var(--v2-muted)" }}>
              {t("tournamentPage.organizerOnly")}
            </p>
            {(tournament.status === "registration_open" || tournament.status === "seeding") && (
              <div className="flex items-center gap-1.5 pb-1">
                <label className="text-[10px]" style={{ color: "var(--v2-muted)" }}>
                  {t("tournamentPage.seedingMethod")}
                </label>
                <select
                  value={seedBy}
                  onChange={(e) => setSeedBy(e.target.value as "registration" | "rating")}
                  className="text-xs px-1.5 py-0.5 rounded border outline-none"
                  style={{ background: "var(--v2-hover)", borderColor: "var(--v2-border)", color: "var(--v2-text)" }}
                >
                  <option value="registration" style={{ background: "var(--v2-surface)" }}>
                    {t("tournamentPage.seedByRegistration")}
                  </option>
                  <option value="rating" style={{ background: "var(--v2-surface)" }}>
                    {t("tournamentPage.seedByRating")}
                  </option>
                </select>
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              {tournament.status === "registration_open" && (
                <>
                  <button
                    onClick={() => void runAction(() => api.startTournament(auth, tournamentId, seedBy))}
                    disabled={actionPending}
                    className="text-xs px-3 py-1.5 rounded transition-colors disabled:opacity-40"
                    style={{ background: "var(--v2-accent)", color: "var(--v2-accent-fg)" }}
                  >
                    {t("tournamentPage.startTournament")}
                  </button>
                  <button
                    onClick={() => void runAction(() => api.generateTournamentBracket(auth, tournamentId, seedBy))}
                    disabled={actionPending}
                    className="text-xs px-3 py-1.5 rounded border transition-colors disabled:opacity-40"
                    style={{ borderColor: "var(--v2-border)", color: "var(--v2-muted)" }}
                  >
                    {t("tournamentPage.generateBracket")}
                  </button>
                </>
              )}
              {tournament.status === "seeding" && (
                <>
                  <button
                    onClick={() => void runAction(() => api.startTournament(auth, tournamentId, seedBy))}
                    disabled={actionPending}
                    className="text-xs px-3 py-1.5 rounded transition-colors disabled:opacity-40"
                    style={{ background: "var(--v2-accent)", color: "var(--v2-accent-fg)" }}
                  >
                    {t("tournamentPage.startTournament")}
                  </button>
                  <button
                    onClick={() => void runAction(() => api.generateTournamentBracket(auth, tournamentId, seedBy))}
                    disabled={actionPending}
                    className="text-xs px-3 py-1.5 rounded border transition-colors disabled:opacity-40"
                    style={{ borderColor: "var(--v2-border)", color: "var(--v2-muted)" }}
                  >
                    {t("tournamentPage.reseedBracket")}
                  </button>
                </>
              )}
              {tournament.status === "in_progress" && (
                <button
                  onClick={() => void runAction(() => api.pauseTournament(auth, tournamentId))}
                  disabled={actionPending}
                  className="text-xs px-3 py-1.5 rounded border transition-colors disabled:opacity-40"
                  style={{ borderColor: "var(--v2-border)", color: "var(--v2-muted)" }}
                >
                  {t("tournamentPage.pauseTournament")}
                </button>
              )}
              {tournament.status === "paused" && (
                <button
                  onClick={() => void runAction(() => api.resumeTournament(auth, tournamentId))}
                  disabled={actionPending}
                  className="text-xs px-3 py-1.5 rounded transition-colors disabled:opacity-40"
                  style={{ background: "var(--v2-accent)", color: "var(--v2-accent-fg)" }}
                >
                  {t("tournamentPage.resumeTournament")}
                </button>
              )}
              <button
                onClick={() => {
                  if (!cancelConfirm) {
                    setCancelConfirm(true);
                    return;
                  }
                  void runAction(() => api.cancelTournament(auth, tournamentId));
                }}
                onBlur={() => setCancelConfirm(false)}
                disabled={actionPending}
                className="text-xs px-3 py-1.5 rounded border transition-colors disabled:opacity-40"
                style={{
                  borderColor: cancelConfirm ? "#ef4444" : "var(--v2-border)",
                  color: cancelConfirm ? "#ef4444" : "var(--v2-muted)",
                }}
              >
                {cancelConfirm ? t("tournamentPage.clickAgainToCancel") : t("tournamentPage.cancelTournament")}
              </button>
            </div>
          </div>
        )}

        {/* Bracket */}
        {matches.length > 0 && (
          <BracketView
            tournament={tournament}
            matches={matches}
            registrations={registrations}
            isOrganizer={isOrganizer}
            onReportWinner={(matchId, winnerUid) =>
              void runAction(() => api.reportTournamentMatch(auth, tournamentId, matchId, winnerUid))
            }
            onAssignSlot={(matchId, slotNum, uid) =>
              void runAction(() => api.assignTournamentSlot(auth, tournamentId, matchId, slotNum, uid))
            }
            onRevertMatch={(matchId) => void runAction(() => api.revertTournamentMatch(auth, tournamentId, matchId))}
          />
        )}
      </div>

      {editOpen && (
        <EditTournamentDialog
          tournament={tournament}
          registrationCount={registrations.length}
          onClose={() => setEditOpen(false)}
          onSave={async (params) => {
            const res = await api.updateTournament(auth, tournamentId, params);
            if (res && !res.error) {
              setEditOpen(false);
              notifyChanged();
              void load();
              return true;
            }
            return false;
          }}
        />
      )}
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────────

export function TournamentPage({
  currentUser,
  tournamentChangeSignals,
  sendTournamentSubscribe,
  sendTournamentUnsubscribe,
  notifyTournamentChanged,
}: TournamentPageProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  if (selectedId) {
    return (
      <TournamentDetail
        tournamentId={selectedId}
        currentUser={currentUser}
        onBack={() => setSelectedId(null)}
        tournamentChangeSignals={tournamentChangeSignals}
        sendTournamentSubscribe={sendTournamentSubscribe}
        sendTournamentUnsubscribe={sendTournamentUnsubscribe}
        notifyTournamentChanged={notifyTournamentChanged}
      />
    );
  }

  return <TournamentList onSelect={setSelectedId} onCreated={setSelectedId} />;
}
