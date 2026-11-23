'use client'

import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { acceptInvite } from '@/features/dashboard/actions/staffInvite'

function Submit() {
  const { pending } = useFormStatus()
  return <Button type="submit" className="w-full" disabled={pending}>{pending ? 'Setting up…' : 'Create my account'}</Button>
}

export function JoinForm({ token, email }: { token: string; email: string }) {
  const [state, action] = useActionState(acceptInvite, { message: null, name: '' })
  return <form action={action} className="mt-6 space-y-4">
    <input type="hidden" name="token" value={token} />
    <div>
      <Label htmlFor="email">Email</Label>
      <Input id="email" value={email} readOnly className="mt-2 bg-muted/40" autoComplete="username" />
    </div>
    <div>
      <Label htmlFor="name">Your name</Label>
      <Input id="name" name="name" defaultValue={state.name} required maxLength={120} autoComplete="name" className="mt-2" />
    </div>
    <div>
      <Label htmlFor="password">Password</Label>
      <Input id="password" name="password" type="password" required minLength={10} autoComplete="new-password" className="mt-2" />
      <p className="mt-1.5 text-xs text-muted-foreground">At least 10 characters.</p>
    </div>
    <div>
      <Label htmlFor="confirm">Password again</Label>
      <Input id="confirm" name="confirm" type="password" required minLength={10} autoComplete="new-password" className="mt-2" />
    </div>
    {state.message && <p role="alert" className="text-sm text-destructive">{state.message}</p>}
    <Submit />
  </form>
}
