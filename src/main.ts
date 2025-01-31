import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'node:path';
import started from 'electron-squirrel-startup';
import sendCommand from './dusty_reader';
import launchGGPO from './loadFbNeo';

const express = require("express");
const serverApp = express();
const port = 8089;

const myLogger = function (req, res, next) {
  console.log('LOGGED')
  next()
}

serverApp.get('/test', (req, res) => {
  console.log("hey")
  res.send('Hello World!')
})

serverApp.get('/serve', (req, res) => {
  const openPort = 7000;
  const fightcadePath = "C:/Users/dusti/Documents/Fightcade/emulator/fbneo/fcadefbneo.exe";
  const fakeQuarkID = 'ABC123XYZ789';
  const directCommand = `"${fightcadePath}" -game sfiii3nr1 quark:direct,sfiii3nr1,${openPort},192.168.11.5,7000,0,0,1`; // direct, working wtf
  launchGGPO(directCommand)
  // const serveCommand = `"${fightcadePath}" -game sfiii3nr1 quark:served,sfiii3nr1,${fakeQuarkID},${openPort},0,1`; // served, load into dc - works
  // launchGGPO(serveCommand)
})

serverApp.get('/connect', (req, res) => {
  const openPort = 7000;
  const fightcadePath = "C:/Users/dusti/Documents/Fightcade/emulator/fbneo/fcadefbneo.exe";
  const fakeQuarkID = 'ABC123XYZ789';
  // sscanf(connect, "quark:stream,%[^,],%[^,],%d", game, quarkid, &remotePort);
  const command = `"${fightcadePath}" -game sfiii3nr1 quark:direct,sfiii3nr1,${openPort},192.168.11.5,7000,1,0,1`; // direct, working wtf
  // const command = `"${fightcadePath}" -game sfiii3nr1 quark:stream,sfiii3nr1],${fakeQuarkID},${openPort}`; // direct, working wtf
  launchGGPO(command)
})

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
  ipcMain.on("send-command", (event, command) => {
    sendCommand(command);
  });

  ipcMain.on("open-ggpo", (event, command) => {
    // launchGGPO()
  });

  ipcMain.on("hit-api", () => {
    try {
      fetch('http://localhost:8089/test').catch(err => console.log(err))
    } catch (error) {
      console.log(error);
    }
  });

  ipcMain.on("serve-api", () => {
    try {
      console.log('test')
      fetch('http://localhost:8089/serve').catch(err => console.log(err))
    } catch (error) {
      console.log(error);
    }
  });

  ipcMain.on("connect-api", () => {
    try {
      fetch('http://localhost:8089/connect').catch(err => console.log(err))
    } catch (error) {
      console.log(error);
    }
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
