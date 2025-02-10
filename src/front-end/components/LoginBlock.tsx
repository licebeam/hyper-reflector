import * as React from 'react'
import styled from 'styled-components'
import { useNavigate } from '@tanstack/react-router'
import { useLoginStore, useMessageStore } from '../state/store'

const Input = styled('input')(() => ({
    width: '100px',
}))

export default function LoginBlock() {
    const isLoggedIn = useLoginStore((state) => state.isLoggedIn)
    const failedLogin = useLoginStore((state) => state.failedLogin)
    const successLogin = useLoginStore((state) => state.successLogin)
    const setUserState = useLoginStore((state) => state.setUserState)
    const addUser = useMessageStore((state) => state.pushUser)
    const clearUserList = useMessageStore((state) => state.clearUserList)
    const [login, setLogin] = React.useState({ name: 'test@test.com', pass: 'test123' })
    const navigate = useNavigate()

    const handleIsLoggingIn = () => {
        console.log('logging in')
    }

    const handleLogIn = (loginInfo) => {
        console.log('login success, whats the info:', loginInfo)
        setUserState(loginInfo)
        addUser(loginInfo)
        successLogin()
        navigate({ to: '/chat' })
        // handle do some funky stateful call for logging in redirect etc
    }

    const handleLoginFail = (event) => {
        console.log('Received:', event)
        clearUserList()
        failedLogin()
        navigate({ to: '/' })
    }

    React.useEffect(() => {
        // Listen for updates from Electron
        window.api.on('logging-in', handleIsLoggingIn)

        window.api.removeExtraListeners('login-success', handleLogIn)
        window.api.on('login-success', handleLogIn)

        window.api.removeExtraListeners('login-failed', handleLoginFail)
        window.api.on('login-failed', handleLoginFail)

        return () => {
            window.api.removeListener('logging-in', handleIsLoggingIn)
            window.api.removeListener('login-success', handleLogIn)
            window.api.removeListener('login-failed', handleLoginFail)
        }
    }, [])

    return (
        <div style={{ display: 'flex' }}>
            {!isLoggedIn && (
                <>
                    <div>
                        <p>User Name</p>
                        <Input
                            onChange={(e) => setLogin({ name: e.target.value, pass: login.pass })}
                            type="text"
                            value={login.name}
                        />
                    </div>
                    <div>
                        <p>User Name</p>
                        <Input
                            onChange={(e) => setLogin({ name: login.name, pass: e.target.value })}
                            type="password"
                            value={login.pass}
                        />
                    </div>
                    <button
                        id="login-btn"
                        onClick={() => {
                            console.log(window.api.getLoggedInUser(login.name)) // its and email
                            window.api.loginUser(login)
                        }}
                    >
                        Log In
                    </button>
                    {isLoggedIn}
                </>
            )}
        </div>
    )
}
