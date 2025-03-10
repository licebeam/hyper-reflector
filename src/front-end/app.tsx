// import { ChakraProvider } from '@chakra-ui/react'
import { createRoot } from 'react-dom/client'
import {
    Outlet,
    RouterProvider,
    createRouter,
    createRoute,
    createRootRoute,
    createMemoryHistory,
} from '@tanstack/react-router'
import { ChakraProvider, defaultConfig, defineConfig, createSystem } from '@chakra-ui/react'
import { TanStackRouterDevtools } from '@tanstack/router-devtools'
import StartPage from './pages/StartPage'
import LobbyPage from './pages/LobbyPage'
import OfflinePage from './pages/OfflinePage'
import NewsPage from './pages/NewsPage'
import PlayerProfilePage from './pages/PlayerProfilePage'
import SettingsPage from './pages/SettingsPage'
import CreateAccountPage from './pages/CreateAccountPage'
import ErrorBoundary from './ErrorBoundary'
import Layout from './layout/Layout'

const rootRoute = createRootRoute({
    component: () => (
        <>
            <Layout>
                <Outlet />
            </Layout>
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

const createAccountRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/create',
    component: function News() {
        return (
            <div className="p-2">
                <CreateAccountPage />
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
    path: '/profile',
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
    createAccountRoute,
])

// this allows electron to hash the routing
const memoryHistory = createMemoryHistory({
    initialEntries: ['/'], // Pass your initial url
})

const router = createRouter({ routeTree, history: memoryHistory })

declare module '@tanstack/react-router' {
    interface Register {
        router: typeof router
    }
}

const customConfig = defineConfig({
    theme: {
        tokens: {
            colors: {
                brand: {
                    50: { value: '#e6f2ff' },
                    100: { value: '#e6f2ff' },
                    200: { value: '#bfdeff' },
                    300: { value: '#99caff' },
                    950: { value: '#001a33' },
                },
            },
        },
    },
})

export const system = createSystem(defaultConfig, customConfig)

const root = createRoot(document.body)
root.render(
    <ErrorBoundary>
        <ChakraProvider value={system}>
            <RouterProvider router={router} />
        </ChakraProvider>
    </ErrorBoundary>
)
