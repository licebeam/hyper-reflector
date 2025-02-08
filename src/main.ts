import { app, BrowserWindow, ipcMain, dialog, Notification } from 'electron';
import started from 'electron-squirrel-startup';
import { sendCommand, readCommand, readStatFile } from './sendHyperCommands';
import { startPlayingOnline, startSoloMode } from './loadFbNeo';
import { getConfig, type Config } from './config';
// external api
import api from './external-api/requests'

// - FIREBASE AUTH CODE - easy peasy
import { initializeApp } from "firebase/app";
import { getAuth, signInWithEmailAndPassword } from "firebase/auth";
import { firebaseConfig } from './private/firebase';

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
      // potential security issue = https://stackoverflow.com/questions/48148021/how-to-import-ipcrenderer-in-react
      // but this allows us to use ipc calls in useEffects in react
      // nodeIntegration: true, 
      // contextIsolation: false,
      // 
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
  async function handleLogin(email: string, password: string) {
    mainWindow.webContents.send('logging-in', 'trying to log in');
    try {
      await signInWithEmailAndPassword(auth, email, password)
        .then((userCredential) => {
          // successful sign in, send data to front end!
          const user = userCredential.user;
          console.log({ name: user.displayName, email: user.email, uid: user.uid })
          mainWindow.webContents.send('login-success', { name: user.displayName, email: user.email, uid: user.uid });
        })
        .catch((error) => {
          const errorCode = error.code;
          const errorMessage = error.message;
          console.log('failed to log in', error.code)
          mainWindow.webContents.send('login-failed', 'login failed');
        });
    } catch (error) {
      console.log(error)
    }
  }

  // handle ipc calls
  ipcMain.on("login-user", (event, login) => {
    console.log('should login user', login)
    handleLogin(login.name, login.pass);
  });

  ipcMain.on("setEmulatorPath", () => {
    setEmulatorPath();
  });

  // receives text from front end sends it to emulator
  ipcMain.on("send-text", (event, text: string) => {
    sendCommand(`textinput:${text}`);
    // test functions
    readCommand();
    readStatFile(mainWindow);
  });

  ipcMain.on("send-command", (event, command) => {
    sendCommand(command);
    readCommand();
    // external api testing delete me later
    api.externalApiDoSomething(auth);
    //console.log(auth)
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

  // send a message off to websockets for other users to see and save our message on our front end.
  ipcMain.on("sendMessage", (event, text: string) => {
    // here we can parse the string etc
    console.log("Main process received message:", text);
    mainWindow.webContents.send('user-message', text);
  });

  // this is used by websockets to populate our chat room with other peoples messages
  ipcMain.on("roomMessage", (event, messageObject) => {
    // here we can parse the string etc
    console.log(messageObject)
    mainWindow.webContents.send('room-message', messageObject);
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
