import { useEffect, useState } from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
import { useLoginStore, useMessageStore } from '../state/store'

export default function Layout({ children }) {
    const [isLoading, setIsLoading] = useState(false)
    const isLoggedIn = useLoginStore((state) => state.isLoggedIn)
    const userState = useLoginStore((state) => state.userState)
    const setUserState = useLoginStore((state) => state.setUserState)
    const loggedOut = useLoginStore((state) => state.loggedOut)
    const clearMessageState = useMessageStore((state) => state.clearMessageState)
    const clearUserList = useMessageStore((state) => state.clearUserList)
    const navigate = useNavigate()

    useEffect(() => {
        window.api.on('loggedOutSuccess', (event) => {
            console.log('log out reset state')
            clearUserList()
            clearMessageState()
            setUserState({ email: '' })
            loggedOut()
            setIsLoading(false)
            navigate({ to: '/' })
            // handle do some funky stateful call for logging in redirect etc
        })
    }, [])

    return (
        <div>
            <div>
                <div>
                    <Link to="/news" className="[&.active]:font-bold">
                        News
                    </Link>
                    {isLoggedIn && (
                        <>
                            <Link to="/chat" className="[&.active]:font-bold">
                                Chat
                            </Link>
                            <Link to="/player" className="[&.active]:font-bold">
                                Profile
                            </Link>
                        </>
                    )}
                    <Link to="/offline" className="[&.active]:font-bold">
                        Offline
                    </Link>
                    <Link to="/settings" className="[&.active]:font-bold">
                        Settings
                    </Link>
                    {!isLoggedIn && (
                        <Link to="/" className="[&.active]:font-bold">
                            Login
                        </Link>
                    )}
                    {isLoggedIn && (
                        <button
                            disabled={isLoading}
                            onClick={() => {
                                console.log("trying to log out")
                                setIsLoading(true)
                                window.api.logOutUser()
                            }}
                        >
                            Log Out
                        </button>
                    )}
                </div>
                <hr />
            </div>
            {children}
        </div>
    )
}
