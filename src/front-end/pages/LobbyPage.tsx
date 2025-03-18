import { Flex, Stack, Tabs, Box } from '@chakra-ui/react'
import ChatWindow from '../components/ChatWindow'
import ChatBar from '../components/ChatBar'
import UsersChat from '../components/UsersChat'

export default function LobbyPage() {
    return (
        <Box height="100%" display='flex' width='100%'>
            <Stack flex='3' minH="100%" overflow='hidden' gap="12px">
                <ChatWindow />
                <ChatBar />
            </Stack>
            <Box flex='1'>
                Users:
                <UsersChat />
            </Box>
        </Box>
    )
}
