import { useState } from "react";
import { useTranslation } from "react-i18next";
import { X } from "lucide-react";
import { GAMES, DEFAULT_GAME_ROM } from "../../games";
import type { Tournament } from "../../types";
import {
  COMMON_TIMEZONES,
  detectBrowserTimezone,
  getUtcOffsetLabel,
  utcInstantToZonedInputs,
  zonedTimeToUtcIso,
} from "../../utils/timezone";

function toLocalDateInputValue(d: Date) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

type EditTournamentDialogProps = {
  tournament: Tournament;
  registrationCount: number;
  onClose: () => void;
  onSave: (params: {
    name: string;
    description: string;
    gameName: string;
    maxParticipants: number | null;
    startDate: string | null;
    timezone: string | null;
  }) => Promise<boolean>;
};

export function EditTournamentDialog({ tournament, registrationCount, onClose, onSave }: EditTournamentDialogProps) {
  const { t } = useTranslation();
  const initialTimezone = tournament.timezone ?? detectBrowserTimezone();
  const initialInputs = tournament.startDate ? utcInstantToZonedInputs(tournament.startDate, initialTimezone) : null;

  const [name, setName] = useState(tournament.name);
  const [description, setDescription] = useState(tournament.description ?? "");
  const [gameName, setGameName] = useState(tournament.gameName ?? DEFAULT_GAME_ROM);
  const [maxParticipants, setMaxParticipants] = useState(
    tournament.maxParticipants != null ? String(tournament.maxParticipants) : ""
  );
  const [startDate, setStartDate] = useState(initialInputs?.date ?? "");
  const [startTime, setStartTime] = useState(initialInputs?.time ?? "");
  const [timezone, setTimezone] = useState(initialTimezone);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const todayStr = toLocalDateInputValue(new Date());
  const timezoneOptions = COMMON_TIMEZONES.some((z) => z.id === timezone)
    ? COMMON_TIMEZONES
    : [{ id: timezone, label: timezone }, ...COMMON_TIMEZONES];

  const handleSave = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setError(t("tournamentPage.nameRequired"));
      return;
    }

    const trimmedMax = maxParticipants.trim();
    const maxParticipantsValue = trimmedMax ? parseInt(trimmedMax, 10) : null;
    if (maxParticipantsValue !== null && maxParticipantsValue < registrationCount) {
      setError(t("tournamentPage.maxParticipantsTooLow", { count: registrationCount }));
      return;
    }

    let combinedStartDate: string | null = null;
    if (startDate) {
      combinedStartDate = zonedTimeToUtcIso(startDate, startTime || "00:00", timezone);
      if (tournament.status === "registration_open" && new Date(combinedStartDate).getTime() < Date.now()) {
        setError(t("tournamentPage.startDateInPast"));
        return;
      }
    }

    setSubmitting(true);
    setError(null);
    const ok = await onSave({
      name: trimmed,
      description: description.trim(),
      gameName,
      maxParticipants: maxParticipantsValue,
      startDate: combinedStartDate,
      timezone: combinedStartDate ? timezone : null,
    });
    setSubmitting(false);
    if (!ok) setError(t("tournamentPage.updateFailed"));
  };

  const inputStyle = {
    background: "var(--v2-hover)",
    borderColor: "var(--v2-border)",
    color: "var(--v2-text)",
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.6)" }}>
      <div
        className="relative flex flex-col gap-3 rounded-xl border shadow-2xl p-6 w-96"
        style={{ background: "var(--v2-surface)", borderColor: "var(--v2-border)" }}
      >
        {submitting && (
          <div
            className="absolute inset-0 z-10 flex items-center justify-center rounded-xl"
            style={{ background: "color-mix(in srgb, var(--v2-surface) 70%, transparent)" }}
          >
            <div
              className="w-7 h-7 rounded-full border-2 border-t-transparent animate-spin"
              style={{ borderColor: "var(--v2-accent)", borderTopColor: "transparent" }}
            />
          </div>
        )}

        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold" style={{ color: "var(--v2-text)" }}>
            {t("tournamentPage.editTournament")}
          </h2>
          <button onClick={onClose} disabled={submitting} style={{ color: "var(--v2-muted)" }}>
            <X size={16} />
          </button>
        </div>

        {error && <p className="text-xs" style={{ color: "#f87171" }}>{error}</p>}

        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium" style={{ color: "var(--v2-muted)" }}>
            {t("tournamentPage.name")}
          </label>
          <input
            type="text"
            value={name}
            maxLength={48}
            onChange={(e) => setName(e.target.value)}
            className="rounded px-3 py-1.5 text-sm border outline-none"
            style={inputStyle}
            autoFocus
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium" style={{ color: "var(--v2-muted)" }}>
            {t("tournamentPage.descriptionOptional")}
          </label>
          <input
            type="text"
            value={description}
            maxLength={200}
            onChange={(e) => setDescription(e.target.value)}
            className="rounded px-3 py-1.5 text-sm border outline-none"
            style={inputStyle}
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium" style={{ color: "var(--v2-muted)" }}>
            {t("tournamentPage.game")}
          </label>
          <select
            value={gameName}
            onChange={(e) => setGameName(e.target.value)}
            className="rounded px-3 py-1.5 text-sm border outline-none w-full"
            style={inputStyle}
          >
            {GAMES.map((g) => (
              <option key={g.rom} value={g.rom} style={{ background: "var(--v2-surface)" }}>
                {g.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium" style={{ color: "var(--v2-muted)" }}>
            {t("tournamentPage.maxParticipants")}
          </label>
          <input
            type="number"
            min={registrationCount}
            max={256}
            value={maxParticipants}
            onChange={(e) => setMaxParticipants(e.target.value)}
            className="rounded px-3 py-1.5 text-sm border outline-none"
            style={inputStyle}
          />
        </div>

        <div className="flex gap-2">
          <div className="flex-1 flex flex-col gap-1">
            <label className="text-xs font-medium" style={{ color: "var(--v2-muted)" }}>
              {t("tournamentPage.startDate")}
            </label>
            <input
              type="date"
              value={startDate}
              min={tournament.status === "registration_open" ? todayStr : undefined}
              onChange={(e) => {
                setStartDate(e.target.value);
                setError(null);
              }}
              className="rounded px-3 py-1.5 text-sm border outline-none w-full"
              style={inputStyle}
            />
          </div>
          <div className="flex-1 flex flex-col gap-1">
            <label className="text-xs font-medium" style={{ color: "var(--v2-muted)" }}>
              {t("tournamentPage.startTime")}
            </label>
            <input
              type="time"
              value={startTime}
              disabled={!startDate}
              onChange={(e) => {
                setStartTime(e.target.value);
                setError(null);
              }}
              className="rounded px-3 py-1.5 text-sm border outline-none w-full disabled:opacity-40"
              style={inputStyle}
            />
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium" style={{ color: "var(--v2-muted)" }}>
            {t("tournamentPage.timezone")}
          </label>
          <select
            value={timezone}
            disabled={!startDate}
            onChange={(e) => setTimezone(e.target.value)}
            className="rounded px-3 py-1.5 text-sm border outline-none w-full disabled:opacity-40"
            style={inputStyle}
          >
            {timezoneOptions.map((z) => (
              <option key={z.id} value={z.id} style={{ background: "var(--v2-surface)" }}>
                {z.label} ({getUtcOffsetLabel(z.id)})
              </option>
            ))}
          </select>
        </div>

        <div className="flex justify-end gap-2 mt-2">
          <button
            onClick={onClose}
            disabled={submitting}
            className="text-xs px-3 py-1.5 rounded border transition-colors disabled:opacity-40"
            style={{ borderColor: "var(--v2-border)", color: "var(--v2-muted)" }}
          >
            {t("tournamentPage.cancel")}
          </button>
          <button
            onClick={() => void handleSave()}
            disabled={submitting}
            className="text-xs px-3 py-1.5 rounded transition-colors disabled:opacity-40"
            style={{ background: "var(--v2-accent)", color: "var(--v2-accent-fg)" }}
          >
            {t("tournamentPage.save")}
          </button>
        </div>
      </div>
    </div>
  );
}
