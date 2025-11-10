import type { TUser } from '../types/user'

type PingRecord = { id: string; ping: number | string; isUnstable?: boolean; countryCode?: string }

const toNumber = (value: number | string | undefined): number | null => {
    if (typeof value === 'number') {
        return Number.isFinite(value) ? value : null
    }
    if (typeof value === 'string') {
        const parsed = Number(value)
        return Number.isFinite(parsed) ? parsed : null
    }
    return null
}

const findPingRecord = (
    source: TUser | undefined,
    targetId: string | undefined
): PingRecord | undefined => {
    if (!source || !targetId) return undefined
    const list = Array.isArray(source.lastKnownPings) ? source.lastKnownPings : []
    return list.find((entry) => entry && entry.id === targetId)
}

export const resolvePingBetweenUsers = (
    user: TUser | undefined,
    viewer: TUser | undefined | null
): { ping: number | null; isUnstable?: boolean } => {
    if (!user) {
        return { ping: null }
    }

    if (viewer && viewer.uid && viewer.uid === user.uid) {
        return { ping: 0 }
    }

    const viewerId = viewer?.uid
    let record = viewerId ? findPingRecord(viewer || undefined, user.uid) : undefined

    if (!record && viewerId) {
        record = findPingRecord(user, viewerId)
    }

    if (!record && typeof (user as any).ping === 'number') {
        return { ping: toNumber((user as any).ping) }
    }

    const pingValue = record ? toNumber(record.ping as any) : null
    return { ping: pingValue, isUnstable: record?.isUnstable }
}
