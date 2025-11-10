export const SOCKET_STATE_EVENT = 'socket:update-state'

export type SocketStateUpdateDetail = {
    key: string
    value: unknown
}

export function requestSocketStateUpdate(update: SocketStateUpdateDetail) {
    if (typeof window === 'undefined') return
    window.dispatchEvent(new CustomEvent(SOCKET_STATE_EVENT, { detail: update }))
}

export function requestSocketStateBatch(updates: SocketStateUpdateDetail[]) {
    updates.forEach((update) => requestSocketStateUpdate(update))
}
