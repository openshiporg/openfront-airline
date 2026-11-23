'use client'

import Link from 'next/link'
import * as Dialog from '@radix-ui/react-dialog'
import { Menu, UserRound, X } from 'lucide-react'

// The phone and tablet menu: a full-height drawer from the left with its title and close button in one row,
// every passenger page, and the traveler's trips at the foot. Rendered inside the header (no portal) so it
// keeps the storefront's colours.
export function StorefrontMenu({ items, current, tripsHref }: { items: ReadonlyArray<{ href: string; label: string }>; current?: string; tripsHref: string }) {
  return <Dialog.Root>
    <Dialog.Trigger aria-label="Menu" className="af-menu-toggle xl:hidden"><Menu aria-hidden="true" /></Dialog.Trigger>
    <Dialog.Overlay className="af-drawer-scrim" />
    <Dialog.Content aria-describedby={undefined} className="af-drawer">
      <div className="af-drawer-head">
        <Dialog.Title className="af-drawer-title">Menu</Dialog.Title>
        <Dialog.Close aria-label="Close menu" className="af-drawer-close"><X aria-hidden="true" /></Dialog.Close>
      </div>
      <nav aria-label="Passenger services" className="af-drawer-nav">
        {items.map(item => <Dialog.Close asChild key={item.href}>
          <Link href={item.href} aria-current={item.href === current ? 'page' : undefined} className="af-drawer-link">{item.href === '/' ? 'Home' : item.label}</Link>
        </Dialog.Close>)}
      </nav>
      <div className="af-drawer-foot">
        <Dialog.Close asChild><Link href={tripsHref} aria-current={current === tripsHref ? 'page' : undefined} className="af-pill af-pill-primary w-full"><UserRound aria-hidden="true" />My trips</Link></Dialog.Close>
      </div>
    </Dialog.Content>
  </Dialog.Root>
}
