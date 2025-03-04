import { Text, Heading, Stack, Button } from '@chakra-ui/react'

export default function SettingsPage() {
    return (
        <Stack gap={2}>
            <Heading size="md">Application Settings</Heading>
            <Stack gap={6}>
                <Text textStyle="xs">
                    This is where we can set our emulator path and other setting
                </Text>
                <Button
                    onClick={() => {
                        window.api.setEmulatorPath()
                    }}
                >
                    Set Emulator Path
                </Button>
                <Text textStyle="xs">
                    You may need to restart the application if the emulator does not open automatically.
                </Text>
            </Stack>
        </Stack>
    )
}
