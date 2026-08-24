import { useTranslation } from "react-i18next";
import type { Tournament } from "../../types";
import { getGameName } from "../../games";
import { formatViewerLocal } from "../../utils/timezone";

const STATUS_KEY: Record<Tournament["status"], string> = {
  registration_open: "tournamentPage.statusRegistrationOpen",
  seeding: "tournamentPage.statusSeeding",
  in_progress: "tournamentPage.statusInProgress",
  paused: "tournamentPage.statusPaused",
  completed: "tournamentPage.statusCompleted",
  cancelled: "tournamentPage.statusCancelled",
};

const STATUS_COLOR: Record<Tournament["status"], string> = {
  registration_open: "var(--v2-accent)",
  seeding: "#fbbf24",
  in_progress: "#34d399",
  paused: "#fb923c",
  completed: "var(--v2-muted)",
  cancelled: "#f87171",
};

type TournamentCardProps = {
  tournament: Tournament;
  registrationCount: number;
  onClick: () => void;
};

export function TournamentCard({ tournament, registrationCount, onClick }: TournamentCardProps) {
  const { t } = useTranslation();
  const formatLabel =
    tournament.format === "double-elim" ? t("tournamentPage.formatDoubleElim") : t("tournamentPage.formatSingleElim");
  const countLabel = tournament.maxParticipants
    ? t("tournamentPage.registeredCountMax", { count: registrationCount, max: tournament.maxParticipants })
    : t("tournamentPage.registeredCount", { count: registrationCount });

  return (
    <button
      onClick={onClick}
      className="w-full text-left rounded-lg border p-4 transition-colors"
      style={{ background: "var(--v2-surface)", borderColor: "var(--v2-border)" }}
      onMouseEnter={(e) => (e.currentTarget.style.background = "var(--v2-hover)")}
      onMouseLeave={(e) => (e.currentTarget.style.background = "var(--v2-surface)")}
    >
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-semibold truncate" style={{ color: "var(--v2-text)" }}>
          {tournament.name}
        </span>
        <span
          className="text-[10px] px-1.5 py-0.5 rounded shrink-0"
          style={{
            color: STATUS_COLOR[tournament.status],
            background: "color-mix(in srgb, currentColor 15%, transparent)",
          }}
        >
          {t(STATUS_KEY[tournament.status])}
        </span>
      </div>
      <div className="flex items-center gap-2 mt-1.5 text-xs" style={{ color: "var(--v2-muted)" }}>
        <span>{formatLabel}</span>
        <span>·</span>
        <span>{getGameName(tournament.gameName ?? undefined)}</span>
        <span>·</span>
        <span>{countLabel}</span>
        {tournament.startDate && (
          <>
            <span>·</span>
            <span>{t("tournamentPage.startsOn", { date: formatViewerLocal(tournament.startDate) })}</span>
          </>
        )}
      </div>
    </button>
  );
}
