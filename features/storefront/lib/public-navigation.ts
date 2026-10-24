export const publicNavigation = [
  { href: '/', label: 'Book' },
  { href: '/destinations', label: 'Destinations' },
  { href: '/status', label: 'Flight status' },
  { href: '/check-in', label: 'Check in' },
  { href: '/manage-booking', label: 'Manage booking' },
  { href: '/help', label: 'Help' },
  { href: '/contact', label: 'Contact' },
] as const

export const publicRouteAliases = {
  '/manage': '/manage-booking',
} as const
