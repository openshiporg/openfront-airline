import { Barlow_Condensed, Hanken_Grotesk, IBM_Plex_Mono } from 'next/font/google'

// Display: condensed signage type, as on airport wayfinding. Body: Hanken Grotesk. Readouts: IBM Plex Mono.
const display = Barlow_Condensed({ subsets: ['latin'], weight: ['500', '600', '700'], variable: '--af-font-display', display: 'swap' })
const body = Hanken_Grotesk({ subsets: ['latin'], variable: '--af-font-body', display: 'swap' })
const mono = IBM_Plex_Mono({ subsets: ['latin'], weight: ['400', '500', '600'], variable: '--af-font-mono', display: 'swap' })

export const storefrontFontVariables = `${display.variable} ${body.variable} ${mono.variable}`
