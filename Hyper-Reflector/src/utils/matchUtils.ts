const MAX_METER_EVENTS = 100

const coerceBooleanFlag = (value: unknown): boolean | undefined => {
    if (typeof value === 'boolean') return value
    if (typeof value === 'number') {
        if (!Number.isFinite(value)) return undefined
        return value !== 0
    }
    if (typeof value === 'string') {
        const normalized = value.trim().toLowerCase()
        if (!normalized.length) return undefined
        return normalized === 'true' || normalized === '1'
    }
    return undefined
}

const coerceNumber = (value: unknown): number | undefined => {
    if (typeof value === 'number' && Number.isFinite(value)) return value
    if (typeof value === 'string') {
        const num = Number(value)
        return Number.isFinite(num) ? num : undefined
    }
    return undefined
}

const coerceString = (value: unknown): string | undefined => {
    if (typeof value === 'string' && value.trim().length) return value.trim()
    if (typeof value === 'number') return String(value)
    return undefined
}

const limitArray = (value: unknown, limit = MAX_METER_EVENTS) => {
    if (!Array.isArray(value)) return []
    const mapped = value
        .map((entry) => coerceNumber(entry))
        .filter((entry): entry is number => typeof entry === 'number')
    if (mapped.length <= limit) return mapped
    return mapped.slice(mapped.length - limit)
}

const unwrapScalar = (value: unknown): unknown => {
    if (Array.isArray(value) && value.length > 0) return value[value.length - 1]
    return value
}

export const buildCondensedMatchPayload = (source: Record<string, unknown>) => {
    const matchUuid = coerceString(unwrapScalar(source['match-uuid']))
    const createdAt = coerceNumber(unwrapScalar(source['created-at'])) ?? Date.now()
    const explicitP1Win = coerceBooleanFlag(unwrapScalar(source['p1-win']))
    const explicitP2Win = coerceBooleanFlag(unwrapScalar(source['p2-win']))

    let resolvedWinner: 'player1' | 'player2'
    if (explicitP1Win === true) {
        resolvedWinner = 'player1'
    } else if (explicitP2Win === true) {
        resolvedWinner = 'player2'
    } else {
        const fallbackWinner =
            coerceString(unwrapScalar(source['winner'])) ||
            (coerceBooleanFlag(unwrapScalar(source['p1-win'])) ? 'player1' : 'player2')
        resolvedWinner = fallbackWinner === 'player2' ? 'player2' : 'player1'
    }

    const p1WinFinal = resolvedWinner === 'player1'
    const p2WinFinal = !p1WinFinal
    const safeNumber = (v: unknown) => coerceNumber(unwrapScalar(v)) ?? 0

    const p1MatchWins = coerceNumber(unwrapScalar(source['p1-match-wins']))
    const p2MatchWins = coerceNumber(unwrapScalar(source['p2-match-wins']))

    return {
        matchUuid,
        createdAt,
        winner: resolvedWinner,
        'p1-win': p1WinFinal,
        'p2-win': p2WinFinal,
        ...(p1MatchWins !== undefined ? { 'p1-match-wins': p1MatchWins } : {}),
        ...(p2MatchWins !== undefined ? { 'p2-match-wins': p2MatchWins } : {}),
        'player1-char': safeNumber(source['player1-char']),
        'player2-char': safeNumber(source['player2-char']),
        'player1-super': safeNumber(source['player1-super']),
        'player2-super': safeNumber(source['player2-super']),
        'p1-total-meter-gained': safeNumber(source['p1-total-meter-gained']),
        'p2-total-meter-gained': safeNumber(source['p2-total-meter-gained']),
        'p1-meter-gained': limitArray(source['p1-meter-gained']),
        'p2-meter-gained': limitArray(source['p2-meter-gained']),
        participants: {
            player1: {
                char: safeNumber(source['player1-char']),
                super: safeNumber(source['player1-super']),
                totalMeter: safeNumber(source['p1-total-meter-gained']),
            },
            player2: {
                char: safeNumber(source['player2-char']),
                super: safeNumber(source['player2-super']),
                totalMeter: safeNumber(source['p2-total-meter-gained']),
            },
        },
        meterSamples: {
            player1: limitArray(source['p1-meter-gained']),
            player2: limitArray(source['p2-meter-gained']),
        },
    }
}
