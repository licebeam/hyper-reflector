import { useEffect, useState } from 'react'
import styled from 'styled-components'
import { useNavigate, Link } from '@tanstack/react-router'
import { useLoginStore, useMessageStore } from '../state/store'

const Input = styled('input')(() => ({
    width: '100px',
}))

export default function LoginBlock() {
    const [isLoading, setIsLoading] = useState(false)
    const isLoggedIn = useLoginStore((state) => state.isLoggedIn)
    const failedLogin = useLoginStore((state) => state.failedLogin)
    const successLogin = useLoginStore((state) => state.successLogin)
    const setUserState = useLoginStore((state) => state.setUserState)
    const addUser = useMessageStore((state) => state.pushUser)
    const clearUserList = useMessageStore((state) => state.clearUserList)
    const [login, setLogin] = useState({
        name: 'bobby-blake',
        email: 'test@test.com',
        pass: 'test123',
    })
    const navigate = useNavigate()

    const handleIsLoggingIn = () => {
        console.log('logging in')
        setIsLoading(true)
    }

    const handleLogIn = (loginInfo) => {
        setUserState(loginInfo)
        addUser(loginInfo)
        successLogin()
        setIsLoading(false)
        navigate({ to: '/chat' })
        // handle do some funky stateful call for logging in redirect etc
    }

    const handleLoginFail = (event) => {
        setIsLoading(false)
        clearUserList()
        failedLogin()
        navigate({ to: '/' })
    }

    useEffect(() => {
        // Listen for updates from Electron
        window.api.removeExtraListeners('logging-in', handleIsLoggingIn)
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
        <div style={{ display: 'flex', flexDirection: 'column' }}>
            <p>Log in</p>
            <div style={{ display: 'flex' }}>
                {isLoading && <div>LOADING...</div>}
                {!isLoading && !isLoggedIn && (
                    <>
                        <div>
                            <p>User Email</p>
                            <Input
                                onChange={(e) =>
                                    setLogin({
                                        name: login.name,
                                        email: e.target.value,
                                        pass: login.pass,
                                    })
                                }
                                type="text"
                                value={login.email}
                            />
                        </div>
                        <div>
                            <p>Password</p>
                            <Input
                                onChange={(e) =>
                                    setLogin({
                                        name: login.name,
                                        email: login.email,
                                        pass: e.target.value,
                                    })
                                }
                                type="password"
                                value={login.pass}
                            />
                        </div>
                        <button
                            disabled={isLoading}
                            id="login-btn"
                            onClick={() => {
                                setIsLoading(true)
                                window.api.loginUser(login)
                            }}
                        >
                            Log In
                        </button>
                        <p>need an account?</p>
                        <Link to="/create" className="[&.active]:font-bold">
                            Create Account
                        </Link>
                        {isLoggedIn}
                    </>
                )}
            </div>
        </div>
    )
}
