var dgram = require('dgram')
var keys = require('../private/keys')

// based on http://www.bford.info/pub/net/p2pnat/index.html

var socket = dgram.createSocket('udp4')

console.log(keys.default.COTURN_IP)

socket.on('message', function (message, remote) {
    console.log(remote.address + ':' + remote.port + ' - ' + message)
    try {
        var publicEndpointB = JSON.parse(message)
        sendMessageToB(publicEndpointB.address, publicEndpointB.port)
    } catch (err) {}
})

function sendMessageToS() {
    var serverPort = 33333
    var serverHost = keys.default.COTURN_IP
    // var serverHost = '127.0.0.1'

    var message = new Buffer('A')
    socket.send(message, 0, message.length, serverPort, serverHost, function (err, nrOfBytesSent) {
        if (err) return console.log(err)
        console.log('UDP message sent to ' + serverHost + ':' + serverPort)
        // socket.close();
    })
}

sendMessageToS()

function sendMessageToB(address, port) {
    var message = new Buffer('message : Hello B!')
    socket.send(message, 0, message.length, port, address, function (err, nrOfBytesSent) {
        if (err) return console.log(err)
        console.log('UDP message sent to B:', address + ':' + port)
        startEmulator(address, port)
        // This is the keep alive
        setTimeout(function () {
            sendMessageToB(address, port)
        }, 2000)
    })
}


function startEmulator(address, port){
    const emu = startPlayingOnline({
        config,
        localPort: 7000,
        remoteIp: address,
        remotePort: port,
        player: 0,
        delay: 0,
        isTraining: false, // Might be used in the future.
        callBack: () => {
            console.log('test')
            // // attempt to kill the emulator
            // mainWindow.webContents.send('endMatch', userUID)
            // console.log('emulator should die')
            // killUdpSocket()
        },
    })
}