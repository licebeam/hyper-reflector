import { rmSync, existsSync } from 'fs'
import { join } from 'path'
import os from 'os'

const identifiers = ['com.dusti.hyper-reflector', 'hyper-reflector']

const home = os.homedir()

const platformPaths = (() => {
    switch (process.platform) {
        case 'win32':
            return identifiers.flatMap((id) => [
                join(home, 'AppData', 'Roaming', id),
                join(home, 'AppData', 'Local', id),
            ])
        case 'darwin':
            return identifiers.map((id) =>
                join(home, 'Library', 'Application Support', id)
            )
        case 'linux':
            return identifiers.map((id) => join(home, '.config', id))
        default:
            return []
    }
})()

if (!platformPaths.length) {
    console.warn(`Unsupported platform: ${process.platform}`)
    process.exit(0)
}

let removedAny = false

for (const dir of platformPaths) {
    if (existsSync(dir)) {
        try {
            rmSync(dir, { recursive: true, force: true })
            console.log(`Cleared Tauri store at ${dir}`)
            removedAny = true
        } catch (err) {
            console.warn(`Failed to clear ${dir}:`, err)
        }
    }
}

if (!removedAny) {
    console.log('No Tauri store directories found to remove.')
}
