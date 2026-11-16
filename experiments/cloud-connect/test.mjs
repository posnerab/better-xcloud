import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';
import { test, after } from 'node:test';

const { chromium, webkit } = await import(process.env.PLAYWRIGHT_MODULE
    ? pathToFileURL(process.env.PLAYWRIGHT_MODULE).href : 'playwright');
const engine = process.env.BROWSER_ENGINE || 'chromium';
const browser = engine === 'webkit' ? await webkit.launch() : await chromium.launch({ channel: 'msedge' });
after(() => browser.close());
const script = await readFile(new URL('./cloud-connect.user.js', import.meta.url), 'utf8');
const origin = 'https://play.xbox.com';
const backupKey = 'bx-cloud-connect-test.original.v1';

async function setup({ configs, url = origin, init } = {}) {
    const context = await browser.newContext();
    await context.route('**/*', route => route.fulfill({ contentType: 'text/html', body: `<html><body><h1>Xbox fixture</h1><script>${script}</script></body></html>` }));
    await context.addCookies([{ name: 'unrelated', value: 'sentinel', url: origin }]);
    if (configs !== undefined) await context.addCookies([{ name: 'configs', value: encodeURIComponent(configs), url: origin }]);
    if (init) await context.addInitScript(init);
    const page = await context.newPage();
    await page.goto(url);
    return { context, page };
}
async function entries(context) {
    const cookies = await context.cookies(origin);
    assert.equal(cookies.find(c => c.name === 'unrelated')?.value, 'sentinel');
    const config = cookies.find(c => c.name === 'configs');
    return config ? decodeURIComponent(config.value).split(';') : [];
}
async function click(page, text, reload = true) {
    await page.locator('details').evaluate(el => { el.open = true; });
    if (reload) {
        await Promise.all([page.waitForEvent('load'), page.getByRole('button', { name: text }).click()]);
    } else await page.getByRole('button', { name: text }).click();
}

test('enable, reload, retain unrelated new settings, and restore original values', async () => {
    const { context, page } = await setup({ configs: 'video:test%3Bvalue;accs.infra.enable:false' });
    try {
        await click(page, 'Enable and reload');
        assert.deepEqual(await entries(context), ['video:test%3Bvalue', 'accs.infra.enable:true', 'accs.ux.enable:true']);
        const backup = await page.evaluate(key => JSON.parse(localStorage.getItem(key)), backupKey);
        assert.deepEqual(backup, { version: 1, entries: ['accs.infra.enable:false'] });
        await context.addCookies([{ name: 'configs', value: encodeURIComponent((await entries(context)).join(';') + ';new.setting:keep'), url: origin }]);
        await click(page, 'Restore and reload');
        assert.deepEqual(await entries(context), ['video:test%3Bvalue', 'new.setting:keep', 'accs.infra.enable:false']);
        assert.equal(await page.evaluate(key => localStorage.getItem(key), backupKey), null);
    } finally { await context.close(); }
});

test('absent original cookie is removed on restoration; repeated enable retains baseline', async () => {
    const { context, page } = await setup();
    try {
        await click(page, 'Enable and reload');
        await click(page, 'Enable and reload');
        await click(page, 'Restore and reload');
        assert.deepEqual(await entries(context), []);
    } finally { await context.close(); }
});

test('external changes to the tested switches stop restoration', async () => {
    const { context, page } = await setup();
    try {
        await click(page, 'Enable and reload');
        await context.addCookies([{ name: 'configs', value: encodeURIComponent('accs.infra.enable:false;accs.ux.enable:true'), url: origin }]);
        await click(page, 'Restore and reload', false);
        assert.match(await page.locator('details').innerText(), /changed outside this test/);
        assert.deepEqual(await entries(context), ['accs.infra.enable:false', 'accs.ux.enable:true']);
    } finally { await context.close(); }
});

test('conflicting URL settings stop enable', async () => {
    const { context, page } = await setup({ url: origin + '/?configs=accs.ux.enable:false' });
    try {
        await click(page, 'Enable and reload', false);
        assert.match(await page.locator('details').innerText(), /without configuration URL overrides/);
        assert.deepEqual(await entries(context), []);
    } finally { await context.close(); }
});

test('blocked restore storage prevents cookie writes', async () => {
    const { context, page } = await setup({ init: () => { Storage.prototype.setItem = () => { throw new Error('Storage blocked'); }; } });
    try {
        await click(page, 'Enable and reload', false);
        assert.match(await page.locator('details').innerText(), /Storage blocked/);
        assert.deepEqual(await entries(context), []);
    } finally { await context.close(); }
});

test('blocked cookie write retains backup and does not reload', async () => {
    const { context, page } = await setup({ init: () => { Object.defineProperty(document, 'cookie', { get: () => '', set: () => {} }); } });
    try {
        await click(page, 'Enable and reload', false);
        assert.match(await page.locator('details').innerText(), /did not retain/);
        assert.deepEqual(await entries(context), []);
        assert.notEqual(await page.evaluate(key => localStorage.getItem(key), backupKey), null);
        assert.equal(await page.getByRole('button', { name: 'Restore and reload' }).isEnabled(), true);
    } finally { await context.close(); }
});

test('duplicate configuration cookies stop writes', async () => {
    const { context, page } = await setup({ configs: 'other:keep', url: origin + '/test/' });
    try {
        await context.addCookies([{ name: 'configs', value: 'second%3Akeep', domain: 'play.xbox.com', path: '/test/' }]);
        await click(page, 'Enable and reload', false);
        assert.match(await page.locator('details').innerText(), /Multiple Xbox configuration cookies/);
        assert.equal((await context.cookies()).filter(c => c.name === 'configs').length, 2);
    } finally { await context.close(); }
});

test('oversize configuration cookie is preserved', async () => {
    const original = 'other:' + 'x'.repeat(3740);
    const { context, page } = await setup({ configs: original });
    try {
        await click(page, 'Enable and reload', false);
        assert.match(await page.locator('details').innerText(), /too large/);
        assert.deepEqual(await entries(context), [original]);
    } finally { await context.close(); }
});

test('script does not run on another origin', async () => {
    const { context, page } = await setup({ url: 'https://example.com/' });
    try { assert.equal(await page.locator('#bx-cloud-connect-test').count(), 0); }
    finally { await context.close(); }
});
