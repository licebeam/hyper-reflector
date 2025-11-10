import { Badge, Flex, Text } from '@chakra-ui/react'
import { Flame } from 'lucide-react'

type WinStreakBadgeProps = {
    value?: number | null
    compact?: boolean
}

const BASE_COLOR = {
    hot: '#f97316',
    idle: '#a0aec0',
}

export default function WinStreakBadge({ value = 0, compact = false }: WinStreakBadgeProps) {
    const safeValue = typeof value === 'number' && Number.isFinite(value) ? Math.max(0, value) : 0
    const isHot = safeValue >= 5

    return (
        <Badge
            display="inline-flex"
            alignItems="center"
            gap="1"
            px={compact ? '1.5' : '2'}
            py={compact ? '0.5' : '0.5'}
            borderRadius="full"
            borderWidth="1px"
            borderColor={isHot ? BASE_COLOR.hot : 'gray.600'}
            bg="transparent"
            color={isHot ? BASE_COLOR.hot : BASE_COLOR.idle}
            fontWeight="semibold"
            fontSize={compact ? 'xs' : 'sm'}
        >
            <Flex align="center" gap="1">
                <Flame size={compact ? 12 : 14} strokeWidth={2} />
                <Text lineHeight="normal">Streak {safeValue}</Text>
            </Flex>
        </Badge>
    )
}

