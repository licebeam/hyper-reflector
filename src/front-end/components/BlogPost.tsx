import { Box, Heading, Stack, Text, Flex } from '@chakra-ui/react'
import { useLayoutStore } from '../state/store'

export function BlogPost({ blog }: { blog: { content: string; title: string; date: string } }) {
    const theme = useLayoutStore((state) => state.appTheme)
    return (
        <Stack padding={2} gap="0">
            <Flex
                justifyContent={'space-between'}
                backgroundColor={theme.colors.main.tertiary}
                color={theme.colors.main.bg}
                padding="2"
            >
                <Heading size="sm">{blog.title}</Heading>
                <Heading alignSelf="flex-end" size="sm">
                    {blog.date}
                </Heading>
            </Flex>
            <Box padding={2} backgroundColor={theme.colors.main.secondary} minH={200}>
                <Text textStyle={'sm'} color={theme.colors.main.text}>
                    {blog.content}
                </Text>
            </Box>
        </Stack>
    )
}

export default BlogPost
