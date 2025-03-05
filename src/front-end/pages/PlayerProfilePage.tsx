import { useLoginStore } from '../state/store'
import { Button, Stack, Input, Flex } from '@chakra-ui/react'

export default function PlayerProfilePage() {
    const userState = useLoginStore((state) => state.userState)
    return (
        <Stack>
            <Flex>Coming Soon</Flex>
            <div>Current Username: {userState.name}</div>
            {/* <input placeholder="User name" type="text" />
            <div> Here you can set your favorite character and see stats from matches </div>
            <div> match settings</div>
            <div> recent matches</div>
            <button
                onClick={() => {
                    console.log('save profile')
                }}
            >
                {' '}
                Save{' '}
            </button> */}
        </Stack>
    )
}
