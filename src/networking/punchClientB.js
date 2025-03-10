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

    var message = new Buffer('B')
    socket.send(message, 0, message.length, serverPort, serverHost, function (err, nrOfBytesSent) {
        if (err) return console.log(err)
        console.log('UDP message sent to ' + serverHost + ':' + serverPort)
        // socket.close();
    })
}

sendMessageToS()

var counter = 0
function sendMessageToB(address, port) {
    if (counter == 5) return
    var message = new Buffer(counter++ + ': Hello A!')
    socket.send(message, 0, message.length, port, address, function (err, nrOfBytesSent) {
        if (err) return console.log(err)
        console.log('UDP message sent to A:', address + ':' + port)

        setTimeout(function () {
            sendMessageToB(address, port)
        }, 2000)
    })
}
