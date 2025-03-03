import keys from '../private/keys'

const SERVER = keys.COTURN_IP
// const SERVER = '127.0.0.1' -- used for testing the backend locally

function checkCurrentAuthState(auth) {
    if (auth.currentUser != null) {
        return true // user is logged in successfully
    }
    console.log('--- access denied ---')
    return false
}

async function externalApiDoSomething(auth) {
    if (checkCurrentAuthState(auth)) {
        const idToken = await auth.currentUser.getIdToken().then((res) => res)
        try {
            // ${keys.COTURN_IP}
            // works but maybe we should move to an ssl cert for https
            fetch(`http://${SERVER}:${keys.API_PORT}/test`, {
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
            fetch(`http://${SERVER}:${keys.API_PORT}/logged-in`, {
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

async function getLoggedInUser(userEmail: string) {
    try {
        console.log('user email making request', userEmail)
        const response = await fetch(`http://${SERVER}:${keys.API_PORT}/get-logged-in`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                userEmail: userEmail,
            }),
        })

        if (!response.ok) {
            return false
        }

        const data = await response.json()
        return data
    } catch (error) {
        console.log(error)
        console.error(error.message)
    }
}

async function removeLoggedInUser(auth) {
    if (checkCurrentAuthState(auth)) {
        console.log('test')
        const idToken = await auth.currentUser.getIdToken().then((res) => res)
        console.log(idToken)
        try {
            console.log('test2')
            // ${keys.COTURN_IP}
            // works but maybe we should move to an ssl cert for https
            fetch(`http://${SERVER}:${keys.API_PORT}/log-out`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    idToken: idToken || 'not real',
                    userEmail: auth.currentUser.email,
                }),
            }).catch((err) => console.log('error removing user from service.', err))
        } catch (error) {
            console.log(error)
            console.error(error.message)
        }
    }
}

async function changeUserName(auth, name) {
    if (checkCurrentAuthState(auth)) {
        const idToken = await auth.currentUser.getIdToken().then((res) => res)
        try {
            fetch(`http://${SERVER}:${keys.API_PORT}/change-name`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    idToken: idToken || 'not real',
                    userName: name,
                }),
            })
        } catch (error) {
            console.log(error)
            console.error(error.message)
        }
    }
}

async function createAccount(auth, name, email) {
    if (checkCurrentAuthState(auth)) {
        const idToken = await auth.currentUser.getIdToken().then((res) => res)
        try {
            console.log('trying on main to create account', name, email)
            fetch(`http://${SERVER}:${keys.API_PORT}/create-account`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    idToken: idToken || 'not real',
                    name,
                    email,
                }),
            })
        } catch (error) {
            console.log(error)
            console.error(error.message)
        }
    }
}

async function getUserByAuth(auth) {
    if (checkCurrentAuthState(auth)) {
        console.log('attempting user fetch by auth')
        const idToken = await auth.currentUser.getIdToken().then((res) => res)
        try {
            const response = await fetch(`http://${SERVER}:${keys.API_PORT}/get-user-auth`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    idToken: idToken || 'not real',
                }),
            })

            if (!response.ok) {
                return false
            }

            const data = await response.json()
            return data
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
    //profile
    changeUserName,
    createAccount,
    getUserByAuth,
}
