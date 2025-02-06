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
        const idToken = await auth.currentUser.getIdToken().then((res) => res);
        try {
            // ${keys.COTURN_IP}
            // works but maybe we should move to an ssl cert for https
            fetch(`http://127.0.0.1:${keys.API_PORT}/test`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ idToken: idToken || 'not real' })
            })
        } catch (error) {
            console.log(error)
            console.error(error.message)
        }
    }
}

export default {
    externalApiDoSomething
}