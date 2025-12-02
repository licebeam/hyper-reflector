import rockImg from '../assets/images/rock.png'
import paperImg from '../assets/images/paper.png'
import scissorsImg from '../assets/images/scissors.png'
import type { MiniGameChoice, MiniGameOption } from './types'

export const RPS_OPTIONS: MiniGameOption[] = [
    {
        id: 'rock',
        label: 'Rock',
        description: 'Solid and steady. Beats scissors.',
        image: rockImg,
    },
    {
        id: 'paper',
        label: 'Paper',
        description: 'Flexible and adaptive. Beats rock.',
        image: paperImg,
    },
    {
        id: 'scissors',
        label: 'Scissors',
        description: 'Sharp and precise. Beats paper.',
        image: scissorsImg,
    },
]

const BEATS: Record<MiniGameChoice, MiniGameChoice> = {
    rock: 'scissors',
    paper: 'rock',
    scissors: 'paper',
}

export function evaluateRps(
    a: MiniGameChoice | null | undefined,
    b: MiniGameChoice | null | undefined
): 'a' | 'b' | 'draw' {
    if (!a && !b) return 'draw'
    if (a && !b) return 'a'
    if (!a && b) return 'b'
    if (a === b) return 'draw'
    return BEATS[a!] === b ? 'a' : 'b'
}

