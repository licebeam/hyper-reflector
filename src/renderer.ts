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
    sendGameData('some number etc')
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

let dataChannel; // Will store the game data channel

// Create Data Channel (for the player who starts the connection)
function createDataChannel() {
    dataChannel = peerConnection.createDataChannel("game", { reliable: true });

    dataChannel.onopen = () => console.log("Data Channel Open!");
    dataChannel.onmessage = (event) => console.log("Received:", event.data);
}

// Handle Incoming Data Channel (for the player receiving the connection)
peerConnection.ondatachannel = (event) => {
    dataChannel = event.channel;
    dataChannel.onopen = () => console.log("Data Channel Open!");
    dataChannel.onmessage = (event) => console.log("Received:", event.data);
};

// Send ICE candidates to the other peer
peerConnection.onicecandidate = (event) => {
    if (event.candidate) {
        signalingServer.send(JSON.stringify({ type: "ice-candidate", candidate: event.candidate }));
    }
};

async function convertBlob(event: any) {
    try {
        // check if event is not JSON but is blob
        if (event.data instanceof Blob) {
            const text = await event.data.text();
            const data = JSON.parse(text);
            console.log(data)
            return data
        } else {
            const data = JSON.parse(event.data);
            return data
        }
    } catch (error) {
        console.error("could not convert data:", event.data, error);
    }
}

// Handle ICE candidates from the other peer
signalingServer.onmessage = async (message) => {
    const data = await convertBlob(message).then(res => res);
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
    createDataChannel()
    console.log('test')
    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);
    signalingServer.send(JSON.stringify({ type: "offer", offer }));
}

// Send Game Data
function sendGameData(data) {
    console.log('sending data')
    if (dataChannel && dataChannel.readyState === "open") {
      dataChannel.send(JSON.stringify(data));
    }
  }