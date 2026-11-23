'use server'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

import { keystoneClient } from '@/features/dashboard/lib/keystoneClient'
import { PUBLIC_REQUEST_ERROR } from '../lib/security'

type JoinState = { message: string | null; name: string }

// The invitee chose a name and password: create the account from the invite, then sign in and open the dashboard,
// which sends each role to its own desk.
export async function acceptInvite(_prev: JoinState, formData: FormData): Promise<JoinState> {
  const token = String(formData.get('token') || '')
  const name = String(formData.get('name') || '').trim()
  const password = String(formData.get('password') || '')
  if (password !== String(formData.get('confirm') || '')) return { message: 'The two passwords don’t match.', name }
  const accepted = await keystoneClient<{ acceptStaffInvite: { email: string } }>(
    'mutation($token: String!, $name: String!, $password: String!) { acceptStaffInvite(token: $token, name: $name, password: $password) { email } }',
    { token, name, password },
  )
  if (!accepted.success) return { message: accepted.error && accepted.error !== PUBLIC_REQUEST_ERROR ? accepted.error : 'Your account could not be created. Try again.', name }
  const email = accepted.data.acceptStaffInvite.email
  const signedIn = await keystoneClient<{ authenticate: { sessionToken?: string; message?: string } }>(`
    mutation($email: String!, $password: String!) {
      authenticate: authenticateUserWithPassword(email: $email, password: $password) {
        ... on UserAuthenticationWithPasswordSuccess { sessionToken }
        ... on UserAuthenticationWithPasswordFailure { message }
      }
    }`, { email, password })
  if (!signedIn.success || !signedIn.data.authenticate?.sessionToken) redirect('/dashboard/signin')
  const cookieStore = await cookies()
  cookieStore.set('keystonejs-session', signedIn.data.authenticate.sessionToken, {
    secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', httpOnly: true, maxAge: 60 * 60 * 24 * 30,
  })
  redirect('/dashboard')
}
