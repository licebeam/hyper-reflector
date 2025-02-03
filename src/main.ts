import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'node:path';
import started from 'electron-squirrel-startup';
import { sendCommand, readCommand } from './dusty_reader';
import launchGGPO from './loadFbNeo';

// for these file paths like fightcade path and lua path, we need some way to access this directly through electron so we do no need to update all of the time.
const startPlayingOnline = (player: number, remotePort: number, remoteIp: string, delay: number = 0) => {
  const localPort = 7000;
  const fightcadePath = "C:/Users/dusti/Documents/Fightcade/emulator/fbneo/fcadefbneo.exe";
  const luaPath = 'C:/Users/dusti/Documents/3rd_training_lua/dusty_networking/dusty_networking/src/lua/3rd_training_lua/dusty_file_reader.lua'
  const directCommand = `"${fightcadePath}" quark:direct,sfiii3nr1,${localPort},${remoteIp},${remotePort},${player},${delay},0 ${luaPath}`;
  launchGGPO(directCommand)
}

const startSoloMode = () => {
  const fightcadePath = "C:/Users/dusti/Documents/Fightcade/emulator/fbneo/fcadefbneo.exe";
  const luaPath = 'C:/Users/dusti/Documents/3rd_training_lua/dusty_networking/dusty_networking/src/lua/3rd_training_lua/3rd_training.lua'
  const directCommand = `"${fightcadePath}" -game sfiii3nr1 ${luaPath}`;
  launchGGPO(directCommand)
}

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (started) {
  app.quit();
}

const createWindow = () => {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
    },
  });


  // handle ipc calls
  // receives text from front end sends it to emulator
  ipcMain.on("send-text", (event, text: string) => {
    sendCommand(`textinput:${text}`);
    readCommand();
  });

  ipcMain.on("send-command", (event, command) => {
    sendCommand(command);
    readCommand();
  });

  ipcMain.on("startP1", () => {
    startPlayingOnline(0, 7001, "127.0.0.1", 0)
  });

  ipcMain.on("startP2", () => {
    startPlayingOnline(1, 7000, "127.0.0.1", 0)
  });

  ipcMain.on("start-solo-mode", (event) => {
    startSoloMode();
  });

  // and load the index.html of the app.
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`));
  }

  // Open the DevTools.
  mainWindow.webContents.openDevTools();
};

// read files
setInterval(() => {
  readCommand();
}, 1000); // read from reflector.text every 100 ms 

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', createWindow)

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

app.whenReady().then(() => {
  serverApp.listen(port, () => {
    console.log('listening to port: ', port)
  });

  serverApp.use(myLogger)
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and import them here.
