// example
import { useCallback, useEffect, useState } from 'react'
import { auth, loginEmail, loginGoogle, callable } from '../../../utils/firebase'
import api from '../../../external-api/requests'
import { onAuthStateChanged } from 'firebase/auth'
import { useLayoutStore, useLoginStore, useMessageStore } from '../../../state/deprecated_store'

// await loginEmail('test@test.com', 'passs')
// or
// await loginGoogle()

// const addScore = callable<{ matchId: string; delta: number }, { ok: boolean }>('addScore')
// const res = await addScore({ matchId: 'abc', delta: 10 })
// onAuthStateChanged(auth, (u) => {
//     if (!u) return
//     console.log(u)
//     console.log('auth:', u?.uid ?? 'signed out')
// })

export default function TestingGround() {
    const theme = useLayoutStore((state) => state.appTheme)
    const [isLoading, setIsLoading] = useState(true)
    const failedLogin = useLoginStore((state) => state.failedLogin)
    const successLogin = useLoginStore((state) => state.successLogin)
    const setUserState = useLoginStore((state) => state.setUserState)
    const addUser = useMessageStore((state) => state.pushUser)
    const clearUserList = useMessageStore((state) => state.clearUserList)

    useEffect(() => {
        console.log('subscribing to auth state')
        const unsub = onAuthStateChanged(auth, (u) => {
            console.log('onAuthStateChanged fired:', u?.uid ?? 'signed out')
            startLoginProcess(u)
            // kick off your login-side effects here if you want:
            // if (u) void startLoginProcess({ email: u.email! });
        })
        return unsub // cleanup
    }, [])

    async function handleLogin({ email, pass }: TLogin) {
        async function saveRefreshToken(refreshToken: string) {
            // await fs.writeFileSync(tokenFilePath, JSON.stringify({ refreshToken }), {
            //     encoding: 'utf-8',
            // })
        }
        // try {
        //     await signInWithEmailAndPassword(auth, email, pass)
        //         .then(async (data) => {
        //             await saveRefreshToken(data.user.refreshToken)
        //             return true
        //         })
        //         .catch((error) => {
        //             const errorCode = error.code
        //             const errorMessage = error.message
        //             console.log('failed to log in', errorCode, errorMessage)
        //             mainWindow.webContents.send('login-failed', 'login failed')
        //         })
        // } catch (error) {
        //     console.log(error)
        // }
    }

    async function startLoginProcess(login: TLogin) {
        const loginObject = await api
            .getLoggedInUser(login.email)
            .catch((err) => console.log('error checkig if user was loggin in', err))
        if (loginObject && loginObject.loggedIn) {
            // user is already logged in, handle relog
            console.log('user was already logged in', loginObject)
            //  await handleLogOut()
        }
        // await handleLogin({ email: login.email, pass: login.pass }).catch((err) =>
        //     console.log('failed to log in')
        // )
        // await api
        //     .addLoggedInUser(auth)
        //     .catch((err) => console.log('failed to add user to logged in users list'))
        // //test first time log

        const user = await api
            .getUserByAuth(auth)
            .catch((err) => console.log('err getting user by auth'))
        if (user) {
            console.log(user)
            handleLogIn(user)
            // send our user object to the front end
            // mainWindow.webContents.send('loginSuccess', getLoginObject(user))
            // userUID = user.uid
            // console.log('setting user ', user.name, user)
            // userName = user.name
            // console.log('user is: ', user)
        }
    }

    const handleLogIn = useCallback(async (loginInfo) => {
        // console.log('login info', loginInfo)
        setUserState(loginInfo)
        addUser(loginInfo)
        successLogin()
        setIsLoading(false)
        // navigate({ to: '/chat' })
    }, [])

    return (
        <div>
            <div style={{ color: 'red' }}>test</div>
        </div>
    )
}
