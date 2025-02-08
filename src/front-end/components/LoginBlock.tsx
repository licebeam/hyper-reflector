import * as React from 'react'
import styled from 'styled-components'
import {
    useNavigate,
} from '@tanstack/react-router'
import { useLoginStore } from '../state/store'

const Input = styled('input')(() => ({
    width: '100px'
}))

export default function LoginBlock() {
    const isLoggedIn = useLoginStore((state) => state.isLoggedIn)
    const failedLogin = useLoginStore((state) => state.failedLogin)
    const successLogin = useLoginStore((state) => state.successLogin)
    const setUserState = useLoginStore((state) => state.setUserState)
    const [login, setLogin] = React.useState({ name: 'test@test.com', pass: 'test123' })
    const navigate = useNavigate()

    React.useEffect(() => {
        // Listen for updates from Electron
        window.api.on('logging-in', (event) => {
            console.log('what is going on', event)
        });

        window.api.on('login-success', (loginInfo) => {
            console.log('login success, whats the info:', loginInfo);
            setUserState(loginInfo)
            successLogin()
            navigate({ to: '/chat' })
            // handle do some funky stateful call for logging in redirect etc
        });

        window.api.on('loging-failed', (event) => {
            console.log('Received:', event);
            failedLogin()
            navigate({ to: '/' })
        });
    }, []);

    return (
        <div style={{ display: 'flex' }}>
            {!isLoggedIn && <>
                <div>
                    <p>User Name</p>
                    <Input onChange={(e) => setLogin({ name: e.target.value, pass: login.pass })} type='text' value={login.name} />
                </div>
                <div>
                    <p>User Name</p>
                    <Input onChange={(e) => setLogin({ name: login.name, pass: e.target.value })} type='password' value={login.pass} />
                </div>
                <button id='login-btn' onClick={() => {
                    console.log('whats up')
                    window.api.loginUser(login);
                }}>Log In</button>
                {isLoggedIn}
            </>
            }
        </div>
    )
}