export type GameEntry = {
  rom: string
  name: string
}

export const GAMES: GameEntry[] = [
  { rom: 'sfiii3nr1', name: '3rd Strike' },
  { rom: 'vsavj', name: 'Vampire Savior' },
]

export const DEFAULT_GAME_ROM = 'sfiii3nr1'

/** Look up display name from a ROM key. Falls back to the ROM key itself. */
export function getGameName(rom: string | undefined | null): string {
  if (!rom) return GAMES[0].name
  return GAMES.find(g => g.rom === rom)?.name ?? rom
}
