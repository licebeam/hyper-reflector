import { app, BrowserWindow, ipcMain, dialog, Notification } from 'electron';
import started from 'electron-squirrel-startup';
import { sendCommand, readCommand, readStatFile } from './sendHyperCommands';
import { startPlayingOnline, startSoloMode } from './loadFbNeo';
import { getConfig, type Config } from './config';

// - FIREBASE CODE
import { initializeApp } from "firebase/app";
import { getAuth, signInWithEmailAndPassword } from "firebase/auth";
import { firebaseConfig } from './private/firebase';

// TODO: Replace the following with your app's Firebase project configuration
// See: https://firebase.google.com/docs/web/learn-more#config-object
// Initialize Firebase
const fbapp = initializeApp(firebaseConfig);


// Initialize Firebase Authentication and get a reference to the service
const auth = getAuth(fbapp);
// END FIREBASE


const fs = require("fs");
const path = require("path");

const isDev = !app.isPackaged;

let filePathBase = process.resourcesPath;
//handle dev mode toggle for file paths.
if (isDev) {
  filePathBase = path.join(app.getAppPath(), "src");
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

  let config: Config
  try {
    config = getConfig();
    console.log({ config })
  } catch (error) {
    mainWindow.webContents.send('message-from-main', error);
    console.error("Failed to read file:", error);
  }

  if (!config.app.emuPath) {
    new Notification({
      title: 'error',
      body: 'incorrect file path for your emulator'
    }).show()
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
      // getEmulatorPath()
    } catch (error) {
      console.log(error)
    }
  }

  // firebase test
  function handleLogin(email, password) {
    console.log('attempting to log in ---------------------------------------------')
    // test login
    try {
      signInWithEmailAndPassword(auth, email, password)
        .then((userCredential) => {
          // Signed in 
          const user = userCredential.user;
          console.log('logged in')
          // ...
        })
        .catch((error) => {
          const errorCode = error.code;
          const errorMessage = error.message;
          console.log('failed to log in', error.code)
        });
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
    // test functions
    readCommand();
    readStatFile(mainWindow);
    handleLogin('dustinwalkerart@gmail.com', 'testpass')
  });

  ipcMain.on("send-command", (event, command) => {
    handleLogin('hey', 'hey')
    sendCommand(command);
    readCommand();
  });

  ipcMain.on("startP1", (event, data) => {
    mainWindow.webContents.send('message-from-main', 'starting 1p mode');
    console.log(data)
    startPlayingOnline({
      config,
      localPort: 7000,
      remoteIp: data.ip || "127.0.0.1",
      remotePort: data.port || 7001,
      player: 0,
      delay: 0,
    })
  });

  ipcMain.on("startP2", (event, data) => {
    startPlayingOnline({
      config,
      localPort: 7001,
      remoteIp: data.ip || "127.0.0.1",
      remotePort: data.port || 7000,
      player: 1,
      delay: 0,
    })
  });

  ipcMain.on("start-solo-mode", (event) => {
    startSoloMode({ config });
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

// Listen for a request and respond to it
ipcMain.on('request-data', (event) => {
  event.sender.send('response-data', { msg: 'Here is some data from ipcMain' });
});

// read files
setInterval(() => {
  // currently we aren't really using this polling, but we will eventually need something like this
  // readCommand();
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
