"use client"

import {
  Toaster as ChakraToaster,
  Portal,
  Spinner,
  Stack,
  Toast,
  createToaster,
} from "@chakra-ui/react";
import { useSettingsStore } from "../../../state/store";

const baseToaster = createToaster({
  placement: "bottom-end",
  pauseOnPageIdle: true,
});

const shouldMuteNotifications = () =>
  useSettingsStore.getState().notificationsMuted;

const interceptedMethods = new Set([
  "create",
  "error",
  "success",
  "info",
  "warning",
  "loading",
  "promise",
]);

export const toaster = new Proxy(baseToaster, {
  get(target, prop, receiver) {
    const value = Reflect.get(target, prop, receiver);
    if (
      typeof prop === "string" &&
      interceptedMethods.has(prop) &&
      typeof value === "function"
    ) {
      return (...args: unknown[]) => {
        if (shouldMuteNotifications()) {
          return undefined;
        }
        return (value as (...fnArgs: unknown[]) => unknown).apply(
          target,
          args
        );
      };
    }
    return value;
  },
}) as typeof baseToaster;

export const Toaster = () => {
  return (
    <Portal>
      <ChakraToaster toaster={toaster} insetInline={{ mdDown: "4" }}>
        {(toast) => (
          <Toast.Root width={{ md: "sm" }}>
            {toast.type === "loading" ? (
              <Spinner size="sm" color="blue.solid" />
            ) : (
              <Toast.Indicator />
            )}
            <Stack gap="1" flex="1" maxWidth="100%">
              {toast.title && <Toast.Title>{toast.title}</Toast.Title>}
              {toast.description && (
                <Toast.Description>{toast.description}</Toast.Description>
              )}
            </Stack>
            {toast.action && (
              <Toast.ActionTrigger>{toast.action.label}</Toast.ActionTrigger>
            )}
            {toast.meta?.closable && <Toast.CloseTrigger />}
          </Toast.Root>
        )}
      </ChakraToaster>
    </Portal>
  );
};
