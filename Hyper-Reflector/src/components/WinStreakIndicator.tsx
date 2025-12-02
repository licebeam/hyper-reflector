import { Badge, Flex, Text } from '@chakra-ui/react'
import { Flame } from 'lucide-react'

type WinStreakIndicatorProps = {
    value?: number | null
    size?: 'sm' | 'md'
    showLabel?: boolean
}

const HOT_COLOR = '#f97316'
const IDLE_COLOR = '#a0aec0'

export default function WinStreakIndicator({
    value = 0,
    size = 'md',
    showLabel = true,
}: WinStreakIndicatorProps) {
    const safeValue = typeof value === 'number' && Number.isFinite(value) ? Math.max(0, value) : 0
    const isHot = safeValue >= 5
    const fontSize = size === 'sm' ? 'xs' : 'sm'
    const iconSize = size === 'sm' ? 12 : 14

    if (!safeValue && !showLabel) {
        return null
    }

    return (
        <Badge
            display="inline-flex"
            alignItems="center"
            gap="1"
            px={size === 'sm' ? '1.5' : '2'}
            py="0.5"
            borderRadius="full"
            borderWidth="1px"
            borderColor={isHot ? HOT_COLOR : 'gray.600'}
            bg="transparent"
            color={isHot ? HOT_COLOR : IDLE_COLOR}
            fontWeight="semibold"
            fontSize={fontSize}
        >
            <Flex align="center" gap="1">
                <Flame size={iconSize} strokeWidth={2} />
                <Text lineHeight="normal">
                    {showLabel ? 'Streak ' : ''}
                    {safeValue}
                </Text>
            </Flex>
        </Badge>
    )
}
