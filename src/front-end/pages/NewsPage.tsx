import { Bleed, Box, Heading, Stack, Text, Flex } from '@chakra-ui/react'
import BlogPost from '../components/BlogPost'

const blogsArray = [
    {
        title: 'Update Version 0.1.8a',
        date: '3/13/2025',
        content: 'adding content',
    },
    {
        title: 'Update Version 0.1.7a',
        date: '3/10/2025',
        content:
            'Update v0.1.7a is here, no longer are we reliant on UPNP to manage connections you can see the full changelog on discord, sorry I will eventually fix up the news page!!',
    },
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
