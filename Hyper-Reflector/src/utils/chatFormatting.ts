const HTML_ESCAPE_LOOKUP: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
}

const DEFAULT_MENTION_REGEX = /(^|\s)(@[^\s!?,.:;]+)/g

export function escapeRegExp(value: string) {
    return value.replace(/[|\\{}()[\]^$+*?.-]/g, '\\$&')
}

export function escapeHtml(value: string) {
    return value.replace(/[&<>"']/g, (char) => HTML_ESCAPE_LOOKUP[char])
}

export function buildMentionRegexes(handles: string[], flags = 'i') {
    if (!handles.length) return []
    return handles.map((handle) => {
        const escaped = escapeRegExp(handle.toLowerCase())
        return new RegExp(`(^|\\s)(@${escaped})(?=$|\\s|[!?,.:;])`, flags)
    })
}

export function highlightMentions(text: string, handles?: string[]) {
    const safe = escapeHtml(text)

    let withHighlights = safe

    if (handles && handles.length) {
        const regexes = buildMentionRegexes(handles, 'gi')
        withHighlights = regexes.reduce((acc, regex) => {
            regex.lastIndex = 0
            return acc.replace(regex, (match, prefix, mention) => {
                return `${prefix}<span class="mention-highlight">${mention}</span>`
            })
        }, withHighlights)
    }

    withHighlights = withHighlights.replace(DEFAULT_MENTION_REGEX, (match, prefix, mention) => {
        return `${prefix}<span class="mention-highlight">${mention}</span>`
    })

    return withHighlights.replace(/\n/g, '<br />')
}
