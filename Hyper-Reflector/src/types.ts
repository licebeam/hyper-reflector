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
  lastKnownPings: Array<{ id: string; ping: number | string; isUnstable?: boolean; networkType?: string; source?: 'measured' | 'estimated' }>
  knownAliases: string[]
  userProfilePic: string
  gravEmail: string
  userEmail: string
  isRankQueued: boolean
  isAfk?: boolean
  currentMatchId?: string
  winStreak?: number
  longestWinStreak?: number
  createdAt?: number
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

// ── Tournament ─────────────────────────────────────────────────────────────────

export type TournamentFormat = 'single-elim' | 'double-elim'

export type TournamentStatus =
  | 'registration_open'
  | 'seeding'
  | 'in_progress'
  | 'paused'
  | 'completed'
  | 'cancelled'

export type Tournament = {
  id: string
  name: string
  description: string
  gameName: string | null
  format: TournamentFormat
  organizerUid: string
  maxParticipants: number | null
  status: TournamentStatus
  startDate?: string | null
  timezone?: string | null
  createdAt?: number
  startedAt?: number | null
  completedAt?: number | null
  cancelledAt?: number | null
}

export type TournamentRegistration = {
  id: string   // == uid
  uid: string
  userName: string
  countryCode: string
  accountElo: number
  seed: number | null
  isMock?: boolean
  registeredAt?: number
}

export type TournamentMatchSlot = {
  uid: string | null
  userName: string | null
  isBye: boolean
}

export type TournamentMatch = {
  id: string
  bracketType: 'winners' | 'losers' | 'grand-finals'
  round: number
  matchIndex: number
  slot1: TournamentMatchSlot | null
  slot2: TournamentMatchSlot | null
  winnerUid: string | null
  loserUid: string | null
  status: 'pending' | 'ready' | 'reported' | 'bye'
  nextMatchId: string | null
  nextMatchSlot: 1 | 2 | null
  nextLoserMatchId: string | null
  nextLoserMatchSlot: 1 | 2 | null
}

export type TournamentHistoryEntry = {
  id: string   // == tournamentId
  tournamentName: string
  format: TournamentFormat
  placement: number | null
  note: string | null
  participantCount: number
  completedAt?: number
}
