import { Avatar, Box, Flex, Stack, Text } from '@chakra-ui/react'
import { useNavigate } from '@tanstack/react-router'
import { Tooltip } from '../chakra/ui/tooltip'
import { useUserStore } from '../../state/store'
import '/node_modules/flag-icons/css/flag-icons.min.css'
import WinStreakBadge from './WinStreakBadge'

export default function UserCard() {
    const globalLoggedIn = useUserStore((s) => s.globalLoggedIn)
    const globalUser = useUserStore((s) => s.globalUser)
    const navigate = useNavigate()

    const handleNavigate = () => {
        if (!globalUser?.uid) return
        navigate({ to: '/profile/$userId', params: { userId: globalUser.uid } })
    }

    return (
        <Box>
            {globalLoggedIn && (
                <Flex
                    display="flex"
                    alignItems={'center'}
                    gap={'2'}
                    padding={'2'}
                    marginRight={'24px'}
                    cursor="pointer"
                    role="button"
                    tabIndex={0}
                    onClick={handleNavigate}
                    onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault()
                            handleNavigate()
                        }
                    }}
                >
                    <Avatar.Root variant="outline" size={'sm'}>
                        <Avatar.Fallback name={globalUser?.userName} />
                        <Avatar.Image src={globalUser?.userProfilePic} />
                    </Avatar.Root>
                    <Stack spacing="1">
                        <Text fontWeight="semibold" fontSize="sm">
                            {globalUser?.userName || 'Player'}
                        </Text>
                        <WinStreakBadge value={globalUser?.winstreak} compact />
                    </Stack>
                    <Tooltip
                        content={`${globalUser?.countryCode || 'Unknown'}`}
                        openDelay={200}
                        closeDelay={100}
                    >
                        <div>
                            <span
                                //  @ts-ignore // this is needed for the country code css library.
                                class={`fi fi-${globalUser?.countryCode?.toLowerCase() || 'xx'}`}
                            />
                        </div>
                    </Tooltip>
                </Flex>
            )}
        </Box>
    )
}
