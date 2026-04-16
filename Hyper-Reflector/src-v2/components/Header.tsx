import { ChevronDown, Swords, User } from "lucide-react";
import type { ConnectionStatus, V2User } from "../types";

const STATUS_DOT: Record<ConnectionStatus, string> = {
  connected: "bg-green-500",
  connecting: "bg-yellow-500 animate-pulse",
  disconnected: "bg-gray-500",
  error: "bg-red-500",
};

const STATUS_LABEL: Record<ConnectionStatus, string> = {
  connected: "Connected",
  connecting: "Connecting...",
  disconnected: "Disconnected",
  error: "Connection error",
};

type HeaderProps = {
  onToggleRankQueued: (isQueue: boolean) => void;
  lobbyId: string;
  status: ConnectionStatus;
  currentUser: V2User | null;
  onViewProfile?: (uid: string) => void;
  onOpenLobbySelector?: () => void;
};

export function Header({
  onToggleRankQueued,
  lobbyId,
  status,
  currentUser,
  onViewProfile,
  onOpenLobbySelector,
}: HeaderProps) {
  const switchTo = (version: string) => {
    localStorage.setItem("appVersion", version);
    window.location.reload();
  };
  const isQueued = currentUser?.isRankQueued ?? false;

  return (
    <header
      className="h-12 flex items-center justify-between px-4 shrink-0 border-b"
      style={{
        background: "var(--v2-surface)",
        borderColor: "var(--v2-border)",
      }}
    >
      <div className="flex items-center gap-3">
        <button
          onClick={onOpenLobbySelector}
          className="flex items-center gap-1 rounded px-1.5 py-0.5 transition-colors"
          style={{ color: "var(--v2-accent)" }}
          onMouseEnter={(e) =>
            (e.currentTarget.style.background = "var(--v2-hover)")
          }
          onMouseLeave={(e) =>
            (e.currentTarget.style.background = "transparent")
          }
          title="Switch lobby"
        >
          <span className="font-medium text-sm">{lobbyId}</span>
          <ChevronDown size={13} />
        </button>
        <div className="flex items-center gap-1.5">
          <span className={`w-2 h-2 rounded-full ${STATUS_DOT[status]}`} />
          <span className="text-xs" style={{ color: "var(--v2-muted)" }}>
            {STATUS_LABEL[status]}
          </span>
        </div>
      </div>

      <button
        onClick={(e) => {
          e.stopPropagation();
          onToggleRankQueued(!isQueued);
        }}
        className="flex items-center gap-1 text-[20px] px-2 py-0.5 rounded font-medium transition-colors"
        style={{
          background: "var(--v2-accent)",
          color: "var(--v2-accent-fg)",
          cursor: "pointer",
        }}
        onMouseEnter={(e) =>
          (e.currentTarget.style.background = "var(--v2-accent-hover)")
        }
        onMouseLeave={(e) =>
          (e.currentTarget.style.background = "var(--v2-accent)")
        }
      >
        <Swords size={16} /> {isQueued ? "Searching..." : "Ranked Queue"}
      </button>

      <div className="flex items-center gap-3">
        {currentUser && (
          <span className="text-sm" style={{ color: "var(--v2-text)" }}>
            {currentUser.uid && (
              <button
                onClick={() => onViewProfile(currentUser.uid)}
                className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded transition-colors"
                style={{
                  background: "var(--v2-accent)",
                  color: "var(--v2-accent-fg)",
                }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.background = "var(--v2-accent-hover)")
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.background = "var(--v2-accent)")
                }
              >
                <User size={14} /> My Profile
              </button>
            )}
          </span>
        )}
        <div
          className="flex rounded overflow-hidden text-xs font-medium border"
          style={{ borderColor: "var(--v2-border)" }}
        >
          <button
            className="px-2.5 py-1 transition-colors"
            style={{ background: "var(--v2-hover)", color: "var(--v2-muted)" }}
            onClick={() => switchTo("v1")}
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
      </div>
    </header>
  );
}
