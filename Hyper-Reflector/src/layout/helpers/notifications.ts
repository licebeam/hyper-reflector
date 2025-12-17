import type { NotificationEntry } from "../types";
import type { TMessage } from "../../state/store";

type BuildNotificationParams = {
  chatMessages?: TMessage[];
  dismissedIds: Set<string>;
  mutedUsers: string[];
  mentionMatchers: RegExp[];
};

export const buildNotificationEntries = ({
  chatMessages,
  dismissedIds,
  mutedUsers,
  mentionMatchers,
}: BuildNotificationParams): NotificationEntry[] => {
  if (!Array.isArray(chatMessages)) return [];

  const entries: NotificationEntry[] = [];
  chatMessages.forEach((msg) => {
    if (!msg?.id || dismissedIds.has(msg.id)) {
      return;
    }

    const senderId =
      msg.senderUid ||
      msg.challengeChallengerId ||
      (typeof (msg as any).senderId === "string"
        ? (msg as any).senderId
        : undefined);

    if (senderId && mutedUsers.includes(senderId)) {
      return;
    }

    if (msg.role === "challenge") {
      entries.push({ message: msg, kind: "challenge" });
      return;
    }

    if (!msg.text || !mentionMatchers.length) {
      return;
    }

    const text = msg.text ?? "";
    const hasMention = mentionMatchers.some((matcher) => {
      matcher.lastIndex = 0;
      return matcher.test(text);
    });

    if (hasMention) {
      entries.push({ message: msg, kind: "mention" });
    }
  });

  return entries.sort((a, b) => {
    const aTime = a.message.timeStamp ?? 0;
    const bTime = b.message.timeStamp ?? 0;
    return bTime - aTime;
  });
};

export const extractChallengeTargets = (
  notificationEntries: NotificationEntry[]
): string[] =>
  notificationEntries
    .filter((entry) => entry.kind === "challenge")
    .map((entry) => {
      const sender = (entry.message as any).sender || {};
      return (
        entry.message.challengeChallengerId ||
        sender.uid ||
        sender.userUID ||
        sender.id ||
        null
      );
    })
    .filter(
      (uid): uid is string => typeof uid === "string" && uid.length > 0
    );
