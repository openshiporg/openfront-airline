// Store Settings logo: save path and storefront render rule. Offline.
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
  const localRequire = (spec) => spec.startsWith('.') ? load(path.relative(root, path.resolve(path.dirname(filename), spec.endsWith('.ts') ? spec : `${spec}.ts`))) : require(spec);
  vm.runInNewContext(output, { module, exports: module.exports, require: localRequire }, { filename });
  return module.exports;
}
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');

const { sanitizeStoreLogoSvg } = load('features/keystone/utils/storeLogo.ts');
const { normalizeStoreLogoColor, DEFAULT_STORE_LOGO_COLOR, DEFAULT_STORE_LOGO_ICON } = load('features/platform/store-settings/lib/store-logo.ts');
const { LOGO_ICONS } = load('features/platform/store-settings/lib/icon-registry.ts');

// Mirrors updateStorefrontSettings in features/platform/store-settings/actions.ts.
function payload(data) {
  const logoIcon = data.logoIcon ? sanitizeStoreLogoSvg(data.logoIcon) : undefined;
  if (data.logoIcon && !logoIcon) return { success: false, error: 'Invalid SVG format' };
  const logoColor = data.logoColor === undefined || data.logoColor === null ? undefined : normalizeStoreLogoColor(data.logoColor);
  return { success: true, data: { ...data, logoIcon, logoColor } };
}

test('the action composes sanitize, normalize, mutation, revalidate in order', () => {
  const source = read('features/platform/store-settings/actions.ts');
  const at = (re) => source.search(re);
  assert.ok(at(/sanitizeStoreLogoSvg\(input\.logoIcon\)/) >= 0);
  assert.ok(at(/sanitizeStoreLogoSvg\(/) < at(/normalizeStoreLogoColor\(input\.logoColor\)/));
  assert.ok(at(/normalizeStoreLogoColor\(input/) < at(/updateCarrierStorefrontSettings\(name:/));
  assert.ok(at(/updateCarrierStorefrontSettings\(name:/) < at(/revalidatePath\(path\)/));
  assert.match(source, /sanitizedData\)/);
});

test('a preset icon and hue reach the mutation unchanged', () => {
  const icon = LOGO_ICONS[0].lightSvg;
  const data = payload({ name: 'Northwind', logoIcon: icon, logoColor: '120' }).data;
  assert.deepEqual([data.name, data.logoIcon, data.logoColor], ['Northwind', icon, '120']);
});

test('partial saves keep stored fields', () => {
  const data = payload({ name: 'Northwind' }).data;
  assert.equal(data.logoIcon, undefined);
  assert.equal(data.logoColor, undefined);
});

test('every preset survives the sanitizer', () => {
  for (const icon of LOGO_ICONS) assert.equal(payload({ logoIcon: icon.lightSvg }).success, true, icon.id);
});

test('a pasted custom SVG is kept, trimmed', () => {
  const svg = '<svg fill="none" height="100%" viewBox="0 0 48 48" width="100%" xmlns="http://www.w3.org/2000/svg"><path d="m48 11h-17z" fill="#087443"/></svg>';
  assert.equal(payload({ logoIcon: `\n${svg} ` }).data.logoIcon, svg);
});

test('the hue is normalized to 0-359', () => {
  assert.equal(payload({ logoColor: '-90' }).data.logoColor, '270');
  assert.equal(payload({ logoColor: '400' }).data.logoColor, '40');
  assert.equal(payload({ logoColor: 'red' }).data.logoColor, DEFAULT_STORE_LOGO_COLOR);
});

test('an unsafe SVG rejects the save', () => {
  assert.deepEqual(payload({ logoIcon: '<svg onload="alert(1)"></svg>' }), { success: false, error: 'Invalid SVG format' });
});

test('the model sanitizes, validates and normalizes the logo fields', () => {
  const model = read('features/keystone/models/Carrier.ts');
  assert.match(model, /sanitizeStoreLogoSvg\(value\)/);
  assert.match(model, /Logo must be a valid, safe SVG document/);
  assert.match(model, /normalizeStoreLogoColor\(value\)/);
  assert.match(model, /defaultValue: DEFAULT_STORE_LOGO_ICON/);
  assert.match(read('features/keystone/mutations/index.ts'), /logoIcon: String\n\s+logoColor: String\n\s+storefrontHomepageTitle/);
});

test('storefront always renders the icon beside the name, header and footer, default when empty', () => {
  const chrome = read('features/storefront/components/StorefrontChrome.tsx');
  assert.match(chrome, /carrier\.logoIcon\?\.trim\(\) \|\| DEFAULT_STORE_LOGO_ICON/);
  assert.match(chrome, /hue-rotate\(/);
  assert.equal((chrome.match(/<CarrierMark carrier=\{carrier\}/g) || []).length, 2);
  assert.doesNotMatch(chrome, /storeOwnMark/);
  assert.ok(DEFAULT_STORE_LOGO_ICON.startsWith('<svg'));
});
