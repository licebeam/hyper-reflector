// TODO: add ranked queue settings, IE: region or ping / elo limits for fine grain control
import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import {
  LogOut,
  Play,
  Square,
  FolderOpen,
  Volume2,
  VolumeOff,
} from "lucide-react";
import { logout } from "../../src/utils/firebase";
import { useSettingsStore } from "../../src/state/store";
import { useV2Theme } from "../ThemeContext";
import {
  THEMES,
  CHAT_MSG_SWATCHES,
  NAME_SELF_SWATCHES,
  NAME_OTHER_SWATCHES,
} from "../theme";
import type { V2User } from "../types";
import { GAMES } from "../games";

type SettingsPageProps = {
  user: V2User;
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
            {path || "Default"}
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
            <FolderOpen size={11} /> Browse
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
            title="Preview"
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
            title="Stop"
          >
            <Square size={11} />
          </button>
        </div>
      )}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export function SettingsPage({ user, onLogout }: SettingsPageProps) {
  const [resetConfirm, setResetConfirm] = useState(false);

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
    try {
      const res = await open({
        multiple: false,
        directory: true,
        title: "Select ROM directory",
      });
      if (typeof res === "string") setRomPath(res);
    } catch {
      /* dismissed */
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
      store.persist?.clearStorage?.();
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
        <Section title="Gameplay">
          <Row label="GGPO Delay" sub="Frame delay for netplay (0 – 7)">
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

        {/* ── Ranked Queue ── */}
        <Section title="Ranked Queue">
          <Row label="Game" sub="The game you queue for in ranked search">
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
        <Section title="Files">
          <div className="space-y-1 py-1">
            <p className="text-sm" style={{ color: "var(--v2-text)" }}>
              ROM directory
            </p>
            <p
              className="text-xs font-mono break-all"
              style={{ color: "var(--v2-muted)" }}
            >
              {romPath || "Not set"}
            </p>
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
              <FolderOpen size={13} /> Browse for ROM directory…
            </button>
          </div>
        </Section>

        {/* ── App ── */}
        <Section title="App">
          <Row label="Language">
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
          <Row label="Version">
            <div
              className="flex rounded overflow-hidden border text-xs font-medium"
              style={{ borderColor: "var(--v2-border)" }}
            >
              <button
                className="px-2.5 py-1 transition-colors"
                style={{
                  background: "var(--v2-hover)",
                  color: "var(--v2-muted)",
                }}
                onClick={() => {
                  localStorage.setItem("appVersion", "v1");
                  window.location.reload();
                }}
              >
                V1
              </button>
              <span
                className="px-2.5 py-1"
                style={{
                  background: "var(--v2-accent)",
                  color: "var(--v2-accent-fg)",
                }}
              >
                V2
              </span>
            </div>
          </Row>
        </Section>

        {/* ── Appearance ── */}
        <Section title="Appearance">
          <div className="space-y-4">
            {/* Theme picker */}
            <div>
              <p className="text-sm mb-2" style={{ color: "var(--v2-text)" }}>
                Theme
              </p>
              <div className="grid grid-cols-2 gap-2">
                {THEMES.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setThemeId(t.id)}
                    className="flex flex-col items-start p-3 rounded border text-left transition-all"
                    style={{
                      borderColor:
                        theme.id === t.id
                          ? "var(--v2-accent)"
                          : "var(--v2-border)",
                      background:
                        theme.id === t.id ? "var(--v2-hover)" : "transparent",
                    }}
                  >
                    <span className="text-lg mb-1">{t.emoji}</span>
                    <span
                      className="text-sm font-medium"
                      style={{ color: "var(--v2-text)" }}
                    >
                      {t.name}
                    </span>
                    <div className="flex gap-1 mt-1.5">
                      {(
                        ["--v2-bg", "--v2-accent", "--v2-name-self"] as const
                      ).map((k) => (
                        <span
                          key={k}
                          className="w-3 h-3 rounded-full border border-white/10"
                          style={{ background: t.vars[k] }}
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
                Chat Colors
              </p>
              <ColorSwatch
                label="Chat text"
                current={currentChatColor}
                swatches={CHAT_MSG_SWATCHES}
                onChange={(c) => setOverride("--v2-chat-msg", c)}
              />
              <ColorSwatch
                label="My username"
                current={currentSelfColor}
                swatches={NAME_SELF_SWATCHES}
                onChange={(c) => setOverride("--v2-name-self", c)}
              />
              <ColorSwatch
                label="Others' names"
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
                <span style={{ color: currentSelfColor }}>YourName</span>
                <span style={{ color: "var(--v2-muted)" }}> 12:00 </span>
                <span style={{ color: currentChatColor }}>Hello lobby!</span>
                {"  "}
                <span style={{ color: currentOtherColor }}>Opponent</span>
                <span style={{ color: "var(--v2-muted)" }}> 12:01 </span>
                <span style={{ color: currentChatColor }}>GG!</span>
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
                Background
              </p>
              <Row label="Pattern overlay" sub="Tiled texture visibility">
                <select
                  value={currentPatternOpacity}
                  onChange={(e) =>
                    setOverride("--v2-pattern-opacity", e.target.value)
                  }
                  className="rounded px-3 py-1.5 text-sm border outline-none"
                  style={selectStyle}
                >
                  <option value="0">Off</option>
                  <option value="0.06">Subtle</option>
                  <option value="0.12">Medium</option>
                  <option value="0.22">Strong</option>
                </select>
              </Row>
            </div>
          </div>
        </Section>

        {/* ── Notifications ── */}
        <Section title="Notifications">
          <SoundRow
            label="Challenge received"
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
            label="@-mention in chat"
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
            label="Match win"
            enabled={winSound}
            path={winSoundPath}
            onToggle={setWinSound}
            onPick={() => pickSound(setWinSoundPath)}
            onPlay={() => playSound(winSoundPath)}
            onStop={stopSound}
          />
        </Section>

        {/* ── Account ── */}
        <Section title="Account">
          <Row label="Username">
            <span
              className="text-sm font-medium"
              style={{ color: "var(--v2-accent)" }}
            >
              {user.userName}
            </span>
          </Row>
          {user.userEmail && (
            <Row label="Email">
              <span className="text-sm" style={{ color: "var(--v2-text)" }}>
                {user.userEmail}
              </span>
            </Row>
          )}
          <Row label="ELO">
            <span className="text-sm" style={{ color: "var(--v2-text)" }}>
              {user.accountElo}
            </span>
          </Row>
          <div
            className="pt-2 border-t"
            style={{ borderColor: "var(--v2-border)" }}
          >
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 text-sm text-red-400 hover:text-red-300 transition-colors"
            >
              <LogOut size={14} /> Sign out
            </button>
          </div>
        </Section>

        {/* ── Danger zone ── */}
        <Section title="Danger Zone">
          <div className="space-y-2 py-1">
            <p className="text-xs" style={{ color: "var(--v2-muted)" }}>
              Reset all saved settings to their defaults. This cannot be undone.
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
                ? "Click again to confirm reset"
                : "Reset all settings"}
            </button>
          </div>
        </Section>
      </div>
    </div>
  );
}
