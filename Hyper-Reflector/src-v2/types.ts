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
  lastKnownPings: Array<{ id: string; ping: number | string }>
  knownAliases: string[]
  userProfilePic: string
  gravEmail: string
  userEmail: string
}

export type V2Message = {
  id: string
  role: 'user' | 'system'
  text: string
  timeStamp: number
  userName?: string
  senderUid?: string
}
