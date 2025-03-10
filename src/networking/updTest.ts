import { getExternalAddress2 } from './udpHolePunching'
const dgram = require('dgram')

let listenSocket: dgram.Socket | null = null
let sendSocket: dgram.Socket | null = null

async function realUdpPunch() {
    await getExternalAddress2()
    // peer 1
    // source port 7000
    // dest port 7001

    // hole punch
    // create new udp socket, bind to other source port
    // send information to ip dest port

    // listen for message
    // create a new udp socket listen on source port,
    // in a loop we
    // wait for socket to receive information

    // sending message
    // create a new udp socket bind to the dest port
    // in a loop, send message to other ip and source
}
