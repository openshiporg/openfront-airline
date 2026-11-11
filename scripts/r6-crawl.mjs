// Load every storefront and dashboard page as each role and print only PASS/FAIL per page.
// Usage: CRAWL_BASE=<url> CRAWL_LOGINS=/path/logins.json node scripts/r6-crawl.mjs [roles...]
// CRAWL_LOGINS is a JSON file { "<role>": { "email": "...", "password": "..." } } kept outside the repo.
import fs from 'node:fs'
import { chromium } from '/Users/junaid/Code/vibeghost/vibeghost/node_modules/playwright/index.mjs'

const BASE = process.env.CRAWL_BASE
const people = JSON.parse(fs.readFileSync(process.env.CRAWL_LOGINS, 'utf8'))
const roles = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(people)

async function gql(query, cookie) {
  const r = await fetch(BASE + '/api/graphql', { method: 'POST', headers: { 'content-type': 'application/json', ...(cookie ? { cookie } : {}) }, body: JSON.stringify({ query }) })
  return r.json()
}
async function token(who) {
  const p = people[who]
  const r = await fetch(BASE + '/api/graphql', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ query: 'mutation($e:String!,$p:String!){authenticateUserWithPassword(email:$e,password:$p){... on UserAuthenticationWithPasswordSuccess{sessionToken}}}', variables: { e: p.email, p: p.password } }) })
  return (await r.json()).data?.authenticateUserWithPassword?.sessionToken
}
const first = roles[0]
const cookie = 'keystonejs-session=' + await token(first)
const lists = { bookings: 'bookings', offers: 'offers', tickets: 'tickets', disruptions: 'disruptions', payments: 'payments', departures: 'departures', schedules: 'schedules', passengers: 'passengers', inventory: 'inventoryBuckets', refunds: 'refunds', manifests: 'departures', baggage: 'bags', settings: 'carriers' }
const ids = {}
for (const [seg, key] of Object.entries(lists)) {
  const r = await gql(`{${key}(take:1){id}}`, cookie)
  ids[seg] = r.data?.[key]?.[0]?.id
}
const flat = ['shopping', 'bookings', 'recovery', 'network', 'departures', 'operations', 'onboarding'].map(s => '/dashboard/' + s)
const platform = ['stations', 'settings', 'offers', 'tickets', 'disruptions', 'payments', 'bookings', 'flight-ops', 'store-settings', 'network', 'departures', 'schedules', 'passengers', 'fares', 'inventory', 'refunds', 'manifests', 'baggage', 'payment-providers'].map(s => '/dashboard/platform/' + s)
const details = Object.entries(ids).filter(([, v]) => v).map(([s, v]) => `/dashboard/platform/${s}/${v}`)
const nope = ['bookings', 'offers', 'tickets'].map(s => `/dashboard/platform/${s}/nope123`)
const store = ['/', '/destinations', '/status', '/contact', '/help', '/manage-booking', '/check-in', '/manage']
const paths = [...store, ...flat, ...platform, ...details, ...nope]

const b = await chromium.launch({ executablePath: process.env.HOME + '/Library/Caches/ms-playwright/chromium_headless_shell-1254/chrome-headless-shell-mac-arm64/chrome-headless-shell' })
let bad = 0, n = 0
for (const role of roles) {
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, ignoreHTTPSErrors: true })
  const p = await ctx.newPage()
  await p.goto(BASE + '/dashboard/signin')
  await p.fill('input[name=email]', people[role].email)
  await p.fill('input[name=password]', people[role].password)
  await Promise.all([p.waitForURL(u => !u.pathname.includes('signin'), { timeout: 30000 }), p.click('button[type=submit]')])
  for (const path of paths) {
    const r = await p.goto(BASE + path, { waitUntil: 'networkidle', timeout: 60000 }).catch(() => null)
    const txt = await p.evaluate(() => document.body.innerText).catch(() => '')
    const http = r?.status() ?? 0
    const expect404 = path.endsWith('/nope123')
    const broken = !expect404 && /this page could not be loaded|something went wrong|application error/i.test(txt)
    const ok = expect404 ? (http === 404 || /could not be found|\b404\b/i.test(txt)) : http < 500 && http !== 404 && !broken
    n++; if (!ok) bad++
    console.log(`CHECK ${role} ${path}: ${ok ? 'PASS' : 'FAIL'} (${http}${expect404 ? ' expected 404' : ''})`)
  }
  await ctx.close()
}
await b.close()
console.log(`CHECK all pages: ${bad ? 'FAIL' : 'PASS'} (${n} loads, ${bad} failed)`)
