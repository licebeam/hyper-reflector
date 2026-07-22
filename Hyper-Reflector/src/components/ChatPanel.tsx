import { useEffect, useRef, useState } from "react";
import { Send, Swords, Check, X, Eye, EyeOff } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { V2Message, V2User } from "../types";
import { GAMES, getGameName } from "../games";
import { useSettingsStore } from "../state/store";

const MAX_LENGTH = 120;

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function renderText(text: string, currentUserName?: string) {
  const parts = text.split(/(@\S+)/g);
  return parts.map((part, i) => {
    if (!part.startsWith("@")) return part;
    const name = part.slice(1);
    const isSelf =
      currentUserName && name.toLowerCase() === currentUserName.toLowerCase();
    return (
      <span
        key={i}
        className={isSelf ? "font-semibold" : ""}
        style={{
          color: isSelf
            ? "var(--v2-accent)"
            : "color-mix(in srgb, var(--v2-accent) 75%, var(--v2-text))",
        }}
      >
        {part}
      </span>
    );
  });
}

// ── Challenge message card ─────────────────────────────────────────────────────

function ChallengeMessage({
  msg,
  currentUserUid,
  onAccept,
  onDecline,
}: {
  msg: V2Message;
  currentUserUid?: string;
  onAccept: (id: string) => void;
  onDecline: (id: string) => void;
}) {
  const { t } = useTranslation();
  const isRecipient = msg.challengeOpponentId === currentUserUid;
  const isResolved = !!msg.challengeStatus;

  return (
    <div
      className="flex items-start gap-2 px-3 py-2 rounded-lg border my-1"
      style={{ background: "var(--v2-surface)", borderColor: "var(--v2-border)" }}
    >
      <div
        className="mt-0.5 shrink-0 w-6 h-6 rounded-full flex items-center justify-center"
        style={{ background: "var(--v2-accent)", color: "var(--v2-accent-fg)" }}
      >
        <Swords size={12} />
      </div>
      <div className="flex-1 min-w-0">
        <span className="text-xs font-medium" style={{ color: "var(--v2-text)" }}>
          {msg.text}
        </span>
        {msg.challengeGameName && (
          <span
            className="text-[10px] font-medium px-1.5 py-0.5 rounded ml-2"
            style={{
              background: "color-mix(in srgb, var(--v2-accent) 15%, transparent)",
              color: "var(--v2-accent)",
            }}
          >
            {getGameName(msg.challengeGameName)}
          </span>
        )}
        {isRecipient && !isResolved && (
          <div className="flex gap-2 mt-1.5">
            <button
              onClick={() => onAccept(msg.id)}
              className="flex items-center gap-1 text-[11px] px-2 py-0.5 rounded font-medium transition-opacity hover:opacity-80"
              style={{ background: "#34d399", color: "#000" }}
            >
              <Check size={11} /> {t("chatPanel.accept")}
            </button>
            <button
              onClick={() => onDecline(msg.id)}
              className="flex items-center gap-1 text-[11px] px-2 py-0.5 rounded font-medium border transition-opacity hover:opacity-80"
              style={{
                background: "var(--v2-hover)",
                color: "var(--v2-muted)",
                borderColor: "var(--v2-border)",
              }}
            >
              <X size={11} /> {t("chatPanel.decline")}
            </button>
          </div>
        )}
        {isResolved && (
          <span
            className="text-[10px] ml-2"
            style={{ color: "var(--v2-muted)" }}
          >
            {msg.challengeStatus === "accepted" ? t("chatPanel.accepted") : t("chatPanel.declined")}
          </span>
        )}
      </div>
    </div>
  );
}

// ── Main panel ─────────────────────────────────────────────────────────────────

type ChatPanelProps = {
  messages: V2Message[];
  currentUserUid?: string;
  currentUserName?: string;
  users?: V2User[];
  lobbyGame?: string;
  lobbyPassword?: string;
  onSend: (text: string) => boolean;
  onAcceptChallenge?: (messageId: string) => void;
  onDeclineChallenge?: (messageId: string) => void;
  onUpdateGame?: (gameName: string) => void;
};

export function ChatPanel({
  messages,
  currentUserUid,
  currentUserName,
  users,
  lobbyGame,
  lobbyPassword,
  onSend,
  onAcceptChallenge,
  onDeclineChallenge,
  onUpdateGame,
}: ChatPanelProps) {
  const { t } = useTranslation();
  const [input, setInput] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionIdx, setMentionIdx] = useState(0);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const mutedUsers = useSettingsStore((s) => s.mutedUsers);

  const visibleMessages = messages.filter(
    (m) => m.role !== "user" || !m.senderUid || !mutedUsers.includes(m.senderUid),
  );

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [visibleMessages]);

  const mentionCandidates = mentionQuery !== null && users
    ? users.filter(
        (u) =>
          u.uid !== currentUserUid &&
          u.userName.toLowerCase().startsWith(mentionQuery.toLowerCase()),
      )
    : [];

  const getMentionQuery = (text: string, cursor: number): string | null => {
    const before = text.slice(0, cursor);
    const match = before.match(/@(\S*)$/);
    return match ? match[1] : null;
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setInput(val);
    const cursor = e.target.selectionStart ?? val.length;
    const query = getMentionQuery(val, cursor);
    setMentionQuery(query);
    setMentionIdx(0);
  };

  const selectMention = (userName: string) => {
    const cursor = inputRef.current?.selectionStart ?? input.length;
    const before = input.slice(0, cursor);
    const after = input.slice(cursor);
    const replaced = before.replace(/@\S*$/, `@${userName} `);
    setInput(replaced + after);
    setMentionQuery(null);
    setMentionIdx(0);
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const handleSend = () => {
    const text = input.trim();
    if (!text) return;
    if (onSend(text)) {
      setInput("");
      setMentionQuery(null);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (mentionCandidates.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setMentionIdx((i) => (i + 1) % mentionCandidates.length);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setMentionIdx((i) => (i - 1 + mentionCandidates.length) % mentionCandidates.length);
        return;
      }
      if (e.key === "Tab" || e.key === "Enter") {
        e.preventDefault();
        selectMention(mentionCandidates[mentionIdx].userName);
        return;
      }
      if (e.key === "Escape") {
        setMentionQuery(null);
        return;
      }
    }
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (!input.trim()) {
        inputRef.current?.blur();
        return;
      }
      handleSend();
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Messages */}
      <div className="flex-1 p-3 space-y-1.5 min-h-0 overflow-y-scroll">
        <div className="flex items-center gap-2 pb-1">
          {onUpdateGame ? (
            <select
              value={lobbyGame ?? ''}
              onChange={e => onUpdateGame(e.target.value)}
              className="text-[10px] font-medium uppercase tracking-wide border-none outline-none bg-transparent cursor-pointer"
              style={{ color: 'var(--v2-muted)' }}
            >
              {GAMES.map(g => (
                <option key={g.rom} value={g.rom} style={{ background: 'var(--v2-surface)', textTransform: 'none' }}>
                  {g.name}
                </option>
              ))}
            </select>
          ) : (
            <span className="text-[10px] font-medium uppercase tracking-wide" style={{ color: 'var(--v2-muted)' }}>
              {getGameName(lobbyGame)}
            </span>
          )}
          {lobbyPassword && (
            <div className="flex items-center gap-1">
              <span className="text-[10px] font-mono" style={{ color: 'var(--v2-muted)' }}>
                {showPassword ? lobbyPassword : '••••••'}
              </span>
              <button
                onClick={() => setShowPassword(s => !s)}
                className="flex items-center justify-center transition-colors"
                style={{ color: 'var(--v2-muted)' }}
                onMouseEnter={e => (e.currentTarget.style.color = 'var(--v2-text)')}
                onMouseLeave={e => (e.currentTarget.style.color = 'var(--v2-muted)')}
                title={showPassword ? t('chatPanel.hidePassword') : t('chatPanel.showPassword')}
              >
                {showPassword ? <EyeOff size={11} /> : <Eye size={11} />}
              </button>
            </div>
          )}
        </div>
        {visibleMessages.length === 0 && (
          <p className="text-sm text-center pt-8" style={{ color: "var(--v2-muted)" }}>
            {t("chatPanel.noMessages")}
          </p>
        )}

        {visibleMessages.map((msg) => (
          <div key={msg.id} className="overflow-hidden">
            {msg.role === "user" && (
              <div className="min-w-0">
                <span
                  className="font-semibold text-sm"
                  style={{
                    color:
                      msg.senderUid === currentUserUid
                        ? "var(--v2-name-self)"
                        : "var(--v2-name-other)",
                  }}
                >
                  {msg.userName}
                </span>
                <span className="text-xs ml-1.5" style={{ color: "var(--v2-muted)" }}>
                  {formatTime(msg.timeStamp)}
                </span>
                <span
                  className="text-sm ml-2 wrap-break-word"
                  style={{ color: "var(--v2-chat-msg)", wordBreak: "break-word", overflowWrap: "anywhere" }}
                >
                  {renderText(msg.text, currentUserName)}
                </span>
              </div>
            )}

            {msg.role === "system" && (
              <p className="text-xs italic wrap-break-word overflow-hidden" style={{ color: "var(--v2-muted)", overflowWrap: "anywhere" }}>
                {msg.text}
              </p>
            )}

            {msg.role === "challenge" && (
              <ChallengeMessage
                msg={msg}
                currentUserUid={currentUserUid}
                onAccept={onAcceptChallenge ?? (() => {})}
                onDecline={onDeclineChallenge ?? (() => {})}
              />
            )}
          </div>
        ))}

        <div ref={bottomRef} />
      </div>

      {/* Input bar */}
      <div
        className="border-t p-3 flex flex-col gap-1.5 shrink-0 relative"
        style={{ borderColor: "var(--v2-border)" }}
      >
        {/* @ mention dropdown */}
        {mentionCandidates.length > 0 && (
          <div
            className="absolute left-3 right-3 bottom-full mb-1 rounded-lg border overflow-hidden shadow-lg"
            style={{ background: "var(--v2-surface)", borderColor: "var(--v2-border)" }}
          >
            {mentionCandidates.slice(0, 6).map((u, i) => (
              <button
                key={u.uid}
                onMouseDown={(e) => { e.preventDefault(); selectMention(u.userName); }}
                className="w-full text-left px-3 py-1.5 text-sm transition-colors"
                style={{
                  background: i === mentionIdx ? "var(--v2-hover)" : "transparent",
                  color: "var(--v2-text)",
                }}
                onMouseEnter={() => setMentionIdx(i)}
              >
                <span className="font-medium" style={{ color: "var(--v2-accent)" }}>@</span>
                {u.userName}
              </button>
            ))}
          </div>
        )}

        <div className="flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={input}
            maxLength={MAX_LENGTH}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            placeholder={t("chatPanel.typeMessage")}
            className="flex-1 rounded px-3 py-1.5 text-sm border outline-none transition-colors"
            style={{
              background: "var(--v2-hover)",
              borderColor: "var(--v2-border)",
              color: "var(--v2-text)",
            }}
            onFocus={(e) => (e.currentTarget.style.borderColor = "var(--v2-accent)")}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = "var(--v2-border)";
              setTimeout(() => setMentionQuery(null), 150);
            }}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim()}
            className="px-3 py-1.5 rounded text-sm flex items-center gap-1 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ background: "var(--v2-accent)", color: "var(--v2-accent-fg)" }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "var(--v2-accent-hover)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "var(--v2-accent)")}
          >
            <Send size={14} />
          </button>
        </div>
        {input.length > MAX_LENGTH * 0.8 && (
          <p
            className="text-[10px] text-right"
            style={{ color: input.length >= MAX_LENGTH ? "#f87171" : "var(--v2-muted)" }}
          >
            {t("chatPanel.charsRemaining", { count: MAX_LENGTH - input.length })}
          </p>
        )}
      </div>
    </div>
  );
}
