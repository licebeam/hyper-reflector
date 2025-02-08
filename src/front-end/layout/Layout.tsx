import {
    Link,
} from '@tanstack/react-router'
import { useLoginStore } from '../state/store'

export default function Layout({ children }) {
    const isLoggedIn = useLoginStore((state) => state.isLoggedIn)
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
                    {!isLoggedIn &&
                        <Link to="/" className="[&.active]:font-bold">
                            Login
                        </Link>
                    }
                </div>
                <hr />
            </div>
            {children}
        </div>
    )
}