export const formatTimestamp = (timestamp?: number): string => {
    if (!timestamp) {
        return ''
    }

    try {
        const date = new Date(timestamp)
        return `${date.toLocaleDateString()} ${date.toLocaleTimeString()}`
    } catch {
        return ''
    }
}

