import {
    Outlet,
    RouterProvider,
    createRouter,
    createRoute,
    createRootRoute,
    createMemoryHistory,
} from '@tanstack/react-router'
import './i18n'
import { ChakraProvider, Box } from '@chakra-ui/react'
import { ColorModeProvider } from './components/chakra/ui/color-mode'
import theme from './theme'
// import ErrorBoundary from './ErrorBoundary'
import Layout from './layout/Layout'
import { Toaster } from './components/chakra/ui/toaster'
import './App.css'
import LoginPage from './pages/LoginPage'
import CreateAccountPage from './pages/CreateAccountPage'
import HomePage from './pages/HomePage'
import SettingsPage from './pages/SettingsPage'
import LobbyPage from './pages/LobbyPage'
import LabPage from './pages/LabPage'
import { useEffect } from 'react'
import { useSettingsStore } from './state/store'
import { useTranslation } from 'react-i18next'
import ProfilePage from './pages/ProfilePage'
import PlayerProfilePage from './pages/PlayerProfilePage'
import {
    ensureDefaultChallengeSound,
    ensureDefaultEmulatorPath,
    ensureDefaultMentionSound,
    ensureDefaultTrainingPath,
} from './utils/pathSettings'

const rootRoute = createRootRoute({
    component: () => (
        <>
            <Layout>
                <Toaster />
                <Outlet />
            </Layout>
        </>
    ),
})

const indexRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/',
    component: function Login() {
        return <LoginPage />
    },
})

const homeRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/home',
    component: function Home() {
        return <HomePage />
    },
})

const createAccountRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/create',
    component: function CreateAccount() {
        return <CreateAccountPage />
    },
})

const lobbyRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/lobby',
    component: function Settings() {
        return <LobbyPage />
    },
})

const labRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/lab',
    component: function Settings() {
        return <LabPage />
    },
})

const settingsRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/settings',
    component: function Settings() {
        return <SettingsPage />
    },
})

const profileRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/profile',
    component: function ProfileExplorer() {
        return <ProfilePage />
    },
})

const profileDetailRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/profile/$userId',
    component: function PlayerProfileRoute() {
        return <PlayerProfilePage />
    },
})

const routeTree = rootRoute.addChildren([
    indexRoute,
    createAccountRoute,
    homeRoute,
    settingsRoute,
    lobbyRoute,
    labRoute,
    profileRoute,
    profileDetailRoute,
])

// this allows electron to hash the routing
const memoryHistory = createMemoryHistory({
    initialEntries: ['/'],
})

const router = createRouter({ routeTree, history: memoryHistory })

declare module '@tanstack/react-router' {
    interface Register {
        router: typeof router
    }
}

function App() {
    const { i18n } = useTranslation()
    const appLanguage = useSettingsStore((s) => s.appLanguage)
    const emulatorPathSetting = useSettingsStore((s) => s.emulatorPath)
    // handle language changes and other effects on load
    useEffect(() => {
        i18n.changeLanguage(appLanguage)
        console.log('app loaded as ', appLanguage)
    }, [emulatorPathSetting])

    useEffect(() => {
        void ensureDefaultEmulatorPath()
    }, [emulatorPathSetting])

    useEffect(() => {
        void ensureDefaultTrainingPath(emulatorPathSetting)
    }, [emulatorPathSetting])

    useEffect(() => {
        void ensureDefaultChallengeSound(emulatorPathSetting)
        void ensureDefaultMentionSound(emulatorPathSetting)
    }, [emulatorPathSetting])

    return (
        <main className="container">
            <ChakraProvider value={theme}>
                <ColorModeProvider>
                    <Box>
                        <RouterProvider router={router} />
                    </Box>
                </ColorModeProvider>
            </ChakraProvider>
        </main>
    )
}

export default App
