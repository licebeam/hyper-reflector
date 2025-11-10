export type TUserTitle = {
    bgColor: string
    border: string
    color: string
    title: string
}

export type TUser = {
    accountElo: number
    countryCode: string
    gravEmail: string
    knownAliases: string[]
    pingLat?: number | null
    pingLon?: number | null
    lastKnownPings?: Array<{ id: string; ping: number | string; isUnstable?: boolean; countryCode?: string }>
    stability?: boolean
    ip?: string
    ping?: number
    uid: string
    userEmail: string // should remove
    userName: string
    userProfilePic: string
    userTitle: TUserTitle
    winstreak: number
}
