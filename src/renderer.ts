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

document.getElementById("apiBtn").addEventListener("click", () => {
    window.api.sendCommand("resume");
});

document.getElementById("testBtn").addEventListener("click", () => {
    window.api.sendCommand("game_name");
});

document.getElementById("ggpoBtn").addEventListener("click", () => {
    window.api.openGGPO();
});

document.getElementById("api-serve-btn").addEventListener("click", () => {
    console.log('serving')
    window.api.serveMatch();
});

document.getElementById("api-connect-btn").addEventListener("click", () => {
    console.log('connecting')
    window.api.connectMatch();
});