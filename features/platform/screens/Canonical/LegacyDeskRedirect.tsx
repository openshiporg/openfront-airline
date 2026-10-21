import { redirect } from 'next/navigation'
import { safeDeskReturn } from '@/features/platform/lib/desk-return'

export async function LegacyDeskRedirect({ desk, searchParams }: { desk: string; searchParams?: Promise<Record<string,string|string[]|undefined>> }) {
  const params = searchParams ? await searchParams : {}
  const query = new URLSearchParams()
  for (const [key,value] of Object.entries(params)) if (typeof value === 'string') query.set(key,value)
  return redirect(safeDeskReturn(desk,`/dashboard/platform/${desk}?${query}`))
}
