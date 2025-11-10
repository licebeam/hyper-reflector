import { Stack } from '@chakra-ui/react'

export default function SideBar({ children, width }) {
    return (
        <Stack overflowY="auto" w={width} scrollbarWidth={'thin'}>
            {children}
        </Stack>
    )
}
