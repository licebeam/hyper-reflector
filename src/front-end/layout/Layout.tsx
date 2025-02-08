import * as React from 'react'
import {
    Link,
    useNavigate,
} from '@tanstack/react-router'
import { useLoginStore } from '../state/store'

export default function Layout({ children }) {
    const isLoggedIn = useLoginStore((state) => state.isLoggedIn)
    const setUserState = useLoginStore((state) => state.setUserState)
    const loggedOut = useLoginStore((state) => state.loggedOut)
    const navigate = useNavigate()

    React.useEffect(() => {
        window.api.on('logged-out', (event) => {
            console.log('logged out, whats the info:', event);
            setUserState({ email: '' })
            loggedOut()
            navigate({to: '/'})
            // handle do some funky stateful call for logging in redirect etc
        });
    }, []);

    return (
        <div>
            <div>
                <div className="p-2 flex gap-2">
                    <Link to="/news" className="[&.active]:font-bold">
                        News
                    </Link>
                    {isLoggedIn &&
                        <>
                            <Link to="/chat" className="[&.active]:font-bold">
                                Chat
                            </Link>
                            <Link to="/player" className="[&.active]:font-bold">
                                Profle
                            </Link>
                            <Link to="/settings" className="[&.active]:font-bold">
                                Settings
                            </Link>
                        </>
                    }
                    <Link to="/offline" className="[&.active]:font-bold">
                        Offline
                    </Link>
                    {!isLoggedIn &&
                        <Link to="/" className="[&.active]:font-bold">
                            Login
                        </Link>
                    }
                    {isLoggedIn &&
                        <button onClick={() => window.api.logOut()}>Log Out</button>
                    }
                </div>
                <hr />
            </div>
            {children}
        </div>
    )
}