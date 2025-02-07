import * as React from 'react'
import styled from 'styled-components'
import { useLoginStore } from '../state/store'

const Input = styled('input')(() => ({
    width: '100px'
}))

export default function LoginBlock() {
    const isLoggedIn = useLoginStore((state) => state.isLoggedIn)
    const failedLogin = useLoginStore((state) => state.failedLogin)
    const successLogin = useLoginStore((state) => state.successLogin)
    const [login, setLogin] = React.useState({ name: '', pass: '' })

    React.useEffect(() => {
        // Listen for updates from Electron
        window.api.on('logging-in', (event, message) => {
            console.log('Received:', message);
            // handle do some funky stateful call for logging in redirect etc
        });

        window.api.on('login-success', (event, message) => {
            //console.log('Received:', message);
            successLogin()
            // handle do some funky stateful call for logging in redirect etc
        });

        window.api.on('loging-failed', (event, message) => {
            console.log('Received:', message);
            failedLogin()
            // handle do some funky stateful call for logging in redirect etc
        });

        return () => {
            window.api.removeListener("logging-in");
        };
    }, []);

    return (
        <div style={{ display: 'flex' }}>
            {!isLoggedIn && <>
                <div>
                    <p>User Name</p>
                    <Input onChange={(e) => setLogin({ name: e.target.value, pass: login.pass })} type='text'/>
                </div>
                <div>
                    <p>User Name</p>
                    <Input onChange={(e) => setLogin({ name: login.name, pass: e.target.value })} type='password'/>
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