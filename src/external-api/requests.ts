import keys from '../private/keys'
import { firebaseConfig } from '../private/firebase'

const SERVER = keys.COTURN_IP
// const SERVER = '127.0.0.1' // -- used for testing the backend locally

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

async function updateUserData(auth, userData) {
    if (checkCurrentAuthState(auth)) {
        const idToken = await auth.currentUser.getIdToken().then((res) => res)
        try {
            console.log('trying to update')
            fetch(`http://${SERVER}:${keys.API_PORT}/update-user-data`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    idToken: idToken || 'not real',
                    userData,
                }),
            })
        } catch (error) {
            console.log(error)
            console.error(error.message)
        }
    }
}

async function getUserData(auth, userId) {
    if (checkCurrentAuthState(auth)) {
        const idToken = await auth.currentUser.getIdToken().then((res) => res)
        try {
            const response = await fetch(`http://${SERVER}:${keys.API_PORT}/get-user-data`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    idToken: idToken || 'not real',
                    userUID: userId,
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

async function autoLogin(refreshToken: string) {
    if (!refreshToken) return
    const response = await fetch(
        `https://securetoken.googleapis.com/v1/token?key=${firebaseConfig.apiKey}`,
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                grant_type: 'refresh_token',
                refresh_token: refreshToken,
            }),
        }
    )
    const decodeJwt = (token: string) => {
        const payload = token.split('.')[1] // Extract payload
        return JSON.parse(atob(payload)) // Decode and parse
    }
    const data = await response.json()
    if (data.id_token) {
        console.log('Auto-login successful:', data)
        const userInfo = await decodeJwt(data.id_token)
        const loginObject = await getLoggedInUser(userInfo.email).catch((err) =>
            console.log('error checkig if user was loggin in', err)
        )
        console.log(loginObject)
        return data
    }
}

async function getCustomToken(idToken: string) {
    try {
        const response = await fetch(`http://${SERVER}:${keys.API_PORT}/get-custom-token`, {
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

// match related
async function uploadMatchData(auth, matchData) {
    if (checkCurrentAuthState(auth)) {
        const idToken = await auth.currentUser.getIdToken().then((res) => res)
        try {
            fetch(`http://${SERVER}:${keys.API_PORT}/upload-match`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    idToken,
                    matchId: 'test-id',
                    player1: matchData.player1,
                    player2: matchData.player2,
                    matchData: matchData.matchData, // this is the entirety of the stat-tracking-file
                }),
            })
        } catch (error) {
            console.log(error)
            console.error(error.message)
        }
    }
}

async function getUserMatches(auth, userId, lastMatchId = null, firstMatchId = null) {
    console.log('last match', lastMatchId)
    if (checkCurrentAuthState(auth)) {
        const idToken = await auth.currentUser.getIdToken().then((res) => res)
        try {
            const response = await fetch(`http://${SERVER}:${keys.API_PORT}/get-user-matches`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    idToken: idToken || 'not real',
                    lastMatchId,
                    userUID: userId,
                    firstMatchId,
                }),
            })

            if (!response.ok) {
                console.log(response)
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
    autoLogin,
    getCustomToken,
    //profile
    updateUserData,
    createAccount,
    getUserByAuth,
    getUserData,
    //matches
    uploadMatchData,
    getUserMatches,
}
