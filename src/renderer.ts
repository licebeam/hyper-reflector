/**
 * This file will automatically be loaded by vite and run in the "renderer" context.
 * To learn more about the differences between the "main" and the "renderer" context in
 * Electron, visit:
 *
 * https://electronjs.org/docs/tutorial/application-architecture#main-and-renderer-processes
 *
 * By default, Node.js integration in this file is disabled. When enabling Node.js integration
 * in a renderer process, please be aware of potential security implications. You can read
 * more about security risks here:
 *
 * https://electronjs.org/docs/tutorial/security
 *
 * To enable Node.js integration in this file, open up `main.ts` and enable the `nodeIntegration`
 * flag:
 *
 * ```
 *  // Create the browser window.
 *  mainWindow = new BrowserWindow({
 *    width: 800,
 *    height: 600,
 *    webPreferences: {
 *      nodeIntegration: true
 *    }
 *  });
 * ```
 */

import './index.css';

document.getElementById("sendTextBtn").addEventListener("click", () => {
    var text = document.getElementById("inputText").value; // typescript error, works fine
    window.api.sendText(text);
});

document.getElementById("testBtn").addEventListener("click", () => {
    window.api.sendCommand("game_name");
});

document.getElementById("setEmuPathBtn").addEventListener("click", () => {
    window.api.setEmulatorPath();
});

document.getElementById("api-serve-btn").addEventListener("click", () => {
    var port = document.getElementById("externalPort").value; // typescript error, works fine
    var ip = document.getElementById("externalIp").value; // typescript error, works fine
    console.log('starting match with: ', ip, ":", port)
    window.api.serveMatch(ip, port);
});

document.getElementById("api-connect-btn").addEventListener("click", () => {
    var port = document.getElementById("externalPort").value; // typescript error, works fine
    var ip = document.getElementById("externalIp").value; // typescript error, works fine
    console.log('starting match with: ', ip, ":", port)
    window.api.connectMatch(ip, port);
});

document.getElementById("start-solo-btn").addEventListener("click", () => {
    console.log('starting solo training')
    window.api.startSoloTraining();
});

// const test = async () => {
//     const response = await window.api.ping()
//     console.log(response) // prints out 'pong'
//   }
  
//   test()