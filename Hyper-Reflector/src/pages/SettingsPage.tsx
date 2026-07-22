// TODO: add ranked queue settings, IE: region or ping / elo limits for fine grain control
import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { useTranslation } from "react-i18next";
import {
  LogOut,
  Play,
  Square,
  FolderOpen,
  Volume2,
  VolumeOff,
} from "lucide-react";
import { logout } from "../utils/firebase";
import { useSettingsStore } from "../state/store";
import { useV2Theme } from "../ThemeContext";
import { applyRomPath, formatRomPathDisplay } from "../utils/romPaths";
import {
  THEMES,
  CHAT_MSG_SWATCHES,
  NAME_SELF_SWATCHES,
  NAME_OTHER_SWATCHES,
} from "../theme";
import { GAMES } from "../games";

type SettingsPageProps = {
  onLogout: () => void;
};

const DELAYS = ["0", "1", "2", "3", "4", "5", "6", "7"];
const LANGUAGES = [
  { value: "en", label: "English" },
  { value: "ja", label: "日本語" },
];

// ── Sub-components ─────────────────────────────────────────────────────────────

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section
      className="rounded-lg overflow-hidden border"
      style={{ borderColor: "var(--v2-border)" }}
    >
      <div
        className="px-4 py-3 border-b"
        style={{
          borderColor: "var(--v2-border)",
          background: "var(--v2-surface)",
        }}
      >
        <h2
          className="text-xs font-semibold uppercase tracking-wide"
          style={{ color: "var(--v2-muted)" }}
        >
          {title}
        </h2>
      </div>
      <div
        className="px-4 py-3 space-y-3"
        style={{ background: "var(--v2-surface)" }}
      >
        {children}
      </div>
    </section>
  );
}

function Row({
  label,
  sub,
  children,
}: {
  label: string;
  sub?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-1">
      <div>
        <p className="text-sm" style={{ color: "var(--v2-text)" }}>
          {label}
        </p>
        {sub && (
          <p className="text-xs mt-0.5" style={{ color: "var(--v2-muted)" }}>
            {sub}
          </p>
        )}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

function Toggle({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="relative w-10 h-5 rounded-full transition-colors shrink-0"
      style={{ background: checked ? "var(--v2-accent)" : "var(--v2-hover)" }}
    >
      <span
        className="absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform"
        style={{ transform: checked ? "translateX(20px)" : "translateX(0)" }}
      />
    </button>
  );
}

function ColorSwatch({
  label,
  current,
  swatches,
  onChange,
}: {
  label: string;
  current: string;
  swatches: string[];
  onChange: (color: string) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-1">
      <span className="text-sm" style={{ color: "var(--v2-text)" }}>
        {label}
      </span>
      <div className="flex items-center gap-1.5">
        {swatches.map((color) => (
          <button
            key={color}
            title={color}
            onClick={() => onChange(color)}
            className="w-5 h-5 rounded-full transition-transform hover:scale-110"
            style={{
              backgroundColor: color,
              outline:
                current.toLowerCase() === color.toLowerCase()
                  ? "2px solid white"
                  : "2px solid transparent",
              outlineOffset: "1px",
            }}
          />
        ))}
      </div>
    </div>
  );
}

function SoundRow({
  label,
  enabled,
  path,
  onToggle,
  onPick,
  onPlay,
  onStop,
}: {
  label: string;
  enabled: boolean;
  path: string;
  onToggle: (v: boolean) => void;
  onPick: () => void;
  onPlay: () => void;
  onStop: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="space-y-1.5 py-1">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          {enabled ? (
            <Volume2 size={14} style={{ color: "var(--v2-accent)" }} />
          ) : (
            <VolumeOff size={14} style={{ color: "var(--v2-muted)" }} />
          )}
          <p className="text-sm" style={{ color: "var(--v2-text)" }}>
            {label}
          </p>
        </div>
        <Toggle checked={enabled} onChange={onToggle} />
      </div>
      {enabled && (
        <div className="flex items-center gap-2 pl-5">
          <p
            className="text-xs flex-1 font-mono truncate"
            style={{ color: "var(--v2-muted)" }}
          >
            {path || t("settingsPage.default")}
          </p>
          <button
            onClick={onPick}
            className="flex items-center gap-1 text-xs px-2 py-1 rounded border transition-colors"
            style={{
              borderColor: "var(--v2-border)",
              color: "var(--v2-muted)",
              background: "var(--v2-hover)",
            }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.color = "var(--v2-text)")
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.color = "var(--v2-muted)")
            }
          >
            <FolderOpen size={11} /> {t("settingsPage.browse")}
          </button>
          <button
            onClick={onPlay}
            className="p-1.5 rounded border transition-colors"
            style={{
              borderColor: "var(--v2-border)",
              color: "var(--v2-muted)",
              background: "var(--v2-hover)",
            }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.color = "var(--v2-text)")
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.color = "var(--v2-muted)")
            }
            title={t("settingsPage.preview")}
          >
            <Play size={11} />
          </button>
          <button
            onClick={onStop}
            className="p-1.5 rounded border transition-colors"
            style={{
              borderColor: "var(--v2-border)",
              color: "var(--v2-muted)",
              background: "var(--v2-hover)",
            }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.color = "var(--v2-text)")
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.color = "var(--v2-muted)")
            }
            title={t("settingsPage.stop")}
          >
            <Square size={11} />
          </button>
        </div>
      )}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export function SettingsPage({ onLogout }: SettingsPageProps) {
  const { t } = useTranslation();
  const [resetConfirm, setResetConfirm] = useState(false);
  const [romPathStatus, setRomPathStatus] = useState<
    | { kind: "success"; text: string }
    | { kind: "error"; text: string }
    | null
  >(null);

  // ── Store reads ──────────────────────────────────────────────────────────────
  const ggpoDelay = useSettingsStore((s) => s.ggpoDelay);
  const setGgpoDelay = useSettingsStore((s) => s.setGgpoDelay);
  const appLanguage = useSettingsStore((s) => s.appLanguage);
  const setAppLanguage = useSettingsStore((s) => s.setAppLanguage);
  const romPath = useSettingsStore((s) => s.romPath);
  const setRomPath = useSettingsStore((s) => s.setRomPath);
  const notifChallengeSound = useSettingsStore((s) => s.notifChallengeSound);
  const setNotifChallengeSound = useSettingsStore(
    (s) => s.setNotifChallengeSound,
  );
  const notifChallengeSoundPath = useSettingsStore(
    (s) => s.notifChallengeSoundPath,
  );
  const setNotifChallengeSoundPath = useSettingsStore(
    (s) => s.setNotifChallengeSoundPath,
  );
  const notifiAtSound = useSettingsStore((s) => s.notifiAtSound);
  const setNotifAtSound = useSettingsStore((s) => s.setNotifAtSound);
  const notifAtSoundPath = useSettingsStore((s) => s.notifAtSoundPath);
  const setNotifAtSoundPath = useSettingsStore((s) => s.setNotifAtSoundPath);
  const winSound = useSettingsStore((s) => s.winSound);
  const setWinSound = useSettingsStore((s) => s.setWinSound);
  const winSoundPath = useSettingsStore((s) => s.winSoundPath);
  const setWinSoundPath = useSettingsStore((s) => s.setWinSoundPath);
  const rankQueueGame = useSettingsStore((s) => s.rankQueueGame);
  const setRankQueueGame = useSettingsStore((s) => s.setRankQueueGame);
  const labMusicMuted = useSettingsStore((s) => s.labMusicMuted);
  const setLabMusicMuted = useSettingsStore((s) => s.setLabMusicMuted);

  const { theme, overrides, setThemeId, setOverride } = useV2Theme();

  // ── Helpers ──────────────────────────────────────────────────────────────────
  const handleLogout = async () => {
    await logout();
    onLogout();
  };

  const pickSound = async (set: (p: string) => void) => {
    try {
      const res = await open({
        multiple: false,
        directory: false,
        title: "Select a sound file",
        filters: [{ name: "Audio", extensions: ["mp3", "wav"] }],
      });
      if (typeof res === "string") set(res);
    } catch {
      /* dismissed */
    }
  };

  const pickRom = async () => {
    setRomPathStatus(null);
    let res: unknown;
    try {
      res = await open({
        multiple: false,
        directory: true,
        title: "Select ROM directory",
      });
    } catch {
      return;
    }

    if (typeof res !== "string") return;

    const sanitized = formatRomPathDisplay(res);
    try {
      await applyRomPath(sanitized);
      setRomPath(sanitized);
      setRomPathStatus({ kind: "success", text: sanitized });
    } catch (err) {
      setRomPathStatus({
        kind: "error",
        text: err instanceof Error ? err.message : String(err),
      });
    }
  };

  const playSound = async (path: string) => {
    if (!path) return;
    try {
      await invoke("play_sound", { path });
    } catch {
      /* no-op */
    }
  };

  const stopSound = async () => {
    try {
      await invoke("stop_sound");
    } catch {
      /* no-op */
    }
  };

  const handleReset = async () => {
    if (!resetConfirm) {
      setResetConfirm(true);
      return;
    }
    try {
      const store = useSettingsStore as typeof useSettingsStore & {
        persist?: { clearStorage?: () => void };
      };
      await store.persist?.clearStorage?.();
      window.location.reload();
    } catch {
      window.location.reload();
    }
  };

  // ── Theme color reads ────────────────────────────────────────────────────────
  const currentChatColor =
    overrides["--v2-chat-msg"] ?? theme.vars["--v2-chat-msg"];
  const currentSelfColor =
    overrides["--v2-name-self"] ?? theme.vars["--v2-name-self"];
  const currentOtherColor =
    overrides["--v2-name-other"] ?? theme.vars["--v2-name-other"];
  const currentPatternOpacity =
    overrides["--v2-pattern-opacity"] ?? theme.vars["--v2-pattern-opacity"];

  const selectStyle = {
    background: "var(--v2-hover)",
    borderColor: "var(--v2-border)",
    color: "var(--v2-text)",
  };

  return (
    <div className="h-full overflow-y-scroll">
      <div className="max-w-lg mx-auto p-6 space-y-4">
        {/* ── Gameplay ── */}
        <Section title={t("settingsPage.gameplay")}>
          <Row label={t("settingsPage.ggpoDelay")} sub={t("settingsPage.ggpoDelayHint")}>
            <select
              value={ggpoDelay}
              onChange={(e) => setGgpoDelay(e.target.value)}
              className="rounded px-3 py-1.5 text-sm border outline-none"
              style={selectStyle}
            >
              {DELAYS.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </Row>
        </Section>

        {/* ── 3rd Strike ── */}
        <Section title={t("settingsPage.thirdStrike")}>
          <Row
            label={t("settingsPage.muteMusic")}
            sub={t("settingsPage.muteMusicHint")}
          >
            <Toggle checked={labMusicMuted} onChange={setLabMusicMuted} />
          </Row>
        </Section>

        {/* ── Ranked Queue ── */}
        <Section title={t("settingsPage.rankedQueue")}>
          <Row label={t("settingsPage.game")} sub={t("settingsPage.rankedQueueGameHint")}>
            <select
              value={rankQueueGame}
              onChange={(e) => setRankQueueGame(e.target.value)}
              className="rounded px-3 py-1.5 text-sm border outline-none"
              style={selectStyle}
            >
              {GAMES.map((g) => (
                <option key={g.rom} value={g.rom}>
                  {g.name}
                </option>
              ))}
            </select>
          </Row>
        </Section>

        {/* ── Files ── */}
        <Section title={t("settingsPage.files")}>
          <div className="space-y-1 py-1">
            <p className="text-sm" style={{ color: "var(--v2-text)" }}>
              {t("settingsPage.romDirectory")}
            </p>
            <p
              className="text-xs font-mono break-all"
              style={{ color: "var(--v2-muted)" }}
            >
              {romPath || t("settingsPage.notSet")}
            </p>
            {romPathStatus && (
              <p
                className="text-[11px] break-words"
                style={{
                  color:
                    romPathStatus.kind === "success"
                      ? "var(--v2-accent)"
                      : "#f87171",
                }}
              >
                {romPathStatus.kind === "success"
                  ? t("settingsPage.updatedEmulatorConfig", { path: romPathStatus.text })
                  : romPathStatus.text}
              </p>
            )}
            <button
              onClick={pickRom}
              className="flex items-center gap-1.5 text-xs mt-1 transition-colors"
              style={{ color: "var(--v2-muted)" }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.color = "var(--v2-text)")
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.color = "var(--v2-muted)")
              }
            >
              <FolderOpen size={13} /> {t("settingsPage.browseRomDirectory")}
            </button>
          </div>
        </Section>

        {/* ── App ── */}
        <Section title={t("settingsPage.app")}>
          <Row label={t("settingsPage.language")}>
            <select
              value={appLanguage}
              onChange={(e) => setAppLanguage(e.target.value)}
              className="rounded px-3 py-1.5 text-sm border outline-none"
              style={selectStyle}
            >
              {LANGUAGES.map((l) => (
                <option key={l.value} value={l.value}>
                  {l.label}
                </option>
              ))}
            </select>
          </Row>
        </Section>

        {/* ── Appearance ── */}
        <Section title={t("settingsPage.appearance")}>
          <div className="space-y-4">
            {/* Theme picker */}
            <div>
              <p className="text-sm mb-2" style={{ color: "var(--v2-text)" }}>
                {t("settingsPage.theme")}
              </p>
              <div className="grid grid-cols-2 gap-2">
                {THEMES.map((themeOption) => (
                  <button
                    key={themeOption.id}
                    onClick={() => setThemeId(themeOption.id)}
                    className="flex flex-col items-start p-3 rounded border text-left transition-all"
                    style={{
                      borderColor:
                        theme.id === themeOption.id
                          ? "var(--v2-accent)"
                          : "var(--v2-border)",
                      background:
                        theme.id === themeOption.id ? "var(--v2-hover)" : "transparent",
                    }}
                  >
                    <span
                      className="text-sm font-medium"
                      style={{ color: "var(--v2-text)" }}
                    >
                      {themeOption.name}
                    </span>
                    <div className="flex gap-1 mt-1.5">
                      {(
                        ["--v2-bg", "--v2-accent", "--v2-name-self"] as const
                      ).map((k) => (
                        <span
                          key={k}
                          className="w-3 h-3 rounded-full border border-white/10"
                          style={{ background: themeOption.vars[k] }}
                        />
                      ))}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Chat color overrides */}
            <div
              className="pt-3 border-t space-y-3"
              style={{ borderColor: "var(--v2-border)" }}
            >
              <p
                className="text-xs font-semibold uppercase tracking-wide"
                style={{ color: "var(--v2-muted)" }}
              >
                {t("settingsPage.chatColors")}
              </p>
              <ColorSwatch
                label={t("settingsPage.chatText")}
                current={currentChatColor}
                swatches={CHAT_MSG_SWATCHES}
                onChange={(c) => setOverride("--v2-chat-msg", c)}
              />
              <ColorSwatch
                label={t("settingsPage.myUsername")}
                current={currentSelfColor}
                swatches={NAME_SELF_SWATCHES}
                onChange={(c) => setOverride("--v2-name-self", c)}
              />
              <ColorSwatch
                label={t("settingsPage.othersNames")}
                current={currentOtherColor}
                swatches={NAME_OTHER_SWATCHES}
                onChange={(c) => setOverride("--v2-name-other", c)}
              />
              {/* Chat preview */}
              <div
                className="text-xs rounded px-3 py-2 border"
                style={{
                  borderColor: "var(--v2-border)",
                  background: "var(--v2-hover)",
                }}
              >
                <span style={{ color: currentSelfColor }}>{t("settingsPage.previewYourName")}</span>
                <span style={{ color: "var(--v2-muted)" }}> 12:00 </span>
                <span style={{ color: currentChatColor }}>{t("settingsPage.previewHello")}</span>
                {"  "}
                <span style={{ color: currentOtherColor }}>{t("settingsPage.previewOpponent")}</span>
                <span style={{ color: "var(--v2-muted)" }}> 12:01 </span>
                <span style={{ color: currentChatColor }}>{t("settingsPage.previewGG")}</span>
              </div>
            </div>

            {/* Background options */}
            <div
              className="pt-3 border-t space-y-3"
              style={{ borderColor: "var(--v2-border)" }}
            >
              <p
                className="text-xs font-semibold uppercase tracking-wide"
                style={{ color: "var(--v2-muted)" }}
              >
                {t("settingsPage.background")}
              </p>
              <Row label={t("settingsPage.patternOverlay")} sub={t("settingsPage.patternOverlayHint")}>
                <select
                  value={currentPatternOpacity}
                  onChange={(e) =>
                    setOverride("--v2-pattern-opacity", e.target.value)
                  }
                  className="rounded px-3 py-1.5 text-sm border outline-none"
                  style={selectStyle}
                >
                  <option value="0">{t("settingsPage.patternOff")}</option>
                  <option value=".1">{t("settingsPage.patternSubtle")}</option>
                  <option value=".2">{t("settingsPage.patternMedium")}</option>
                  <option value="0.4">{t("settingsPage.patternStrong")}</option>
                </select>
              </Row>
            </div>
          </div>
        </Section>

        {/* ── Notifications ── */}
        <Section title={t("settingsPage.notifications")}>
          <SoundRow
            label={t("settingsPage.challengeReceived")}
            enabled={notifChallengeSound}
            path={notifChallengeSoundPath}
            onToggle={setNotifChallengeSound}
            onPick={() => pickSound(setNotifChallengeSoundPath)}
            onPlay={() => playSound(notifChallengeSoundPath)}
            onStop={stopSound}
          />
          <div
            className="border-t"
            style={{ borderColor: "var(--v2-border)" }}
          />
          <SoundRow
            label={t("settingsPage.mentionInChat")}
            enabled={notifiAtSound}
            path={notifAtSoundPath}
            onToggle={setNotifAtSound}
            onPick={() => pickSound(setNotifAtSoundPath)}
            onPlay={() => playSound(notifAtSoundPath)}
            onStop={stopSound}
          />
          <div
            className="border-t"
            style={{ borderColor: "var(--v2-border)" }}
          />
          <SoundRow
            label={t("settingsPage.matchWin")}
            enabled={winSound}
            path={winSoundPath}
            onToggle={setWinSound}
            onPick={() => pickSound(setWinSoundPath)}
            onPlay={() => playSound(winSoundPath)}
            onStop={stopSound}
          />
        </Section>

        {/* ── Account ── */}
        <Section title={t("settingsPage.account")}>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 text-sm text-red-400 hover:text-red-300 transition-colors"
          >
            <LogOut size={14} /> {t("settingsPage.signOut")}
          </button>
        </Section>

        {/* ── Danger zone ── */}
        <Section title={t("settingsPage.dangerZone")}>
          <div className="space-y-2 py-1">
            <p className="text-xs" style={{ color: "var(--v2-muted)" }}>
              {t("settingsPage.resetHint")}
            </p>
            <button
              onClick={handleReset}
              onBlur={() => setResetConfirm(false)}
              className="text-sm px-3 py-1.5 rounded border transition-colors"
              style={{
                borderColor: resetConfirm ? "#ef4444" : "var(--v2-border)",
                color: resetConfirm ? "#ef4444" : "var(--v2-muted)",
                background: resetConfirm
                  ? "rgba(239,68,68,0.1)"
                  : "var(--v2-hover)",
              }}
            >
              {resetConfirm
                ? t("settingsPage.resetConfirm")
                : t("settingsPage.resetAllSettings")}
            </button>
          </div>
        </Section>
      </div>
    </div>
  );
}
