import { Box, Heading, Stack, Text, Flex } from '@chakra-ui/react'

export function BlogPost({ blog }: { blog: { content: string; title: string; date: string } }) {
    return (
        <Stack padding={2} gap="0">
            <Flex
                justifyContent={'space-between'}
                backgroundColor={'gray.600'}
                color={'gray.400'}
                padding="2"
            >
                <Heading size="sm">{blog.title}</Heading>
                <Heading alignSelf="flex-end" size="sm">
                    {blog.date}
                </Heading>
            </Flex>
            <Box padding={2} backgroundColor={'gray.800'} minH={200}>
                <Text textStyle={'sm'} color="gray.100">
                    {blog.content}
                </Text>
            </Box>
        </Stack>
    )
}

export default BlogPost
