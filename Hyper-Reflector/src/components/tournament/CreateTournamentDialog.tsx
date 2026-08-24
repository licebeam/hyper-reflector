import { useState } from "react";
import { useTranslation } from "react-i18next";
import { X } from "lucide-react";
import { GAMES, DEFAULT_GAME_ROM } from "../../games";
import type { TournamentFormat } from "../../types";
import { COMMON_TIMEZONES, detectBrowserTimezone, getUtcOffsetLabel, zonedTimeToUtcIso } from "../../utils/timezone";

function toLocalDateInputValue(d: Date) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function toLocalTimeInputValue(d: Date) {
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `${hh}:${mi}`;
}

type CreateTournamentDialogProps = {
  onClose: () => void;
  onCreate: (params: {
    name: string;
    description: string;
    gameName: string;
    format: TournamentFormat;
    maxParticipants: number | null;
    startDate: string | null;
    timezone: string | null;
  }) => Promise<boolean>;
};

export function CreateTournamentDialog({ onClose, onCreate }: CreateTournamentDialogProps) {
  const { t } = useTranslation();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [gameName, setGameName] = useState(DEFAULT_GAME_ROM);
  const [format, setFormat] = useState<TournamentFormat>("single-elim");
  const [maxParticipants, setMaxParticipants] = useState("");
  const [startDate, setStartDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [timezone, setTimezone] = useState(detectBrowserTimezone);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const now = new Date();
  const todayStr = toLocalDateInputValue(now);
  const minTimeStr = startDate === todayStr ? toLocalTimeInputValue(now) : undefined;

  const timezoneOptions = COMMON_TIMEZONES.some((z) => z.id === timezone)
    ? COMMON_TIMEZONES
    : [{ id: timezone, label: timezone }, ...COMMON_TIMEZONES];

  const handleCreate = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setError(t("tournamentPage.nameRequired"));
      return;
    }

    let combinedStartDate: string | null = null;
    if (startDate) {
      combinedStartDate = zonedTimeToUtcIso(startDate, startTime || "00:00", timezone);
      if (new Date(combinedStartDate).getTime() < Date.now()) {
        setError(t("tournamentPage.startDateInPast"));
        return;
      }
    }

    setSubmitting(true);
    setError(null);
    const ok = await onCreate({
      name: trimmed,
      description: description.trim(),
      gameName,
      format,
      maxParticipants: maxParticipants.trim() ? parseInt(maxParticipants, 10) : null,
      startDate: combinedStartDate,
      timezone: combinedStartDate ? timezone : null,
    });
    setSubmitting(false);
    if (!ok) setError(t("tournamentPage.createFailed"));
  };

  const inputStyle = {
    background: "var(--v2-hover)",
    borderColor: "var(--v2-border)",
    color: "var(--v2-text)",
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.6)" }}
    >
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
            {t("tournamentPage.createTournament")}
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
            placeholder={t("tournamentPage.namePlaceholder")}
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

        <div className="flex gap-2">
          <div className="flex-1 flex flex-col gap-1">
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
          <div className="flex-1 flex flex-col gap-1">
            <label className="text-xs font-medium" style={{ color: "var(--v2-muted)" }}>
              {t("tournamentPage.format")}
            </label>
            <select
              value={format}
              onChange={(e) => setFormat(e.target.value as TournamentFormat)}
              className="rounded px-3 py-1.5 text-sm border outline-none w-full"
              style={inputStyle}
            >
              <option value="single-elim" style={{ background: "var(--v2-surface)" }}>
                {t("tournamentPage.formatSingleElim")}
              </option>
              <option value="double-elim" style={{ background: "var(--v2-surface)" }}>
                {t("tournamentPage.formatDoubleElim")}
              </option>
            </select>
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium" style={{ color: "var(--v2-muted)" }}>
            {t("tournamentPage.maxParticipants")}
          </label>
          <input
            type="number"
            min={2}
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
              min={todayStr}
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
              min={minTimeStr}
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
            onClick={() => void handleCreate()}
            disabled={submitting}
            className="text-xs px-3 py-1.5 rounded transition-colors disabled:opacity-40"
            style={{ background: "var(--v2-accent)", color: "var(--v2-accent-fg)" }}
          >
            {t("tournamentPage.create")}
          </button>
        </div>
      </div>
    </div>
  );
}
