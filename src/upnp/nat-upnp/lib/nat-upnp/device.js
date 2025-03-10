import nat from '../nat-upnp'
import axios from 'axios'
import { XMLParser } from 'fast-xml-parser'
var url = require('url')
var Buffer = require('buffer').Buffer

let device = {}

function Device(url) {
    this.description = url
    this.services = [
        'urn:schemas-upnp-org:service:WANIPConnection:1',
        'urn:schemas-upnp-org:service:WANIPConnection:2',
        'urn:schemas-upnp-org:service:WANPPPConnection:1',
    ]
}

device.create = function create(url) {
    return new Device(url)
}

Device.prototype._getXml = async function _getXml(url, callback) {
    var once = false
    function respond(err, body) {
        if (once) return
        once = true

        callback(err, body)
    }

    axios
        .get(url)
        .then(async ({ data }) => {
            const parsedData = new XMLParser().parse(data)
            const rootData = parsedData.root
            respond(null, rootData)
        })
        .catch((err) => {
            callback(err)
            respond(Error('Failed to lookup device description'))
        })
}

Device.prototype.getService = function getService(types, callback) {
    var self = this

    this._getXml(this.description, function (err, info) {
        if (err) return callback(err)

        var s = self.parseDescription(info).services.filter(function (service) {
            return types.indexOf(service.serviceType) !== -1
        })

        if (s.length === 0 || !s[0].controlURL || !s[0].SCPDURL) {
            return callback(Error('Service not found'))
        }

        var base = url.parse(info.baseURL || self.description)
        function prefix(u) {
            var uri = url.parse(u)

            uri.host = uri.host || base.host
            uri.protocol = uri.protocol || base.protocol

            return url.format(uri)
        }

        callback(null, {
            service: s[0].serviceType,
            SCPDURL: prefix(s[0].SCPDURL),
            controlURL: prefix(s[0].controlURL),
        })
    })
}

Device.prototype.parseDescription = function parseDescription(info) {
    var services = [],
        devices = []

    function toArray(item) {
        return Array.isArray(item) ? item : [item]
    }

    function traverseServices(service) {
        if (!service) return
        services.push(service)
    }

    function traverseDevices(device) {
        if (!device) return
        devices.push(device)

        if (device.deviceList && device.deviceList.device) {
            toArray(device.deviceList.device).forEach(traverseDevices)
        }

        if (device.serviceList && device.serviceList.service) {
            toArray(device.serviceList.service).forEach(traverseServices)
        }
    }

    traverseDevices(info.device)

    return {
        services: services,
        devices: devices,
    }
}

Device.prototype.run = function run(action, args, callback) {
    var self = this

    this.getService(this.services, function (err, info) {
        if (err) return callback(err)

        var body =
            '<?xml version="1.0"?>' +
            '<s:Envelope ' +
            'xmlns:s="http://schemas.xmlsoap.org/soap/envelope/" ' +
            's:encodingStyle="http://schemas.xmlsoap.org/soap/encoding/">' +
            '<s:Body>' +
            '<u:' +
            action +
            ' xmlns:u=' +
            JSON.stringify(info.service) +
            '>' +
            args
                .map(function (args) {
                    return (
                        '<' +
                        args[0] +
                        '>' +
                        (args[1] === undefined ? '' : args[1]) +
                        '</' +
                        args[0] +
                        '>'
                    )
                })
                .join('') +
            '</u:' +
            action +
            '>' +
            '</s:Body>' +
            '</s:Envelope>'

        axios
            .post(info.controlURL, body, {
                headers: {
                    'Content-Type': 'text/xml; charset="utf-8"',
                    'Content-Length': '' + Buffer.byteLength(body),
                    Connection: 'close',
                    SOAPAction: JSON.stringify(info.service + '#' + action),
                },
                responseType: 'text',
            })
            .then((res) => {
                // console.log('Raw Response:', res.data);

                const xmlString = Buffer.isBuffer(res.data) ? res.data.toString() : res.data
                const parser = new XMLParser({ ignoreAttributes: false, trimValues: true })
                const parsedData = parser.parse(xmlString)

                // console.log('Parsed XML:', JSON.stringify(parsedData, null, 2));

                var soapns = nat.utils.getNamespace(
                    parsedData['s:Envelope'],
                    'http://schemas.xmlsoap.org/soap/envelope/'
                )
                // console.log('SOAP Namespace:', soapns);

                if (!soapns) {
                    return callback(new Error('SOAP namespace not found in response'))
                }

                callback(null, parsedData['s:Envelope'][soapns + 'Body'])
            })
            .catch((err) => {
                // console.log('Error in run:', err);
                return callback(new Error('Request failed: ' + err.message))
            })
    })
}

export default device
