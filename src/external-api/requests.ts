import keys from '../private/keys';

function checkCurrentAuthState(auth) {
    if (auth.currentUser != null) {
        return true // user is logged in successfully
    }
    console.log("Access Denied my dawg")
    return false
}

async function externalApiDoSomething(auth) {
    if (checkCurrentAuthState(auth)) {
        try {
            // works but maybe we should move to an ssl cert for https
            const response = await fetch(`http://${keys.COTURN_IP}:${keys.API_PORT}/test`)
            console.log(response)
        } catch (error) {
            console.log(error)
            console.error(error.message)
        }
    }
}

export default {
    externalApiDoSomething
}