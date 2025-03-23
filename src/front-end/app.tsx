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
import { ChakraProvider, defaultConfig, defineConfig, createSystem, Box } from '@chakra-ui/react'
// import { TanStackRouterDevtools } from '@tanstack/router-devtools'
import StartPage from './pages/StartPage'
import LobbyPage from './pages/LobbyPage'
import OfflinePage from './pages/OfflinePage'
import NewsPage from './pages/NewsPage'
import PlayerProfilePage from './pages/PlayerProfilePage'
import SettingsPage from './pages/SettingsPage'
import CreateAccountPage from './pages/CreateAccountPage'
import ErrorBoundary from './ErrorBoundary'
import Layout from './layout/Layout'
import Autologin from './components/AutoLogin'

const rootRoute = createRootRoute({
    component: () => (
        <>
            <Layout>
                <Outlet />
            </Layout>
            {/* <TanStackRouterDevtools /> */}
        </>
    ),
})

const indexRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/',
    component: function Home() {
        return <StartPage />
    },
})

const autoLogRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/auto-login',
    component: function Home() {
        return <Autologin />
    },
})

const newsRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/news',
    component: function News() {
        return <NewsPage />
    },
})

const createAccountRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/create',
    component: function News() {
        return <CreateAccountPage />
    },
})

const offlineRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/offline',
    component: function Offline() {
        return <OfflinePage />
    },
})

const chatRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/chat',
    component: function Chat() {
        return <LobbyPage />
    },
})

const profileRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/profile/$userId',
    component: function Profile({ $userId }) {
        return <PlayerProfilePage />
    },
})

const settingsRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/settings',
    component: function Settings() {
        return <SettingsPage />
    },
})

const routeTree = rootRoute.addChildren([
    indexRoute,
    autoLogRoute,
    newsRoute,
    offlineRoute,
    chatRoute,
    profileRoute,
    settingsRoute,
    createAccountRoute,
])

// this allows electron to hash the routing
const memoryHistory = createMemoryHistory({
    initialEntries: ['/auto-login'], // Pass your initial url
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
            <Box backgroundColor="gray.900">
                <RouterProvider router={router} />
            </Box>
        </ChakraProvider>
    </ErrorBoundary>
)
