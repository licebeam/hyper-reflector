import { createRoot } from 'react-dom/client'
import {
    Outlet,
    RouterProvider,
    createRouter,
    createRoute,
    createRootRoute,
} from '@tanstack/react-router'
import { TanStackRouterDevtools } from '@tanstack/router-devtools'
import StartPage from './pages/StartPage'
import LobbyPage from './pages/LobbyPage'
import OfflinePage from './pages/OfflinePage'
import NewsPage from './pages/NewsPage'
import PlayerProfilePage from './pages/PlayerProfilePage'
import SettingsPage from './pages/SettingsPage'

const rootRoute = createRootRoute({
    component: () => (
        <>
            <Outlet />
            <TanStackRouterDevtools />
        </>
    ),
})

const indexRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/',
    component: function Home() {
        return (
            <div className="p-2">
                <StartPage />
            </div>
        )
    },
})

const newsRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/news',
    component: function News() {
        return (
            <div className="p-2">
                <NewsPage />
            </div>
        )
    },
})

const offlineRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/offline',
    component: function Offline() {
        return (
            <div className="p-2">
                <OfflinePage />
            </div>
        )
    },
})

const chatRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/chat',
    component: function Chat() {
        return (
            <div className="p-2">
                <LobbyPage />
            </div>
        )
    },
})

const profileRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/player',
    component: function Settings() {
        return (
            <div className="p-2">
                <PlayerProfilePage />
            </div>
        )
    },
})

const settingsRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/settings',
    component: function Settings() {
        return (
            <div className="p-2">
                <SettingsPage />
            </div>
        )
    },
})

const routeTree = rootRoute.addChildren([
    indexRoute,
    newsRoute,
    offlineRoute,
    chatRoute,
    profileRoute,
    settingsRoute,
])

const router = createRouter({ routeTree })

declare module '@tanstack/react-router' {
    interface Register {
        router: typeof router
    }
}

const root = createRoot(document.body)
root.render(<RouterProvider router={router} />)
