import { app, BrowserWindow, ipcMain, dialog, Notification } from 'electron';
import path from 'node:path';
import started from 'electron-squirrel-startup';
import { sendCommand, readCommand } from './dusty_reader';
import launchGGPO from './loadFbNeo';
const fs = require("fs");

const isDev = !app.isPackaged;

let filePathBase = process.resourcesPath;
//handle dev mode toggle for file paths.
if (isDev) {
  filePathBase = app.getAppPath() + "\\src"
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
    autoHideMenuBar: true,
  });

  // for these file paths like fightcade path and lua path, we need some way to access this directly through electron so we do no need to update all of the time.
  const startPlayingOnline = (player: number, remotePort: number, remoteIp: string, delay: number = 0) => {
    if (getEmulatorPath() == "undefined" || "") {
      new Notification({
        title: 'error',
        body: 'incorrect file path for your emulator'
      }).show()
      return
    }
    const localPort = 7000;
    const fightcadePath = `${getEmulatorPath()}\\fcadefbneo.exe`;
    const luaPath = path.join(filePathBase, '/lua/3rd_training_lua/dusty_file_reader.lua');
    const directCommand = `"${fightcadePath}" quark:direct,sfiii3nr1,${localPort},${remoteIp},${remotePort},${player},${delay},0 ${luaPath}`;
    launchGGPO(directCommand)
  }

  const startSoloMode = () => {
    if (getEmulatorPath() == "undefined" || "") {
      new Notification({
        title: 'error',
        body: 'incorrect file path for your emulator'
      }).show()
      return
    }
    const fightcadePath = `${getEmulatorPath()}\\fcadefbneo.exe`;
    const luaPath = path.join(filePathBase, '/lua/3rd_training_lua/3rd_training.lua');
    const directCommand = `"${fightcadePath}" -game sfiii3nr1 ${luaPath}`;
    launchGGPO(directCommand)
  }

  const getEmulatorPath = () => {
    try {
      const filePath = path.join(filePathBase, 'config.txt');
      const data = fs.readFileSync(filePath, { encoding: 'utf8' });
      console.log(data.split("=")[1])
      return data.split("=")[1]
    } catch (error) {
      mainWindow.webContents.send('message-from-main', error);
      console.error("Failed to read file:", error);
    }
  }

  const setEmulatorPath = async () => {
    try {
      await dialog.showOpenDialog({ properties: ['openFile', 'openDirectory'] }).then(res => {
        try {
          // write our file path to the config.txt file
          const filePath = path.join(filePathBase, 'config.txt');
          mainWindow.webContents.send('message-from-main', res);
          console.log('writing to: ', res)
          fs.writeFileSync(filePath, `emuPath=${res.filePaths[0]}`, { encoding: 'utf8' });
        } catch (error) {
          mainWindow.webContents.send('message-from-main', error);
          console.error("Failed to write to config file:", error);
        }
      }).catch(err => console.log(err))
      getEmulatorPath()
    } catch (error) {
      console.log(error)
    }
  }

  // handle ipc calls
  ipcMain.on("setEmulatorPath", () => {
    setEmulatorPath();
  });

  // receives text from front end sends it to emulator
  ipcMain.on("send-text", (event, text: string) => {
    sendCommand(`textinput:${text}`);
    readCommand();
  });

  ipcMain.on("send-command", (event, command) => {
    sendCommand(command);
    readCommand();
  });

  ipcMain.on("startP1", (event, data) => {
    mainWindow.webContents.send('message-from-main', 'starting 1p mode');
    console.log(data)
    startPlayingOnline(0, data.port || 7001, data.ip || "127.0.0.1", 0)
  });

  ipcMain.on("startP2", (event, data) => {
    startPlayingOnline(1, data.port || 7000, data.ip || "127.0.0.1", 0)
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
  // mainWindow.webContents.openDevTools();
};

// Listen for a request and respond to it
ipcMain.on('request-data', (event) => {
  event.sender.send('response-data', { msg: 'Here is some data from ipcMain' });
});

// read files
setInterval(() => {
  readCommand();
}, 1000); // read from reflector.text every 1000 ms 

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
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and import them here.
