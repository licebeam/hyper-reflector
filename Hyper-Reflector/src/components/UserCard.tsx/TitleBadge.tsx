import { Badge, Box } from '@chakra-ui/react'
import type { TUserTitle } from '../../types/user'

type TitleBadgeProps = {
    title: TUserTitle | null | undefined
}

export default function TitleBadge({ title }: TitleBadgeProps) {
    if (!title?.title) {
        return null
    }

    const borderColor = title.border?.trim() ? title.border : undefined

    return (
        <Box display="inline-flex" marginTop="1">
            <Badge
                size="xs"
                bg={title.bgColor || 'transparent'}
                color={title.color || 'inherit'}
                borderWidth={borderColor ? '1px' : undefined}
                borderColor={borderColor}
            >
                {title.title}
            </Badge>
        </Box>
    )
}

