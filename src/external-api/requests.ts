import keys from '../private/keys'

function checkCurrentAuthState(auth) {
    if (auth.currentUser != null) {
        return true // user is logged in successfully
    }
    console.log('Access Denied my dawg')
    return false
}

async function externalApiDoSomething(auth) {
    if (checkCurrentAuthState(auth)) {
        const idToken = await auth.currentUser.getIdToken().then((res) => res)
        try {
            // ${keys.COTURN_IP}
            // works but maybe we should move to an ssl cert for https
            fetch(`http://127.0.0.1:${keys.API_PORT}/test`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ idToken: idToken || 'not real' }),
            })
        } catch (error) {
            console.log(error)
            console.error(error.message)
        }
    }
}

async function addLoggedInUser(auth) {
    if (checkCurrentAuthState(auth)) {
        const idToken = await auth.currentUser.getIdToken().then((res) => res)
        try {
            console.log('user attempting login test')
            // ${keys.COTURN_IP}
            // works but maybe we should move to an ssl cert for https
            fetch(`http://127.0.0.1:${keys.API_PORT}/logged-in`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    idToken: idToken || 'not real',
                    userEmail: auth.currentUser.email,
                }),
            })
        } catch (error) {
            console.log(error)
            console.error(error.message)
        }
    }
}

async function getLoggedInUser(email) {
    try {
        const response = fetch(`http://127.0.0.1:${keys.API_PORT}/get-logged-in`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                userEmail: email,
            }),
        })

        if (!response.ok) {
            return false
        }
        return true
        // const data = await response.json();
        // console.log(data);
        // return data
    } catch (error) {
        console.log(error)
        console.error(error.message)
    }
}

async function removeLoggedInUser(auth) {
    if (checkCurrentAuthState(auth)) {
        const idToken = await auth.currentUser.getIdToken().then((res) => res)
        try {
            // ${keys.COTURN_IP}
            // works but maybe we should move to an ssl cert for https
            fetch(`http://127.0.0.1:${keys.API_PORT}/log-out`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    idToken: idToken || 'not real',
                    userEmail: auth.currentUser.email,
                }),
            })
        } catch (error) {
            console.log(error)
            console.error(error.message)
        }
    }
}

export default {
    externalApiDoSomething,
    addLoggedInUser,
    getLoggedInUser,
    removeLoggedInUser,
}
