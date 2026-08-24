import { useTranslation } from "react-i18next";
import type { Tournament, TournamentMatch, TournamentMatchSlot, TournamentRegistration } from "../../types";

type BracketViewProps = {
  tournament: Tournament;
  matches: TournamentMatch[];
  registrations: TournamentRegistration[];
  isOrganizer: boolean;
  onReportWinner: (matchId: string, winnerUid: string) => void;
  onAssignSlot: (matchId: string, slotNum: 1 | 2, uid: string | null) => void;
  onRevertMatch: (matchId: string) => void;
};

// Mirrors tournamentEngine.js's revertMatch safety check: only report-able if
// nothing downstream has been decided yet. Computed client-side purely so the
// "Edit result" control only appears when the call would actually succeed.
function canRevertMatch(match: TournamentMatch, allMatches: TournamentMatch[]): boolean {
  if (match.status !== "reported") return false;
  const next = match.nextMatchId ? allMatches.find((m) => m.id === match.nextMatchId) : null;
  if (next && (next.status === "reported" || next.status === "bye")) return false;
  const nextLoser = match.nextLoserMatchId ? allMatches.find((m) => m.id === match.nextLoserMatchId) : null;
  if (nextLoser && (nextLoser.status === "reported" || nextLoser.status === "bye")) return false;
  if (match.id === "gf1" && allMatches.some((m) => m.id === "gf2")) return false;
  return true;
}

// Bracket rendering strategy: each round is its own column of match cards,
// columns laid out left-to-right in a horizontally-scrolling row. This skips
// computing pixel-perfect connector lines between rounds (a nice-to-have, not
// a functional gap) in favor of something simple and correct first.
function groupByRound(matches: TournamentMatch[]) {
  const rounds = new Map<number, TournamentMatch[]>();
  for (const m of matches) {
    const list = rounds.get(m.round) ?? [];
    list.push(m);
    rounds.set(m.round, list);
  }
  for (const list of rounds.values()) list.sort((a, b) => a.matchIndex - b.matchIndex);
  return [...rounds.entries()].sort((a, b) => a[0] - b[0]).map(([, list]) => list);
}

function SlotLabel({
  slot,
  isWinner,
  t,
}: {
  slot: TournamentMatchSlot | null;
  isWinner: boolean;
  t: (key: string) => string;
}) {
  const label = !slot ? "—" : slot.isBye ? t("tournamentPage.bye") : slot.userName ?? "—";
  return (
    <span
      className="text-xs truncate"
      style={{
        color: isWinner ? "var(--v2-accent)" : "var(--v2-text)",
        fontWeight: isWinner ? 600 : 400,
      }}
    >
      {label}
    </span>
  );
}

function SeedSelect({
  value,
  registrations,
  onChange,
}: {
  value: string | null;
  registrations: TournamentRegistration[];
  onChange: (uid: string | null) => void;
}) {
  return (
    <select
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value || null)}
      className="text-xs px-1.5 py-0.5 rounded border outline-none w-full"
      style={{ background: "var(--v2-hover)", borderColor: "var(--v2-border)", color: "var(--v2-text)" }}
    >
      <option value="" style={{ background: "var(--v2-surface)" }}>—</option>
      {registrations.map((r) => (
        <option key={r.uid} value={r.uid} style={{ background: "var(--v2-surface)" }}>
          {r.userName}
        </option>
      ))}
    </select>
  );
}

function MatchCell({
  match,
  allMatches,
  tournament,
  registrations,
  isOrganizer,
  onReportWinner,
  onAssignSlot,
  onRevertMatch,
}: {
  match: TournamentMatch;
  allMatches: TournamentMatch[];
  tournament: Tournament;
  registrations: TournamentRegistration[];
  isOrganizer: boolean;
  onReportWinner: (matchId: string, winnerUid: string) => void;
  onAssignSlot: (matchId: string, slotNum: 1 | 2, uid: string | null) => void;
  onRevertMatch: (matchId: string) => void;
}) {
  const { t } = useTranslation();
  // Seed-editable whenever this specific match hasn't been played yet — not
  // gated on tournament status, so it works whether the bracket is still in
  // 'seeding' or already 'in_progress' via the fast "Start Tournament" path.
  const editable =
    isOrganizer &&
    match.bracketType === "winners" &&
    match.round === 1 &&
    (match.status === "pending" || match.status === "ready");
  const reportable =
    isOrganizer && tournament.status === "in_progress" && match.status === "ready" && match.slot1 && match.slot2;
  const revertible = isOrganizer && canRevertMatch(match, allMatches);

  return (
    <div
      className="rounded border px-2.5 py-2 space-y-1 w-48 shrink-0"
      style={{ background: "var(--v2-surface)", borderColor: "var(--v2-border)" }}
    >
      {editable ? (
        <SeedSelect
          value={match.slot1?.uid ?? null}
          registrations={registrations}
          onChange={(uid) => onAssignSlot(match.id, 1, uid)}
        />
      ) : (
        <button
          disabled={!reportable}
          onClick={() => match.slot1?.uid && onReportWinner(match.id, match.slot1.uid)}
          className="w-full text-left disabled:cursor-default"
        >
          <SlotLabel slot={match.slot1} isWinner={!!match.winnerUid && match.winnerUid === match.slot1?.uid} t={t} />
        </button>
      )}
      <div className="text-[10px]" style={{ color: "var(--v2-muted)" }}>
        {t("tournamentPage.vs")}
      </div>
      {editable ? (
        <SeedSelect
          value={match.slot2?.uid ?? null}
          registrations={registrations}
          onChange={(uid) => onAssignSlot(match.id, 2, uid)}
        />
      ) : (
        <button
          disabled={!reportable}
          onClick={() => match.slot2?.uid && onReportWinner(match.id, match.slot2.uid)}
          className="w-full text-left disabled:cursor-default"
        >
          <SlotLabel slot={match.slot2} isWinner={!!match.winnerUid && match.winnerUid === match.slot2?.uid} t={t} />
        </button>
      )}
      {reportable && (
        <p className="text-[10px] pt-0.5" style={{ color: "var(--v2-muted)" }}>
          {t("tournamentPage.reportWinner")}
        </p>
      )}
      {revertible && (
        <button
          onClick={() => onRevertMatch(match.id)}
          className="text-[10px] pt-0.5 underline"
          style={{ color: "var(--v2-muted)" }}
        >
          {t("tournamentPage.editResult")}
        </button>
      )}
    </div>
  );
}

function BracketColumns({
  title,
  matches,
  allMatches,
  tournament,
  registrations,
  isOrganizer,
  onReportWinner,
  onAssignSlot,
  onRevertMatch,
}: {
  title: string;
  matches: TournamentMatch[];
  allMatches: TournamentMatch[];
  tournament: Tournament;
  registrations: TournamentRegistration[];
  isOrganizer: boolean;
  onReportWinner: (matchId: string, winnerUid: string) => void;
  onAssignSlot: (matchId: string, slotNum: 1 | 2, uid: string | null) => void;
  onRevertMatch: (matchId: string) => void;
}) {
  if (matches.length === 0) return null;
  const rounds = groupByRound(matches);
  return (
    <div className="space-y-2">
      <h3 className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--v2-muted)" }}>
        {title}
      </h3>
      <div className="flex gap-4 overflow-x-auto pb-2">
        {rounds.map((round, i) => (
          <div key={i} className="flex flex-col gap-3 justify-center">
            {round.map((match) => (
              <MatchCell
                key={match.id}
                match={match}
                allMatches={allMatches}
                tournament={tournament}
                registrations={registrations}
                isOrganizer={isOrganizer}
                onReportWinner={onReportWinner}
                onAssignSlot={onAssignSlot}
                onRevertMatch={onRevertMatch}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export function BracketView({
  tournament,
  matches,
  registrations,
  isOrganizer,
  onReportWinner,
  onAssignSlot,
  onRevertMatch,
}: BracketViewProps) {
  const { t } = useTranslation();
  const winners = matches.filter((m) => m.bracketType === "winners");
  const losers = matches.filter((m) => m.bracketType === "losers");
  const grandFinals = matches.filter((m) => m.bracketType === "grand-finals").sort((a, b) => a.round - b.round);

  const champion = matches.find((m) => !m.nextMatchId && m.winnerUid)?.winnerUid;
  const championName =
    matches.flatMap((m) => [m.slot1, m.slot2]).find((s) => s?.uid === champion)?.userName ?? champion;

  return (
    <div className="space-y-6">
      {tournament.status === "completed" && champion && (
        <div
          className="rounded-lg border px-4 py-3 flex items-center gap-2"
          style={{ borderColor: "var(--v2-accent)", background: "color-mix(in srgb, var(--v2-accent) 10%, transparent)" }}
        >
          <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--v2-accent)" }}>
            {t("tournamentPage.champion")}
          </span>
          <span className="text-sm font-semibold" style={{ color: "var(--v2-text)" }}>
            {championName}
          </span>
        </div>
      )}
      <BracketColumns
        title={t("tournamentPage.winnersBracket")}
        matches={winners}
        allMatches={matches}
        tournament={tournament}
        registrations={registrations}
        isOrganizer={isOrganizer}
        onReportWinner={onReportWinner}
        onAssignSlot={onAssignSlot}
        onRevertMatch={onRevertMatch}
      />
      <BracketColumns
        title={t("tournamentPage.losersBracket")}
        matches={losers}
        allMatches={matches}
        tournament={tournament}
        registrations={registrations}
        isOrganizer={isOrganizer}
        onReportWinner={onReportWinner}
        onAssignSlot={onAssignSlot}
        onRevertMatch={onRevertMatch}
      />
      {grandFinals.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--v2-muted)" }}>
            {grandFinals.length > 1 ? t("tournamentPage.grandFinalsReset") : t("tournamentPage.grandFinals")}
          </h3>
          <div className="flex gap-4">
            {grandFinals.map((match) => (
              <MatchCell
                key={match.id}
                match={match}
                allMatches={matches}
                tournament={tournament}
                registrations={registrations}
                isOrganizer={isOrganizer}
                onReportWinner={onReportWinner}
                onAssignSlot={onAssignSlot}
                onRevertMatch={onRevertMatch}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
