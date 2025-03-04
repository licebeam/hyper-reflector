import { Bleed, Box, Heading, Stack, Text } from '@chakra-ui/react'

const Demo = () => {
    return (
        <Box padding="10" rounded="sm" borderWidth="1px">
            <Bleed inline="10">
                <div>test</div>
            </Bleed>

            <Stack mt="6">
                <Heading size="md">Some Heading</Heading>
                <Text>Lorem ipsum dolor sit amet, consectetur adipiscing elit.</Text>
            </Stack>
        </Box>
    )
}

export default function NewsPage() {
    return (
        <>
            <Demo />
            <div> Here is news about development </div>
        </>
    )
}
