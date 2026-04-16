import { useEffect, useRef, useState } from "react";
import { Send, Swords, Check, X } from "lucide-react";
import type { V2Message } from "../types";

const MAX_LENGTH = 120;

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
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
        <span className="text-xs ml-2" style={{ color: "var(--v2-muted)" }}>
          {formatTime(msg.timeStamp)}
        </span>

        {isResolved ? (
          <div className="mt-1">
            <span
              className="text-[10px] font-medium px-1.5 py-0.5 rounded"
              style={{
                background: msg.challengeStatus === "accepted" ? "#34d39922" : "#f8717122",
                color: msg.challengeStatus === "accepted" ? "#34d399" : "#f87171",
              }}
            >
              {msg.challengeStatus === "accepted" ? "Accepted" : "Declined"}
              {msg.challengeResponder ? ` by ${msg.challengeResponder}` : ""}
            </span>
          </div>
        ) : isRecipient ? (
          <div className="flex gap-1.5 mt-1.5">
            <button
              onClick={() => onAccept(msg.id)}
              className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded font-medium transition-colors"
              style={{ background: "#34d399", color: "#000" }}
            >
              <Check size={10} /> Accept
            </button>
            <button
              onClick={() => onDecline(msg.id)}
              className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded font-medium transition-colors"
              style={{ background: "var(--v2-hover)", color: "var(--v2-muted)", border: "1px solid var(--v2-border)" }}
            >
              <X size={10} /> Decline
            </button>
          </div>
        ) : (
          <div className="mt-1">
            <span className="text-[10px] animate-pulse" style={{ color: "var(--v2-muted)" }}>
              Waiting for response…
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main panel ─────────────────────────────────────────────────────────────────

type ChatPanelProps = {
  messages: V2Message[];
  currentUserUid?: string;
  onSend: (text: string) => boolean;
  onAcceptChallenge?: (messageId: string) => void;
  onDeclineChallenge?: (messageId: string) => void;
};

export function ChatPanel({
  messages,
  currentUserUid,
  onSend,
  onAcceptChallenge,
  onDeclineChallenge,
}: ChatPanelProps) {
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = () => {
    const text = input.trim();
    if (!text) return;
    if (onSend(text)) setInput("");
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Messages */}
      <div className="flex-1 p-3 space-y-1.5 min-h-0 overflow-y-scroll">
        {messages.length === 0 && (
          <p className="text-sm text-center pt-8" style={{ color: "var(--v2-muted)" }}>
            No messages yet. Say hello!
          </p>
        )}

        {messages.map((msg) => (
          <div key={msg.id}>
            {msg.role === "user" && (
              <span>
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
                <span className="text-sm ml-2" style={{ color: "var(--v2-chat-msg)" }}>
                  {msg.text}
                </span>
              </span>
            )}

            {msg.role === "system" && (
              <span className="text-xs italic" style={{ color: "var(--v2-muted)" }}>
                {msg.text}
              </span>
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
        className="border-t p-3 flex gap-2 shrink-0"
        style={{ borderColor: "var(--v2-border)" }}
      >
        <input
          type="text"
          value={input}
          maxLength={MAX_LENGTH}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type a message..."
          className="flex-1 rounded px-3 py-1.5 text-sm border outline-none transition-colors"
          style={{
            background: "var(--v2-hover)",
            borderColor: "var(--v2-border)",
            color: "var(--v2-text)",
          }}
          onFocus={(e) => (e.currentTarget.style.borderColor = "var(--v2-accent)")}
          onBlur={(e) => (e.currentTarget.style.borderColor = "var(--v2-border)")}
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
    </div>
  );
}
