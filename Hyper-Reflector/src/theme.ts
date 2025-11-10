import { defaultConfig, defineConfig, createSystem } from '@chakra-ui/react'

const config = defineConfig({
    theme: {
        // breakpoints: {
        //     sm: "320px",
        //     md: "768px",
        //     lg: "960px",
        //     xl: "1200px",
        // },
        // tokens: {
        //     colors: {
        //         Arctic: "#ffff",
        //     },
        // },
        // semanticTokens: {
        //     colors: {
        //         danger: { value: "{colors.blue}" },
        //     },
        // },
        // keyframes: {
        //     spin: {
        //         from: { transform: "rotate(0deg)" },
        //         to: { transform: "rotate(360deg)" },
        //     },
        // },
    },
})

export default createSystem(defaultConfig, config)