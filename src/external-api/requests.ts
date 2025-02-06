import keys from '../private/keys';

function addData() {
    try {
        const response = fetch(`${keys.COTURN_IP}:${keys.API_PORT}/test`)
        console.log(response)
    } catch (error) {
        console.error(error.message)
    }

}

export default {
    addData,
}