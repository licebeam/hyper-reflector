import utils from './nat-upnp/utils'
import ssdp from './nat-upnp/ssdp'
import device from './nat-upnp/device'
import client from './nat-upnp/client'

export default {
    createClient: client.create,
    device,
    ssdp,
    utils,
}
