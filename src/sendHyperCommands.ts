import { app } from 'electron'
const fs = require('fs')
const path = require('path')

const isDev = !app.isPackaged

let filePathBase = process.resourcesPath
//handle dev mode toggle for file paths.
if (isDev) {
    filePathBase = path.join(app.getAppPath(), 'src')
}

export function sendCommand(command: string = 'dummy') {
    try {
        const filePath = path.join(filePathBase, 'hyper_write_commands.txt')
        console.log('writing to: ', filePath)
        fs.writeFileSync(filePath, command, { encoding: 'utf8' })
        console.log(`Command written: ${command}`)
    } catch (error) {
        console.error('Failed to write file:', error)
    }
}

export async function readCommand() {
    try {
        const filePath = path.join(filePathBase, 'hyper_read_commands.txt')
        const data = fs.readFileSync(filePath, { encoding: 'utf8' })
        if (data.length) {
            console.log('file read ', data)
            // if its for uploading stats then we clear the stat file
            if (data === 'read-tracking-file') {
                const matchData = await readStatFile(null)
                    .then()
                    .catch((err) => console.log(err))
                clearStatFile()
                clearReadCommandFile()
                return matchData
            }
        }
        clearReadCommandFile()
    } catch (error) {
        console.error('Failed to read file:', error)
    }
}

export async function readStatFile(mainWindow: any) {
    try {
        const filePath = path.join(filePathBase, 'hyper_track_match.txt')
        const data = await fs.readFileSync(filePath, { encoding: 'utf8' })
        console.log('file read ', data)
        if (mainWindow) {
            mainWindow.webContents.send('stats-from-main', data)
        }
        return data
    } catch (error) {
        console.error('Failed to read file:', error)
    }
}

// We can use this function to clear the stat file after a match
// Before we clear stats we should send this off to the backend for testing
export function clearStatFile() {
    try {
        const filePath = path.join(filePathBase, 'hyper_track_match.txt')
        fs.writeFileSync(filePath, '', { encoding: 'utf8' })
    } catch (error) {
        console.error('Failed to clear file:', error)
    }
}

export function clearReadCommandFile() {
    try {
        const filePath = path.join(filePathBase, 'hyper_read_commands.txt')
        fs.writeFileSync(filePath, '', { encoding: 'utf8' })
    } catch (error) {
        console.error('Failed to clear file:', error)
    }
}
