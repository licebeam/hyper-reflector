import type { TMessage } from "../state/store";

export type NotificationEntry = {
  message: TMessage;
  kind: "challenge" | "mention";
};
