import type { SignalStatus } from '../../state/store'

export const STATUS_COLOR_MAP: Record<SignalStatus, string> = {
    connected: 'green.400',
    connecting: 'yellow.400',
    error: 'red.400',
    disconnected: 'gray.400',
}

export const STATUS_LABEL_MAP: Record<SignalStatus, string> = {
    connected: 'WS Connected',
    connecting: 'WS Connecting...',
    error: 'WS Error',
    disconnected: 'WS Offline',
}

