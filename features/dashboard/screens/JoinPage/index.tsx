import Link from 'next/link'

import { keystoneClient } from '@/features/dashboard/lib/keystoneClient'
import { Logo } from '../../components/Logo'
import { JoinForm } from './JoinForm'

type Props = { searchParams: Promise<{ [key: string]: string | string[] | undefined }> }

export async function JoinPage({ searchParams }: Props) {
  const params = await searchParams
  const token = typeof params.token === 'string' ? params.token : ''
  const preview = token
    ? await keystoneClient<{ staffInvitePreview: { email: string; roleName: string; carrierName: string } | null }>(
      'query($token: String!) { staffInvitePreview(token: $token) { email roleName carrierName } }', { token }, { cache: 'no-store' })
    : null
  const invite = preview?.success ? preview.data.staffInvitePreview : null
  return <main className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
    <div className="w-full max-w-sm">
      <Logo aria-hidden="true" />
      {invite ? <>
        <h1 className="mt-6 text-lg font-semibold text-foreground">Join {invite.carrierName}</h1>
        <p className="mt-2 text-sm text-muted-foreground">You’re invited as <span className="font-medium text-foreground">{invite.roleName}</span>. Choose your name and a password.</p>
        <JoinForm token={token} email={invite.email} />
      </> : <>
        <h1 className="mt-6 text-lg font-semibold text-foreground">This invite link doesn’t work</h1>
        <p className="mt-2 text-sm text-muted-foreground">It has expired or was already used. Ask your administrator to send a new invite.</p>
      </>}
      <p className="mt-6 text-sm"><Link href="/dashboard/signin" className="font-medium text-primary hover:text-primary/90">Already have an account? Sign in</Link></p>
    </div>
  </main>
}
