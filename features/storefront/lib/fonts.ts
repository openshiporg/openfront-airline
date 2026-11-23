import { Figtree } from 'next/font/google'

// One family for the whole storefront: Figtree's light weight sets the display lines (with a true italic for the
// accented word), its medium and bold weights carry labels, times and fares.
const figtree = Figtree({ subsets: ['latin'], style: ['normal', 'italic'], variable: '--af-font-body', display: 'swap' })

export const storefrontFontVariables = figtree.variable
// The family itself, for the popovers that portal outside the storefront frame.
export const storefrontFontFamily = figtree.style.fontFamily
