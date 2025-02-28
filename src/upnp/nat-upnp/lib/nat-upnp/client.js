import nat from '../nat-upnp'

let client = {}

function Client() {
    this.ssdp = nat.ssdp.create()
    this.timeout = 1800
}

client.create = function create() {
    return new Client()
}

function normalizeOptions(options) {
    function toObject(addr) {
        if (typeof addr === 'number') return { port: addr }
        if (typeof addr === 'string' && !isNaN(addr)) return { port: Number(addr) }
        if (typeof addr === 'object') return addr
        return {}
    }

    return {
        remote: toObject(options.public),
        internal: toObject(options.private),
    }
}

Client.prototype.portMapping = function portMapping(options, callback = () => {}) {
    this.findGateway((err, gateway, address) => {
        if (err) return callback(err)

        const ports = normalizeOptions(options)
        let ttl =
            typeof options.ttl === 'number' ? options.ttl : parseInt(options.ttl, 10) || 60 * 30

        gateway.run(
            'AddPortMapping',
            [
                ['NewRemoteHost', ports.remote.host],
                ['NewExternalPort', ports.remote.port],
                ['NewProtocol', options.protocol ? options.protocol.toUpperCase() : 'TCP'],
                ['NewInternalPort', ports.internal.port],
                ['NewInternalClient', ports.internal.host || address],
                ['NewEnabled', 1],
                ['NewPortMappingDescription', options.description || 'node:nat:upnp'],
                ['NewLeaseDuration', ttl],
            ],
            callback
        )
    })
}

Client.prototype.portUnmapping = function portUnmapping(options, callback = () => {}) {
    this.findGateway((err, gateway) => {
        if (err) return callback(err)

        const ports = normalizeOptions(options)

        gateway.run(
            'DeletePortMapping',
            [
                ['NewRemoteHost', ports.remote.host],
                ['NewExternalPort', ports.remote.port],
                ['NewProtocol', options.protocol ? options.protocol.toUpperCase() : 'TCP'],
            ],
            callback
        )
    })
}

Client.prototype.getMappings = function getMappings(options = {}, callback) {
    this.findGateway(async (err, gateway, address) => {
        if (err) return callback(err)

        let i = 0
        let results = []

        while (true) {
            try {
                let data = await new Promise((resolve, reject) => {
                    gateway.run(
                        'GetGenericPortMappingEntry',
                        [['NewPortMappingIndex', i++]],
                        (err, data) => {
                            if (err) return reject(err)
                            resolve(data)
                        }
                    )
                })

                let key = Object.keys(data).find((k) =>
                    /:GetGenericPortMappingEntryResponse/.test(k)
                )
                if (!key) break

                data = data[key]
                results.push({
                    public: {
                        host: typeof data.NewRemoteHost === 'string' ? data.NewRemoteHost : '',
                        port: parseInt(data.NewExternalPort, 10),
                    },
                    private: {
                        host: data.NewInternalClient,
                        port: parseInt(data.NewInternalPort, 10),
                    },
                    protocol: data.NewProtocol.toLowerCase(),
                    enabled: data.NewEnabled === '1',
                    description: data.NewPortMappingDescription,
                    ttl: parseInt(data.NewLeaseDuration, 10),
                    local: data.NewInternalClient === address,
                })
            } catch {
                break // No more mappings
            }
        }

        if (options.local) {
            results = results.filter((item) => item.local)
        }

        if (options.description) {
            results = results.filter(
                (item) =>
                    typeof item.description === 'string' &&
                    (options.description instanceof RegExp
                        ? options.description.test(item.description)
                        : item.description.includes(options.description))
            )
        }

        callback(null, results)
    })
}

Client.prototype.externalIp = function externalIp(callback) {
    this.findGateway((err, gateway) => {
        if (err) return callback(err)

        gateway.run('GetExternalIPAddress', [], (err, data) => {
            if (err) return callback(err)

            let key = Object.keys(data).find((k) => /:GetExternalIPAddressResponse$/.test(k))
            if (!key) return callback(Error('Incorrect response'))

            callback(null, data[key].NewExternalIPAddress)
        })
    })
}

Client.prototype.findGateway = function findGateway(callback) {
    let timeout
    let timeouted = false
    const p = this.ssdp.search('urn:schemas-upnp-org:device:InternetGatewayDevice:1')

    timeout = setTimeout(() => {
        timeouted = true
        p.emit('end')
        callback(new Error('timeout'))
    }, this.timeout)

    p.on('device', (info, address) => {
        if (timeouted) return
        p.emit('end')
        clearTimeout(timeout)
        callback(null, nat.device.create(info.location), address)
    })
}

Client.prototype.close = function close() {
    this.ssdp.close()
}

export default client
