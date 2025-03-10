import upnp from '../upnp/nat-upnp'
let upnpClient: null | any = null // This is used for the unpnp object.
export const portForUPNP = 7000
import startProxyListener from './proxyListener'

export async function startUPNP(mainWindow: any, sendLog: any) {
    upnpClient = upnp.createClient()
    console.log('starting UPNP server normally')

    // we should unmap ports -- currently this breaks the server
    // await upnpClient
    //     ?.portUnmapping({ public: portForUPNP }, (err) => {
    //         if (!err) return
    //         //console.log('failed to close port', err)
    //     })
    //     .catch((err) => console.log(err))

    await startProxyListener(portForUPNP, mainWindow)

    // unpn mapping and usage
    upnpClient.portMapping(
        {
            public: portForUPNP,
            private: portForUPNP,
            ttl: 0,
            protocol: 'UDP',
        },
        function (err) {
            if (err) {
                console.error(`Failed to set up UPnP: ${err.message}`)
                sendLog(`Failed to set up UPnP: ${err.message}`)
            } else {
                console.log(`UPnP Port Mapping created: ${portForUPNP} , ${portForUPNP}}`)
                sendLog(`UPnP Port Mapping created: ${portForUPNP} , ${portForUPNP}}`)
            }
        }
    )

    upnpClient.getMappings({ local: true }, function (err, results) {
        console.log(results)
        sendLog(results)
    })

    upnpClient.externalIp(function (err, ip) {
        console.log(ip)
        if (err) {
            console.log('failed to get external ip')
        }
    })
}
