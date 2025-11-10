// src/themes.ts
import { extendTheme, type Theme, type ThemeConfig } from '@chakra-ui/react';

const baseConfig: ThemeConfig = {
    initialColorMode: 'system',
    useSystemColorMode: true,
};

// helper to create a theme with a “brand” palette + some semantic tokens
function makeTheme(opts: {
    label: string;
    brand: Record<number, string>; // 50..900 steps
    bgLight?: string;
    bgDark?: string;
    fontHeading?: string;
    fontBody?: string;
}) {
    return extendTheme({
        config: baseConfig,
        fonts: {
            heading: opts.fontHeading ?? `'Inter Variable', system-ui, sans-serif`,
            body: opts.fontBody ?? `'Inter Variable', system-ui, sans-serif`,
        },
        colors: {
            brand: opts.brand,
        },
        // semantic tokens so your app can use stable names like "app.bg" & "app.fg"
        semanticTokens: {
            colors: {
                'app.bg': { default: opts.bgLight ?? 'gray.50', _dark: opts.bgDark ?? 'gray.900' },
                'app.card': { default: 'white', _dark: 'gray.800' },
                'app.fg': { default: 'gray.800', _dark: 'gray.100' },
                'app.accent': { default: 'brand.600', _dark: 'brand.400' },
            },
            radii: {
                'app.rounded': 'xl',
            },
        },
        components: {
            Button: {
                defaultProps: {
                    colorScheme: 'brand', // makes your primary buttons follow the theme’s brand
                },
            },
        },
    }) as Theme & { __label?: string };
}

// three example themes
export const themes = {
    default: makeTheme({
        label: 'Default (Purple)',
        brand: {
            50: '#f5f3ff', 100: '#ede9fe', 200: '#ddd6fe', 300: '#c4b5fd',
            400: '#a78bfa', 500: '#8b5cf6', 600: '#7c3aed', 700: '#6d28d9',
            800: '#5b21b6', 900: '#4c1d95',
        },
    }),
    midnight: makeTheme({
        label: 'Midnight (Teal)',
        brand: {
            50: '#f0fdfa', 100: '#ccfbf1', 200: '#99f6e4', 300: '#5eead4',
            400: '#2dd4bf', 500: '#14b8a6', 600: '#0d9488', 700: '#0f766e',
            800: '#115e59', 900: '#134e4a',
        },
        bgLight: 'gray.100',
        bgDark: 'gray.950',
    }),
    neon: makeTheme({
        label: 'Neon (Pink)',
        brand: {
            50: '#fdf2f8', 100: '#fce7f3', 200: '#fbcfe8', 300: '#f9a8d4',
            400: '#f472b6', 500: '#ec4899', 600: '#db2777', 700: '#be185d',
            800: '#9d174d', 900: '#831843',
        },
    }),
} as const;

// human-friendly labels for a dropdown
export const themeOptions = [
    { value: 'default', label: 'Default (Purple)' },
    { value: 'midnight', label: 'Midnight (Teal)' },
    { value: 'neon', label: 'Neon (Pink)' },
] as const;

export type ThemeName = typeof themeOptions[number]['value'];
