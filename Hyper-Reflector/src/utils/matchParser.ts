export type ParsedMatchData = Record<string, unknown>

export function parseMatchData(rawData?: string | null): ParsedMatchData | null {
    if (!rawData || !rawData.trim().length) {
        return null
    }

    try {
        const parsed = JSON.parse(rawData)
        if (parsed && typeof parsed === 'object') {
            return parsed as ParsedMatchData
        }
    } catch (error) {
        console.warn('Failed to parse match JSON, falling back to legacy parser', error)
    }

    const result: Record<string, unknown> = {}
    const lines = rawData
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line.length > 0)

    for (const line of lines) {
        const [rawKey, rawValue = ''] = line.split(':')
        if (!rawKey?.length) continue
        const key = rawKey.trim()
        const trimmedValue = rawValue.trim()
        const numericValue = Number(trimmedValue)
        const parsedValue = Number.isNaN(numericValue) ? trimmedValue : numericValue

        if (Object.prototype.hasOwnProperty.call(result, key)) {
            const existing = result[key] as unknown
            if (Array.isArray(existing)) {
                existing.push(parsedValue)
            } else {
                result[key] = [existing, parsedValue]
            }
        } else {
            result[key] = parsedValue
        }
    }

    return result
}

export function getCharacterByCode(characterCode?: unknown) {
    const code =
        typeof characterCode === 'number'
            ? characterCode
            : characterCode === undefined || characterCode === null
              ? Number.NaN
              : Number(characterCode)
    switch (code) {
        case 1:
            return 'Alex'
        case 2:
            return 'Ryu'
        case 3:
            return 'Yun'
        case 4:
            return 'Dudley'
        case 5:
            return 'Necro'
        case 6:
            return 'Hugo'
        case 7:
            return 'Ibuki'
        case 8:
            return 'Elena'
        case 9:
            return 'Oro'
        case 10:
            return 'Yang'
        case 11:
            return 'Ken'
        case 12:
            return 'Sean'
        case 13:
            return 'Urien'
        case 14:
            return 'Gouki'
        case 16:
            return 'Chun-Li'
        case 17:
            return 'Makoto'
        case 18:
            return 'Q'
        case 19:
            return 'Twelve'
        case 20:
            return 'Remy'
        default:
            return 'Remy'
    }
}
