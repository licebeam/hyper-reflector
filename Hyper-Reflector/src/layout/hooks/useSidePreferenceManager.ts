import { useCallback } from "react";
import { useUserStore } from "../../state/store";
import type { TUser } from "../../types/user";

type SidePreferenceEntry = {
  side: "player1" | "player2";
  ownerUid: string;
  opponentUid: string;
  expiresAt: number;
};

export function useSidePreferenceManager() {
  const applySidePreferenceLocally = useCallback(
    (entry: SidePreferenceEntry | null, opponentUid: string) => {
      const store = useUserStore.getState();
      const viewer = store.globalUser;
      if (!viewer) return;
      const nextPreferences = { ...(viewer.sidePreferences || {}) };
      if (!entry) {
        delete nextPreferences[opponentUid];
      } else {
        nextPreferences[opponentUid] = entry;
      }
      store.setGlobalUser({ ...viewer, sidePreferences: nextPreferences });
    },
    []
  );

  const resolveActiveSidePreference = useCallback(
    (viewer: TUser | undefined, opponentUid: string) => {
      if (!viewer?.sidePreferences) return undefined;
      const entry = viewer.sidePreferences[opponentUid];
      if (!entry) return undefined;
      if (entry.expiresAt <= Date.now()) {
        applySidePreferenceLocally(null, opponentUid);
        return undefined;
      }
      return entry;
    },
    [applySidePreferenceLocally]
  );

  const resolvePreferredSlot = useCallback(
    (viewer: TUser | undefined, opponentUid: string): 0 | 1 | null => {
      const entry = resolveActiveSidePreference(viewer, opponentUid);
      if (!entry) return null;
      return entry.side === "player2" ? 1 : 0;
    },
    [resolveActiveSidePreference]
  );

  return {
    applySidePreferenceLocally,
    resolveActiveSidePreference,
    resolvePreferredSlot,
  };
}
