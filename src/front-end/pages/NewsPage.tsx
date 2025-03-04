import { Bleed, Box, Heading, Stack, Text, Flex } from '@chakra-ui/react'
import BlogPost from '../components/BlogPost'

const blogsArray = [
    {
        title: 'Hyper Reflector Alpha!',
        date: '3/4/2025',
        content: 'Welcome to the alpha, hop in the discord',
    },
]

export default function NewsPage() {
    return (
        <Stack gap="2">
            <Heading size="md">Updates</Heading>
            <Stack>
                {blogsArray.map((blog) => (
                    <BlogPost blog={blog} />
                ))}
            </Stack>
        </Stack>
    )
}
