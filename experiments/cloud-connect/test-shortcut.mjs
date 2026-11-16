import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { test, after } from 'node:test';

const { webkit } = await import(process.env.PLAYWRIGHT_MODULE
    ? pathToFileURL(process.env.PLAYWRIGHT_MODULE).href : 'playwright');
const generated = await mkdtemp(join(tmpdir(), 'cloud-connect-shortcut-'));
execFileSync(process.env.PYTHON || 'python', [fileURLToPath(new URL('./build_shortcut.py', import.meta.url)), generated]);
const scripts = Object.fromEntries(await Promise.all(['enable', 'restore', 'status'].map(async key => [key, await readFile(join(generated, key + '.js'), 'utf8')])));
const workflow = JSON.parse(await readFile(join(generated, 'workflow.json'), 'utf8'));
const userscript = await readFile(new URL('./cloud-connect.user.js', import.meta.url), 'utf8');
const browser = await webkit.launch();
after(async () => { await browser.close(); await rm(generated, { recursive: true }); });
const origin = 'https://play.xbox.com';
const backupKey = 'bx-cloud-connect-test.original.v1';

async function setup(url = origin, init) {
    const context = await browser.newContext();
    await context.route('**/*', route => route.fulfill({ contentType: 'text/html', body: '<html><body>Fixture</body></html>' }));
    if (init) await context.addInitScript(init);
    const page = await context.newPage();
    await page.goto(url);
    return { context, page };
}
async function run(page, mode) {
    return page.evaluate(code => {
        const results = [];
        window.completion = value => results.push(value);
        (0, eval)(code);
        if (results.length !== 1) throw new Error('Expected exactly one synchronous completion');
        return results[0];
    }, scripts[mode]);
}
async function setConfig(context, value) {
    await context.addCookies([{ name: 'configs', value: encodeURIComponent(value), url: origin }]);
}
async function config(context) {
    const cookie = (await context.cookies()).find(c => c.name === 'configs');
    return cookie ? decodeURIComponent(cookie.value) : null;
}

test('workflow advertises Safari share sheet and explicitly wires original webpage into every branch', () => {
    assert.deepEqual(workflow.WFWorkflowTypes, ['ActionExtension']);
    assert.deepEqual(workflow.WFWorkflowInputContentItemClasses, ['WFSafariWebPageContentItem']);
    const actions = workflow.WFWorkflowActions;
    const js = actions.filter(a => a.WFWorkflowActionIdentifier.endsWith('.runjavascriptonwebpage'));
    assert.equal(js.length, 3);
    for (const action of js) assert.deepEqual(action.WFWorkflowActionParameters.WFInput,
        { Value: { Type: 'ExtensionInput' }, WFSerializationType: 'WFTextTokenAttachment' });
    for (const mode of ['enable', 'restore', 'status']) assert.ok(js.some(a => a.WFWorkflowActionParameters.WFJavaScript === scripts[mode]));
    assert.deepEqual(actions.filter(a => a.WFWorkflowActionIdentifier.endsWith('.showresult')).map(a => a.WFWorkflowActionParameters.Text.Value.attachmentsByRange['{0, 1}'].OutputUUID), js.map(a => a.WFWorkflowActionParameters.UUID));
});

test('enable and restore complete without navigation and preserve unrelated settings', async () => {
    const { context, page } = await setup();
    try {
        await setConfig(context, 'other:keep%3Bencoded;accs.ux.enable:false');
        let navigations = 0;
        page.on('framenavigated', () => navigations++);
        assert.match(await run(page, 'enable'), /settings enabled/);
        assert.equal(await config(context), 'other:keep%3Bencoded;accs.infra.enable:true;accs.ux.enable:true');
        assert.match(await run(page, 'restore'), /settings restored/);
        assert.equal(await config(context), 'other:keep%3Bencoded;accs.ux.enable:false');
        await page.waitForTimeout(100);
        assert.equal(navigations, 0);
    } finally { await context.close(); }
});

test('status is read-only and does not claim controller connection', async () => {
    const { context, page } = await setup();
    try {
        assert.match(await run(page, 'status'), /not both enabled/);
        assert.equal(await config(context), null);
        await run(page, 'enable');
        const before = await config(context);
        assert.match(await run(page, 'status'), /does not verify a controller connection/);
        assert.equal(await config(context), before);
    } finally { await context.close(); }
});

test('Shortcut restores the userscript original settings', async () => {
    const { context, page } = await setup();
    try {
        await page.addScriptTag({ content: userscript });
        await page.locator('details').evaluate(el => { el.open = true; });
        await Promise.all([page.waitForEvent('load'), page.getByRole('button', { name: 'Enable and reload' }).click()]);
        assert.match(await run(page, 'restore'), /settings restored/);
        assert.equal(await config(context), null);
    } finally { await context.close(); }
});

test('userscript restores the Shortcut original settings', async () => {
    const { context, page } = await setup();
    try {
        await setConfig(context, 'accs.infra.enable:false');
        await run(page, 'enable');
        await page.addScriptTag({ content: userscript });
        await page.locator('details').evaluate(el => { el.open = true; });
        await Promise.all([page.waitForEvent('load'), page.getByRole('button', { name: 'Restore and reload' }).click()]);
        assert.equal(await config(context), 'accs.infra.enable:false');
    } finally { await context.close(); }
});

test('wrong origin completes with an instruction and no mutation', async () => {
    const { context, page } = await setup('https://example.com/');
    try {
        assert.match(await run(page, 'enable'), /Open https:\/\/play.xbox.com\//);
        assert.equal((await context.cookies()).length, 0);
        assert.equal(await page.evaluate(() => localStorage.length), 0);
    } finally { await context.close(); }
});

test('blocked storage and conflicting URL settings do not mutate cookies', async () => {
    for (const options of [[origin, () => { Storage.prototype.setItem = () => { throw new Error('Storage blocked'); }; }], [origin + '/?configs=accs.ux.enable:false']]) {
        const { context, page } = await setup(...options);
        try {
            assert.match(await run(page, 'enable'), /Cloud Connect: /);
            assert.equal(await config(context), null);
        } finally { await context.close(); }
    }
});

test('external switch changes block restoration and preserve the backup', async () => {
    const { context, page } = await setup();
    try {
        await run(page, 'enable');
        await setConfig(context, 'accs.infra.enable:false;accs.ux.enable:true');
        assert.match(await run(page, 'restore'), /changed outside this test/);
        assert.equal(await config(context), 'accs.infra.enable:false;accs.ux.enable:true');
        assert.notEqual(await page.evaluate(key => localStorage.getItem(key), backupKey), null);
    } finally { await context.close(); }
});
