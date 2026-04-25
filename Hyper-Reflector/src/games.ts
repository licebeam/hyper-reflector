export type GameEntry = {
  rom: string
  name: string
}

export const GAMES: GameEntry[] = [
  { rom: 'sfiii3nr1', name: 'Street Fighter III 3rd Strike' },
  { rom: 'vsavj', name: 'Vampire Savior' },
  { rom: 'ssf2xjr1', name: 'Super Street Fighter II X (ST)' },
  { rom: 'sfa2', name: 'Street Fighter Alpha 2' },
  { rom: 'sfa3', name: 'Street Fighter Alpha 3' },
  { rom: 'umk3', name: 'Ultimate Mortal Kombat 3' },
  { rom: 'kof98', name: "The King of Fighters'98" },
  { rom: 'turfmast', name: 'Neo Turf Masters' },
]

export const DEFAULT_GAME_ROM = 'sfiii3nr1'

/** Look up display name from a ROM key. Falls back to the ROM key itself. */
export function getGameName(rom: string | undefined | null): string {
  if (!rom) return GAMES[0].name
  return GAMES.find(g => g.rom === rom)?.name ?? rom
}
