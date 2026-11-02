// Demo-account guard: features/keystone/lib/demo-guard.ts. Offline, no DB.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');

function load(relative) {
  const filename = path.resolve(root, relative);
  const output = ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
  } }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(output, { module, exports: module.exports, require, process, Symbol }, { filename });
  return module.exports;
}

const guard = load('features/keystone/lib/demo-guard.ts');
const { DEMO_GUARD_MESSAGE, withDemoGuard, DEMO_GUARD_POLICY, rewriteDemoErrors } = guard;
const env = { DEMO_USER_EMAILS: ' Other@example.com , AIRLINE@openship.org ' };

const DEMO = { itemId: 'demo', listKey: 'User', data: { email: 'airline@openship.org' } };
const ADMIN = { itemId: 'admin', listKey: 'User', data: { email: 'owner@openship.org' } };

// Lists shaped like the real ones; Booking carries an existing hook to prove it still runs.
let bookingHookRan = 0;
const names = ['User','Role','PaymentProvider','ProviderConnection','IntegrationProvider','WebhookEndpoint','MachineCredential','Carrier','Payment','Refund','Ticket','Passenger','Route','FlightSchedule','FlightInstance','AncillaryProduct','ApprovedAgent','Offer'];
const defs = Object.fromEntries(names.map((n) => [n, { fields: {} }]));
defs.Booking = { fields: {}, hooks: { beforeOperation: { update: () => { bookingHookRan++; } } } };
const lists = withDemoGuard(defs, DEMO_GUARD_POLICY, env);

function run(listKey, operation, session, { item, inputData } = {}) {
  const context = { session, sudo: () => context };
  const hook = lists[listKey].hooks?.beforeOperation;
  const fn = typeof hook === 'function' ? hook : hook?.[operation];
  if (!fn) return Promise.resolve();
  return fn({ listKey, operation, context, item, inputData, resolvedData: inputData });
}

async function refused(promise) {
  await assert.rejects(promise, (error) => error.message === DEMO_GUARD_MESSAGE);
}

test('the exact copy', () => {
  assert.equal(DEMO_GUARD_MESSAGE, "Demo accounts can't change this.");
});

test('demo + identity changes refused', async () => {
  for (const inputData of [{ password: 'x' }, { email: 'a@b.c' }, { name: 'X' }, { role: { connect: { id: 'r' } } }, { carrier: { connect: { id: 'c' } } }])
    await refused(run('User', 'update', DEMO, { item: { id: 'demo' }, inputData }));
  await refused(run('User', 'update', DEMO, { item: { id: 'admin' }, inputData: { password: 'x' } }));
  await refused(run('User', 'create', DEMO, { inputData: { name: 'New' } }));
  await refused(run('User', 'delete', DEMO, { item: { id: 'admin' } }));
  await refused(run('Role', 'update', DEMO, { item: { id: 'r' }, inputData: { name: 'Y' } }));
});

test('demo + locked credential lists refused', async () => {
  for (const key of ['PaymentProvider', 'ProviderConnection', 'IntegrationProvider', 'WebhookEndpoint', 'MachineCredential']) {
    await refused(run(key, 'update', DEMO, { item: { id: 'x' }, inputData: { credentials: {} } }));
    await refused(run(key, 'create', DEMO, { inputData: {} }));
    await refused(run(key, 'delete', DEMO, { item: { id: 'x' } }));
  }
});

test('demo + delete of a business record refused, create and update allowed', async () => {
  for (const key of ['Carrier', 'Booking', 'Payment', 'Refund', 'Ticket', 'Passenger', 'Route', 'FlightSchedule', 'FlightInstance', 'AncillaryProduct', 'ApprovedAgent'])
    await refused(run(key, 'delete', DEMO, { item: { id: 'x' } }));
  for (const key of ['Booking', 'Passenger', 'Route', 'FlightSchedule', 'AncillaryProduct', 'Payment']) {
    await run(key, 'create', DEMO, { inputData: { any: 1 } });
    await run(key, 'update', DEMO, { item: { id: 'x' }, inputData: { any: 2 } });
  }
  assert.equal(bookingHookRan, 1, 'the existing Booking hook still runs');
});

test('demo + unchanged protected values allowed (own record)', async () => {
  await run('User', 'update', DEMO, { item: { id: 'demo' }, inputData: { onboardingStatus: 'dismissed' } });
});

test('demo + carrier name, storefront copy and prices ALLOWED', async () => {
  const item = { id: 'c', name: 'Airline', code: 'AL' };
  await run('Carrier', 'update', DEMO, { item, inputData: { name: 'Airline QA', storefrontHomepageTitle: 'Fly', storefrontBrandColor: 'blue' } });
  await run('Offer', 'delete', DEMO, { item: { id: 'o' } });
});

test('a non-demo admin is unaffected', async () => {
  await run('User', 'update', ADMIN, { item: { id: 'demo' }, inputData: { password: 'x', email: 'a@b.c', role: {} } });
  await run('User', 'create', ADMIN, { inputData: { name: 'New' } });
  await run('Role', 'update', ADMIN, { item: { id: 'r' }, inputData: { name: 'Y' } });
  await run('PaymentProvider', 'update', ADMIN, { item: { id: 'p' }, inputData: { credentials: {} } });
  await run('Booking', 'delete', ADMIN, { item: { id: 'b' } });
  await run('Carrier', 'delete', ADMIN, { item: { id: 'c' } });
  await run('User', 'update', null, { item: { id: 'x' }, inputData: { password: 'x' } });
});

test('a session without data.email is resolved from the user record', async () => {
  const session = { itemId: 'demo', listKey: 'User' };
  const context = { session, sudo: () => ({ db: { User: { findOne: async () => ({ email: 'Airline@Openship.org' }) } } }) };
  await refused(lists.User.hooks.beforeOperation({ listKey: 'User', operation: 'update', context, item: { id: 'demo' }, inputData: { password: 'x' } }));
});

test('empty DEMO_USER_EMAILS is inert', async () => {
  const open = withDemoGuard({ Role: { fields: {} }, Booking: { fields: {} } }, DEMO_GUARD_POLICY, {});
  await open.Role.hooks.beforeOperation({ listKey: 'Role', operation: 'delete', context: { session: DEMO }, item: { id: 'r' } });
  await open.Booking.hooks.beforeOperation({ listKey: 'Booking', operation: 'delete', context: { session: DEMO }, item: { id: 'r' } });
});

test('Keystone\'s hook wrapper is rewritten to the exact copy', () => {
  const wrapped = { message: `An error occurred while running "beforeOperation".\n  - Role.hooks.beforeOperation: ${DEMO_GUARD_MESSAGE}`, path: ['updateRole'] };
  const other = { message: 'Something else' };
  const result = rewriteDemoErrors({ data: { updateRole: null }, errors: [wrapped, other] });
  assert.equal(result.errors[0].message, DEMO_GUARD_MESSAGE);
  assert.equal(result.errors[0].extensions.code, 'KS_ACCESS_DENIED');
  assert.equal(result.errors[1], other);
});

test('the guard is wired into the Keystone config and the GraphQL route', () => {
  const config = fs.readFileSync(path.join(root, 'features/keystone/index.ts'), 'utf8');
  assert.match(config, /lists: withDemoGuard\(models\)/);
  const route = fs.readFileSync(path.join(root, 'pages/api/graphql.ts'), 'utf8');
  assert.match(route, /useDemoGuardErrors\(\)/);
});
