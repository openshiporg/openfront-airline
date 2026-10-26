import { Archivo } from 'next/font/google'

// One family, as on a printed pocket timetable: Archivo's width axis sets the condensed display caps and the
// normal-width text; tabular figures carry times and fares.
const archivo = Archivo({ subsets: ['latin'], axes: ['wdth'], variable: '--af-font-body', display: 'swap' })

export const storefrontFontVariables = archivo.variable
