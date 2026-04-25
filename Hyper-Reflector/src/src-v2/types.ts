export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error'

export type UserTitleData = {
  bgColor: string
  border: string
  color: string
  title: string
}

export type V2User = {
  uid: string
  userName: string
  accountElo: number
  countryCode: string
  userTitle?: UserTitleData
  lastKnownPings: Array<{ id: string; ping: number | string; isUnstable?: boolean }>
  knownAliases: string[]
  userProfilePic: string
  gravEmail: string
  userEmail: string
  isRankQueued: boolean
  isAfk?: boolean
  currentMatchId?: string
  winStreak?: number
  longestWinStreak?: number
}

export type V2Message = {
  id: string
  role: 'user' | 'system' | 'challenge'
  text: string
  timeStamp: number
  userName?: string
  senderUid?: string
  // Challenge-specific
  challengeChallengerId?: string
  challengeOpponentId?: string
  challengeStatus?: 'accepted' | 'declined'
  challengeResponder?: string
  challengeGameName?: string   // ROM key, e.g. 'sfiii3nr1'
}

export type V2Lobby = {
  name: string
  users: number
  isPrivate?: boolean
  gameName?: string   // ROM key stored in lobbyMeta
  ownerUid?: string   // UID of the user who created this lobby
}
