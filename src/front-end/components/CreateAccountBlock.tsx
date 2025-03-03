import { useEffect, useState } from 'react'
import styled from 'styled-components'
import { useNavigate } from '@tanstack/react-router'
import { useLoginStore, useMessageStore } from '../state/store'

const Input = styled('input')(() => ({
    width: '100px',
}))

export default function CreateAccountBlock() {
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
        repass: 'test123',
    })
    const navigate = useNavigate()

    const handleCreateSuccess = () => {
        console.log('account created successfully')
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
        window.api.removeExtraListeners('accountCreationSuccess', handleCreateSuccess)
        window.api.on('accountCreationSuccess', handleCreateSuccess)

        window.api.removeExtraListeners('login-success', handleLogIn)
        window.api.on('login-success', handleLogIn)

        window.api.removeExtraListeners('login-failed', handleLoginFail)
        window.api.on('login-failed', handleLoginFail)

        return () => {
            window.api.removeListener('accountCreationSuccess', handleCreateSuccess)
            window.api.removeListener('login-success', handleLogIn)
            window.api.removeListener('login-failed', handleLoginFail)
        }
    }, [])

    return (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
            <p>Create a new account</p>
            <div style={{ display: 'flex' }}>
                {isLoading && <div>Creating...</div>}
                {!isLoading && !isLoggedIn && (
                    <>
                        <div>
                            <p>User Name</p>
                            <Input
                                onChange={(e) =>
                                    setLogin({
                                        name: e.target.value,
                                        email: login.email,
                                        pass: login.pass,
                                        repass: login.repass,
                                    })
                                }
                                type="text"
                                value={login.name}
                            />
                        </div>
                        <div>
                            <p>User Email</p>
                            <Input
                                onChange={(e) =>
                                    setLogin({
                                        name: login.name,
                                        email: e.target.value,
                                        pass: login.pass,
                                        repass: login.repass,
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
                                        repass: login.repass,
                                    })
                                }
                                type="password"
                                value={login.pass}
                            />
                            <p>Re-type Password</p>
                            <Input
                                onChange={(e) =>
                                    setLogin({
                                        name: login.name,
                                        email: login.email,
                                        pass: login.pass,
                                        repass: e.target.value,
                                    })
                                }
                                type="password"
                                value={login.repass}
                            />
                        </div>
                        <button
                            disabled={isLoading}
                            id="create-btn"
                            onClick={() => {
                                setIsLoading(true)
                                window.api.createAccount(login)
                            }}
                        >
                            Create Account
                        </button>
                        {isLoggedIn}
                    </>
                )}
            </div>
        </div>
    )
}
