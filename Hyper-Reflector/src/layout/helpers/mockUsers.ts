import type { TUser } from '../../types/user'

export const FALLBACK_USER_TITLE: TUser['userTitle'] = {
    bgColor: '#1f1f24',
    border: '#37373f',
    color: '#f2f2f7',
    title: 'Contender',
}

export const MOCK_CHALLENGE_USER: TUser = {
    uid: 'mock-opponent',
    userName: 'Mock Opponent',
    accountElo: 1625,
    countryCode: 'US',
    gravEmail: '',
    knownAliases: ['TrainingBot', 'MockOpponent'],
    pingLat: 37.7749,
    pingLon: -122.4194,
    userEmail: 'mock@hyper-reflector.test',
    userProfilePic: '',
    userTitle: { ...FALLBACK_USER_TITLE, title: 'Training Partner' },
    winstreak: 0,
    lastKnownPings: [{ id: 'mock-opponent-2', ping: 92 }],
}

export const MOCK_CHALLENGE_USER_TWO: TUser = {
    uid: 'mock-opponent-2',
    userName: 'Mock Challenger',
    accountElo: 1580,
    countryCode: 'JP',
    gravEmail: '',
    knownAliases: ['PracticeBot', 'MockChallenger'],
    pingLat: 35.6762,
    pingLon: 139.6503,
    userEmail: 'mock2@hyper-reflector.test',
    userProfilePic: '',
    userTitle: { ...FALLBACK_USER_TITLE, title: 'Training Rival' },
    winstreak: 0,
    stability: true,
    lastKnownPings: [{ id: 'mock-opponent', ping: 92 }],
}

export const MOCK_CHAT_LINES = [
    'Hey @{player}, ready for a quick set?',
    'I have a new combo to test on you, @{player}.',
    'Your defense is looking sharp @{player}, mind if I poke at it?',
    'Anyone else here? Guess it is you and me @{player}.',
]

export const MOCK_CHALLENGE_LINES = [
    'wants to run a FT3 if you are up for it.',
    'is sending over a challenge request right now.',
    'thinks you owe them a rematch.',
]

export const MOCK_ACTION_INTERVAL_MS = 5000 // every 5 seconds do a random interaction

export const buildMockForLobby = (lobbyId: string, index = 0): TUser | null => {
    const normalized = lobbyId.trim().toLowerCase()
    if (!normalized.length || normalized !== 'debug') return null

    return index % 2 === 0 ? MOCK_CHALLENGE_USER : MOCK_CHALLENGE_USER_TWO
}

export const normalizeSocketUser = (candidate: any): TUser | null => {
    if (!candidate || typeof candidate.uid !== 'string') {
        return null
    }

    const uid = candidate.uid.trim()
    if (!uid.length) {
        return null
    }

    const aliases = Array.isArray(candidate.knownAliases)
        ? candidate.knownAliases
            .map((alias: unknown) => (typeof alias === 'string' ? alias.trim() : ''))
            .filter((alias: string): alias is string => Boolean(alias.length))
        : []

    const titleSource =
        candidate.userTitle && typeof candidate.userTitle === 'object'
            ? candidate.userTitle
            : FALLBACK_USER_TITLE

    const userTitle = {
        bgColor:
            typeof titleSource.bgColor === 'string' && titleSource.bgColor.length
                ? titleSource.bgColor
                : FALLBACK_USER_TITLE.bgColor,
        border:
            typeof titleSource.border === 'string' && titleSource.border.length
                ? titleSource.border
                : FALLBACK_USER_TITLE.border,
        color:
            typeof titleSource.color === 'string' && titleSource.color.length
                ? titleSource.color
                : FALLBACK_USER_TITLE.color,
        title:
            typeof titleSource.title === 'string' && titleSource.title.length
                ? titleSource.title
                : FALLBACK_USER_TITLE.title,
    }

    const lastKnownPings =
        Array.isArray(candidate.lastKnownPings) && candidate.lastKnownPings.length
            ? candidate.lastKnownPings
                  .map((entry: any) => {
                      if (!entry) return null
                      const id =
                          typeof entry.id === 'string'
                              ? entry.id
                              : typeof entry.id === 'number'
                                ? String(entry.id)
                                : undefined
                      if (!id) return null
                      const rawPing = entry.ping
                      const numericPing =
                          typeof rawPing === 'number'
                              ? rawPing
                              : typeof rawPing === 'string'
                                ? Number(rawPing)
                                : undefined
                      return {
                          id,
                          ping:
                              typeof numericPing === 'number' && Number.isFinite(numericPing)
                                  ? numericPing
                                  : rawPing ?? 0,
                          isUnstable: Boolean(entry.isUnstable),
                          countryCode:
                              typeof entry.countryCode === 'string' ? entry.countryCode : undefined,
                      }
                  })
                  .filter(
                      (
                          entry
                      ): entry is {
                          id: string
                          ping: number | string
                          isUnstable?: boolean
                          countryCode?: string
                      } => Boolean(entry)
                  )
            : undefined

    const resolvedUser: TUser = {
        uid,
        userName:
            typeof candidate.userName === 'string' && candidate.userName.trim().length
                ? candidate.userName.trim()
                : uid,
        accountElo:
            typeof candidate.accountElo === 'number' && Number.isFinite(candidate.accountElo)
                ? candidate.accountElo
                : 0,
        countryCode:
            typeof candidate.countryCode === 'string' && candidate.countryCode.trim().length
                ? candidate.countryCode.trim().toUpperCase()
                : 'XX',
        gravEmail:
            typeof candidate.gravEmail === 'string'
                ? candidate.gravEmail
                : typeof candidate.email === 'string'
                    ? candidate.email
                    : '',
        knownAliases: aliases,
        pingLat: typeof candidate.pingLat === 'number' ? candidate.pingLat : undefined,
        pingLon: typeof candidate.pingLon === 'number' ? candidate.pingLon : undefined,
        ping:
            typeof candidate.ping === 'number'
                ? candidate.ping
                : typeof candidate.ping === 'string'
                  ? Number(candidate.ping) || undefined
                  : undefined,
        stability:
            typeof candidate.stability === 'boolean' ? candidate.stability : undefined,
        ip: typeof candidate.ip === 'string' ? candidate.ip : undefined,
        userEmail:
            typeof candidate.userEmail === 'string'
                ? candidate.userEmail
                : typeof candidate.email === 'string'
                    ? candidate.email
                    : '',
        userProfilePic:
            typeof candidate.userProfilePic === 'string' ? candidate.userProfilePic : '',
        userTitle,
        winstreak:
            typeof candidate.winstreak === 'number'
                ? candidate.winstreak
                : typeof candidate.winStreak === 'number'
                    ? candidate.winStreak
                    : 0,
    }

    if (lastKnownPings) {
        resolvedUser.lastKnownPings = lastKnownPings
    }

    return resolvedUser
}

export const appendMockUsers = (
    users: TUser[],
    lobbyId: string,
    viewer?: TUser | null
): { users: TUser[]; viewer?: TUser } => {
    if (!lobbyId || lobbyId.toLowerCase() !== 'debug') {
        return { users, viewer: viewer || undefined }
    }

    const candidateUsers = [MOCK_CHALLENGE_USER, MOCK_CHALLENGE_USER_TWO]
    const expanded = [...users]
    const existingIds = new Set(expanded.map((user) => user.uid))

    let viewerSnapshot = viewer ? { ...viewer } : undefined
    if (viewerSnapshot) {
        viewerSnapshot.lastKnownPings = Array.isArray(viewerSnapshot.lastKnownPings)
            ? viewerSnapshot.lastKnownPings.filter((entry) =>
                  candidateUsers.every((mock) => mock.uid !== entry.id)
              )
            : []
    }

    candidateUsers.forEach((mock, index) => {
        const pingValue = index === 0 ? 46 : 128
        const isUnstable = index === 1

        const mockClone: TUser = {
            ...mock,
            ping: pingValue,
            lastKnownPings: viewer?.uid
                ? [
                      ...(Array.isArray(mock.lastKnownPings) ? mock.lastKnownPings : []),
                      {
                          id: viewer.uid,
                          ping: pingValue,
                          isUnstable,
                          countryCode: viewer.countryCode,
                      },
                  ]
                : mock.lastKnownPings,
        }

        if (!existingIds.has(mock.uid)) {
            expanded.push(mockClone)
            existingIds.add(mock.uid)
        } else {
            const idx = expanded.findIndex((user) => user.uid === mock.uid)
            if (idx >= 0) {
                expanded[idx] = {
                    ...expanded[idx],
                    ping: pingValue,
                    lastKnownPings: mockClone.lastKnownPings,
                }
            }
        }

        if (viewerSnapshot?.uid) {
            const existingRecords = Array.isArray(viewerSnapshot.lastKnownPings)
                ? viewerSnapshot.lastKnownPings.filter((entry) => entry.id !== mock.uid)
                : []
            viewerSnapshot = {
                ...viewerSnapshot,
                lastKnownPings: [
                    ...existingRecords,
                    { id: mock.uid, ping: pingValue, isUnstable, countryCode: mock.countryCode },
                ],
            }
        }
    })

    return { users: expanded, viewer: viewerSnapshot }
}
