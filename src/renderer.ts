import keys from "./private/keys"

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
    startCall()
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


// handle connection to remote turn server
const signalingServer = new WebSocket(`ws://${keys.COTURN_IP}:3000`);
const peerConnection = new RTCPeerConnection({
    iceServers: [
        {
            urls: [`stun:${keys.COTURN_IP}:${keys.COTURN_PORT}`],
        },
        {
            urls: [`turn:${keys.COTURN_IP}:${keys.COTURN_PORT}`],
            username: "turn",
            credential: "turn",
        },
    ],
});

// Send ICE candidates to the other peer
peerConnection.onicecandidate = (event) => {
    if (event.candidate) {
        signalingServer.send(JSON.stringify({ type: "ice-candidate", candidate: event.candidate }));
    }
};

// Handle ICE candidates from the other peer
signalingServer.onmessage = async (message) => {
    console.log(JSON.stringify(message))
    const data = message.data;

    console.log(data)
    if (data.type === "offer") {
        await peerConnection.setRemoteDescription(new RTCSessionDescription(data.offer));
        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);
        signalingServer.send(JSON.stringify({ type: "answer", answer }));
        console.log('hey we got offer')
    } else if (data.type === "answer") {
        console.log('hey we got answer')
        await peerConnection.setRemoteDescription(new RTCSessionDescription(data.answer));
    } else if (data.type === "ice-candidate") {
        console.log('hey we got candidate')
        await peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate));
    }
};

// Create an offer and send it to the other peer
async function startCall() {
    console.log('test')
    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);
    signalingServer.send(JSON.stringify({ type: "offer", offer }));
}