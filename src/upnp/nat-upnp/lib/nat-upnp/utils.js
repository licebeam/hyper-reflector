let utils = {}

utils.getNamespace = function getNamespace(data, uri) {
    console.log('Namespace Debug - Data:', JSON.stringify(data, null, 2), 'URI:', uri)

    for (const key in data) {
        if (key.startsWith('@_xmlns:') && data[key] === uri) {
            return key.replace('@_xmlns:', '') + ':'
        }
    }

    if (data['s:Envelope'] && data['s:Envelope']['@_xmlns:s'] === uri) {
        return 's:' // return the namespace prefix
    }

    return '' // return empty if namespace is not found
}

export default utils
