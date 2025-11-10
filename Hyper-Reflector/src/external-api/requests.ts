import keys from '../private/keys'
import { firebaseConfig } from '../private/firebase'

const SERVER = keys.COTURN_IP

import { fetch } from '@tauri-apps/plugin-http';

// await fetch(`http://${SERVER}:${keys.API_PORT}/logged-in`, {
//     method: "POST",
//     headers: { "Content-Type": "application/json" },
//     body: JSON.stringify({
//         idToken: await auth.currentUser?.getIdToken(),
//         userEmail: auth.currentUser?.email,
//     }),
// });

function checkCurrentAuthState(auth) {
    if (auth.currentUser != null) {
        return true // user is logged in successfully
    }
    console.log('--- access denied ---')
    return false
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
        // console.log('Auto-login successful:', data)
        const userInfo = await decodeJwt(data.id_token)
        const loginObject = await getLoggedInUser(userInfo.email).catch((err) =>
            console.log('error checkig if user was loggin in', err)
        )
        // console.log(loginObject)
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
        const requestBody = JSON.stringify({
            idToken,
            matchId: matchData.matchId, // generated by the hole punching server
            player1: matchData.player1,
            player2: matchData.player2,
            matchData: matchData.matchData, // this is the entirety of the stat-tracking-file
        })
        console.log(requestBody)
        try {
            fetch(`http://${SERVER}:${keys.API_PORT}/upload-match`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: requestBody,
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

async function getGlobalSet(auth, userId, matchId = null) {
    console.log('trying to fetch global set')
    if (checkCurrentAuthState(auth)) {
        const idToken = await auth.currentUser.getIdToken().then((res) => res)
        try {
            const response = await fetch(`http://${SERVER}:${keys.API_PORT}/get-global-set`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    idToken: idToken || 'not real',
                    userUID: userId,
                    matchId,
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

async function getGlobalStats(auth, userId) {
    if (checkCurrentAuthState(auth)) {
        const idToken = await auth.currentUser.getIdToken().then((res) => res)
        try {
            const response = await fetch(`http://${SERVER}:${keys.API_PORT}/get-global-stats`, {
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

async function getPlayerStats(auth, userId) {
    console.log('trying to fetch player stats')
    if (checkCurrentAuthState(auth)) {
        const idToken = await auth.currentUser.getIdToken().then((res) => res)
        try {
            const response = await fetch(`http://${SERVER}:${keys.API_PORT}/get-player-stats`, {
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

async function getAllTitles(auth, userId) {
    console.log('trying to fetch titles')
    if (checkCurrentAuthState(auth)) {
        const idToken = await auth.currentUser.getIdToken().then((res) => res)
        try {
            const response = await fetch(`http://${SERVER}:${keys.API_PORT}/get-titles`, {
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

async function searchUsers(auth, query: string, cursor?: string | null, limit = 25) {
    if (!checkCurrentAuthState(auth)) return
    const idToken = await auth.currentUser.getIdToken().then((res) => res)
    try {
        const response = await fetch(`http://${SERVER}:${keys.API_PORT}/search-users`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                idToken: idToken || 'not real',
                query,
                limit,
                cursor,
            }),
        })
        if (!response.ok) {
            return { users: [], nextCursor: null }
        }
        const data = await response.json()
        return data
    } catch (error) {
        console.log(error)
        console.error(error.message)
        return { users: [], nextCursor: null }
    }
}

async function getLeaderboard(
    auth,
    options: { sortBy?: 'elo' | 'wins'; cursor?: number | null; limit?: number } = {}
) {
    if (!checkCurrentAuthState(auth)) return
    const { sortBy = 'elo', cursor = null, limit = 25 } = options
    const idToken = await auth.currentUser.getIdToken().then((res) => res)
    try {
        const response = await fetch(`http://${SERVER}:${keys.API_PORT}/get-leaderboard`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                idToken: idToken || 'not real',
                sortBy,
                cursor,
                limit,
            }),
        })
        if (!response.ok) {
            return { entries: [], nextCursor: null }
        }
        const data = await response.json()
        return data
    } catch (error) {
        console.log(error)
        console.error(error.message)
        return { entries: [], nextCursor: null }
    }
}

export default {
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
    getAllTitles,
    getPlayerStats,
    searchUsers,
    getLeaderboard,
    //matches
    uploadMatchData,
    getUserMatches,
    getGlobalSet,
    getGlobalStats,
}
