import { invoke } from '@tauri-apps/api/core'
import { Box, Button, Card, IconButton, Text } from '@chakra-ui/react'
import { open } from '@tauri-apps/plugin-dialog'
import { toaster } from '../components/chakra/ui/toaster'
import { useSettingsStore } from '../state/store'
import { Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import {
    ensureDefaultEmulatorPath,
    ensureDefaultTrainingPath,
} from '../utils/pathSettings'

export default function LabPage() {
    const { t } = useTranslation()
    const theme = useSettingsStore((s) => s.theme)
    const setTrainingPath = useSettingsStore((s) => s.setTrainingPath)
    const trainingPath = useSettingsStore((s) => s.trainingPath)

    async function handleStartTraining() {
        try {
            await ensureDefaultEmulatorPath()
            const { emulatorPath: ensuredEmulatorPath } = useSettingsStore.getState()

            if (!ensuredEmulatorPath || !ensuredEmulatorPath.trim().length) {
                toaster.error({
                    title: t('Lab.errorPath'),
                    description: 'Set or bundle an emulator before starting training.',
                })
                return
            }

            await ensureDefaultTrainingPath(ensuredEmulatorPath)
            const { trainingPath: ensuredTrainingPath } = useSettingsStore.getState()

            const args = ['--rom', 'sfiii3nr1']
            if (ensuredTrainingPath && ensuredTrainingPath.trim().length) {
                args.push('--lua', ensuredTrainingPath)
            }

            await invoke('start_training_mode', {
                useSidecar: false,
                exePath: ensuredEmulatorPath,
                args,
            })
        } catch (error) {
            console.error('Failed to start training mode:', error)
            toaster.error({
                title: 'Failed to start training',
                description:
                    error instanceof Error ? error.message : 'Unknown error launching emulator',
            })
        }
    }

    const pickLua = async () => {
        try {
            const res = await open({
                multiple: false,
                directory: false,
                title: t('Lab.dialogLua'),
                filters: [{ name: 'Lua scripts', extensions: ['lua', 'luac'] }],
            })
            console.log('res', res)
            if (typeof res === 'string') setTrainingPath(res)
        } catch (err: any) {
            toaster.error({
                title: t('Lab.errorPath'),
                description: err,
            })
        }
    }

    return (
        <div>
            <Card.Root overflow="hidden" flex={'1'}>
                <Card.Body gap="2">
                    <Card.Title>{t('Lab.title')}</Card.Title>
                    <Button
                        colorPalette={theme.colorPalette}
                        maxW="1/2"
                        onClick={handleStartTraining}
                    >
                        {t('Lab.start')}
                    </Button>
                    <Text textStyle="xs">
                        {t('Lab.currentPath')} {trainingPath || 'Default'}
                    </Text>
                    <Box display="flex" gap="2">
                        <Button colorPalette={theme.colorPalette} maxW="1/2" onClick={pickLua}>
                            {t('Lab.setLua')}
                        </Button>
                        {trainingPath && (
                            <IconButton
                                colorPalette={'red'}
                                colorScheme="blue"
                                onClick={() => {
                                    setTrainingPath('')
                                }}
                            >
                                <Trash2 />
                            </IconButton>
                        )}
                    </Box>
                </Card.Body>
            </Card.Root>
        </div>
    )
}
