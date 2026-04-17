import { Plus, Swords, User, X } from "lucide-react";
import { GAMES, getGameName } from "../games";
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  restrictToHorizontalAxis,
  restrictToParentElement,
} from "@dnd-kit/modifiers";
import {
  SortableContext,
  horizontalListSortingStrategy,
  arrayMove,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { ConnectionStatus, V2User } from "../types";

const DEFAULT_LOBBY_ID = "Hyper Reflector";
const MAX_SUBSCRIPTIONS = 5;

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
  error: "Error",
};

// ── Single sortable tab ───────────────────────────────────────────────────────

type SortableTabProps = {
  lobbyId: string;
  isActive: boolean;
  onSelect: () => void;
  onClose: () => void;
};

function SortableTab({
  lobbyId,
  isActive,
  onSelect,
  onClose,
}: SortableTabProps) {
  const isDefault = lobbyId === DEFAULT_LOBBY_ID;

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: lobbyId });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    background: isDragging
      ? "var(--v2-hover)"
      : isActive
        ? "var(--v2-hover)"
        : "color-mix(in srgb, var(--v2-surface) 60%, transparent)",
    color: isActive || isDragging ? "var(--v2-text)" : "var(--v2-muted)",
    borderTop: isActive
      ? "2px solid var(--v2-accent)"
      : "2px solid var(--v2-border)",
    borderLeft: "1px solid var(--v2-border)",
    borderRight: "1px solid var(--v2-border)",
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 10 : undefined,
    cursor: isDragging ? "grabbing" : "grab",
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="group relative flex items-center justify-between gap-1 w-28 shrink-0 px-2.5 h-8.5 rounded-t-md text-xs select-none"
      title={lobbyId}
      onClick={onSelect}
    >
      <span className="truncate min-w-0 text-left pointer-events-none">
        {lobbyId}
      </span>
      {!isDefault && (
        <span
          role="button"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
          className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity rounded p-0.5 -mr-0.5"
          style={{ color: "var(--v2-muted)" }}
          onMouseEnter={(e) => (e.currentTarget.style.color = "#f87171")}
          onMouseLeave={(e) =>
            (e.currentTarget.style.color = "var(--v2-muted)")
          }
          title={`Leave ${lobbyId}`}
        >
          <X size={10} />
        </span>
      )}
    </div>
  );
}

// ── Header ────────────────────────────────────────────────────────────────────

type HeaderProps = {
  onToggleRankQueued: (isQueue: boolean) => void;
  subscribedLobbyIds: string[];
  activeLobbyId: string;
  onSelectLobby: (id: string) => void;
  onCloseLobby: (id: string) => void;
  onAddLobby: () => void;
  onReorderLobbies: (ids: string[]) => void;
  status: ConnectionStatus;
  currentUser: V2User | null;
  onViewProfile?: (uid: string) => void;
  activeLobbyGame?: string;
  activeLobbyOwnerUid?: string;
  onUpdateLobbyGame: (lobbyId: string, gameName: string) => void;
};

export function Header({
  onToggleRankQueued,
  subscribedLobbyIds,
  activeLobbyId,
  onSelectLobby,
  onCloseLobby,
  onAddLobby,
  onReorderLobbies,
  status,
  currentUser,
  onViewProfile,
  activeLobbyGame,
  activeLobbyOwnerUid,
  onUpdateLobbyGame,
}: HeaderProps) {
  const switchTo = (version: string) => {
    localStorage.setItem("appVersion", version);
    window.location.reload();
  };
  const isQueued = currentUser?.isRankQueued ?? false;

  const sensors = useSensors(
    useSensor(PointerSensor, {
      // Require a 5px move before a drag starts so normal clicks still work
      activationConstraint: { distance: 5 },
    }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIdx = subscribedLobbyIds.indexOf(String(active.id));
    const newIdx = subscribedLobbyIds.indexOf(String(over.id));
    if (oldIdx === -1 || newIdx === -1) return;
    onReorderLobbies(arrayMove(subscribedLobbyIds, oldIdx, newIdx));
  };

  return (
    <header
      className="h-12 flex items-stretch shrink-0 border-b"
      style={{
        background: "var(--v2-surface)",
        borderColor: "var(--v2-border)",
      }}
    >
      {/* ── Left: Lobby folder tabs ── */}
      <div className="flex items-end overflow-x-auto scrollbar-none flex-1 min-w-0 px-2 gap-1 pt-1.5">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          modifiers={[restrictToHorizontalAxis, restrictToParentElement]}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={subscribedLobbyIds}
            strategy={horizontalListSortingStrategy}
          >
            {subscribedLobbyIds.map((lobbyId) => (
              <SortableTab
                key={lobbyId}
                lobbyId={lobbyId}
                isActive={lobbyId === activeLobbyId}
                onSelect={() => onSelectLobby(lobbyId)}
                onClose={() => onCloseLobby(lobbyId)}
              />
            ))}
          </SortableContext>
        </DndContext>

        {subscribedLobbyIds.length < MAX_SUBSCRIPTIONS && (
          <button
            onClick={onAddLobby}
            className="flex items-center justify-center w-7 h-8.5 shrink-0 rounded-t-md text-xs transition-colors"
            style={{
              color: "var(--v2-muted)",
              border: "1px dashed var(--v2-border)",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = "var(--v2-text)";
              e.currentTarget.style.borderColor = "var(--v2-accent)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = "var(--v2-muted)";
              e.currentTarget.style.borderColor = "var(--v2-border)";
            }}
            title="Join another lobby"
          >
            <Plus size={12} />
          </button>
        )}
      </div>

      {/* ── Center: Game selector + Ranked Queue ── */}
      <div className="flex items-center gap-2 px-4 shrink-0">
        {/* Game selector — only visible to the lobby owner */}
        {/* {currentUser?.uid && currentUser.uid === activeLobbyOwnerUid ? (
          <select
            value={activeLobbyGame ?? GAMES[0].rom}
            onChange={(e) => onUpdateLobbyGame(activeLobbyId, e.target.value)}
            className="text-xs px-2 py-1.5 rounded border outline-none transition-colors"
            style={{
              background: "var(--v2-hover)",
              borderColor: "var(--v2-border)",
              color: "var(--v2-text)",
            }}
            onFocus={(e) => (e.currentTarget.style.borderColor = "var(--v2-accent)")}
            onBlur={(e) => (e.currentTarget.style.borderColor = "var(--v2-border)")}
            title="Set game for this lobby"
          >
            {GAMES.map((g) => (
              <option key={g.rom} value={g.rom} style={{ background: "var(--v2-surface)" }}>
                {g.name}
              </option>
            ))}
          </select>
        ) : activeLobbyGame ? (
          <span
            className="text-xs px-2 py-1 rounded"
            style={{
              background: "color-mix(in srgb, var(--v2-accent) 12%, transparent)",
              color: "var(--v2-accent)",
              border: "1px solid color-mix(in srgb, var(--v2-accent) 25%, transparent)",
            }}
          >
            {getGameName(activeLobbyGame)}
          </span>
        ) : null} */}

        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleRankQueued(!isQueued);
          }}
          className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded font-medium transition-colors whitespace-nowrap"
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
          <Swords size={13} />
          {isQueued ? "Searching..." : "Ranked Queue"}
        </button>
      </div>

      {/* ── Right: Status + Profile + Version ── */}
      <div className="flex items-center gap-3 px-4 shrink-0">
        <div className="flex items-center gap-1.5">
          <span className={`w-2 h-2 rounded-full ${STATUS_DOT[status]}`} />
          <span className="text-xs" style={{ color: "var(--v2-muted)" }}>
            {STATUS_LABEL[status]}
          </span>
        </div>

        {currentUser?.uid && (
          <button
            onClick={() => onViewProfile?.(currentUser.uid)}
            className="flex items-center gap-1 text-xs px-2 py-1 rounded transition-colors whitespace-nowrap"
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
            <User size={13} />
            Profile
          </button>
        )}

        <div
          className="flex rounded overflow-hidden text-xs font-medium border"
          style={{ borderColor: "var(--v2-border)" }}
        >
          <button
            className="px-2 py-1 transition-colors"
            style={{ background: "var(--v2-hover)", color: "var(--v2-muted)" }}
            onClick={() => switchTo("v1")}
          >
            V1
          </button>
          <span
            className="px-2 py-1"
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
