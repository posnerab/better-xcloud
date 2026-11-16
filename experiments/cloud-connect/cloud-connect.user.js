// ==UserScript==
// @name         Xbox Cloud Connect Safari Test
// @namespace    https://github.com/posnerab/better-xcloud
// @version      0.1.0
// @description  Reversible test of Xbox Nano Cloud Connect on play.xbox.com.
// @match        https://play.xbox.com/*
// @run-at       document-end
// @grant        none
// @noframes
// ==/UserScript==

(() => {
    'use strict';
    if (location.origin !== 'https://play.xbox.com' || window.top !== window.self) return;
    if (document.getElementById('bx-cloud-connect-test')) return;

    const keys = ['accs.infra.enable', 'accs.ux.enable'];
    const backupKey = 'bx-cloud-connect-test.original.v1';
    const cookieName = 'configs';
    const keyOf = entry => entry.slice(0, entry.indexOf(':')).trim();
    const owned = entry => entry.includes(':') && keys.includes(keyOf(entry));

    function readEntries() {
        const matches = document.cookie.split(';').map(value => value.trim())
            .filter(value => value.startsWith(cookieName + '='));
        if (matches.length > 1) throw new Error('Multiple Xbox configuration cookies found. No changes made.');
        return matches.length ? decodeURIComponent(matches[0].slice(cookieName.length + 1)).split(';').filter(Boolean) : [];
    }

    function readBackup() {
        const raw = localStorage.getItem(backupKey);
        if (raw === null) return null;
        const backup = JSON.parse(raw);
        if (backup.version !== 1 || !Array.isArray(backup.entries) ||
            !backup.entries.every(entry => typeof entry === 'string' && owned(entry))) {
            throw new Error('Saved restore data is invalid. No changes made.');
        }
        return backup;
    }

    function assertNoQueryConflict() {
        const values = new URL(location.href).searchParams.getAll('configs');
        if (values.some(value => value === '__RESET__' || value.split(';').some(owned))) {
            throw new Error('Open https://play.xbox.com/ without configuration URL overrides, then try again.');
        }
    }

    function writeEntries(entries) {
        const encoded = encodeURIComponent(entries.join(';'));
        const value = cookieName + '=' + encoded + '; Path=/; Secure; SameSite=Lax; Max-Age=' + (entries.length ? 31536000 : 0);
        if (value.length > 3800) throw new Error('Xbox configuration cookie is too large. No cookie changes made.');
        document.cookie = value;
        if (JSON.stringify(readEntries()) !== JSON.stringify(entries)) {
            throw new Error('Safari did not retain the requested settings. Restore data has been kept.');
        }
    }

    function isEnabled(entries) {
        return keys.every(key => {
            const matches = entries.filter(entry => keyOf(entry) === key);
            return matches.length === 1 && decodeURIComponent(matches[0].slice(matches[0].indexOf(':') + 1)).trim() === 'true';
        });
    }

    function enable() {
        assertNoQueryConflict();
        const entries = readEntries();
        if (!readBackup()) {
            const backup = JSON.stringify({ version: 1, entries: entries.filter(owned) });
            localStorage.setItem(backupKey, backup);
            if (localStorage.getItem(backupKey) !== backup) throw new Error('Cannot save restore data. No settings changed.');
        } else if (!isEnabled(entries)) {
            throw new Error('Settings changed since the previous test. Restore the previous test before enabling again.');
        }
        writeEntries([...entries.filter(entry => !owned(entry)), ...keys.map(key => key + ':true')]);
        location.reload();
    }

    function restore() {
        assertNoQueryConflict();
        const backup = readBackup();
        if (!backup) throw new Error('No saved test settings to restore.');
        const entries = readEntries();
        const currentOwned = entries.filter(owned);
        const unchanged = JSON.stringify(currentOwned) === JSON.stringify(backup.entries);
        if (!isEnabled(entries) && !unchanged) {
            throw new Error('Cloud Connect settings were changed outside this test. Restore stopped to preserve those changes.');
        }
        writeEntries([...entries.filter(entry => !owned(entry)), ...backup.entries]);
        localStorage.removeItem(backupKey);
        location.reload();
    }

    const panel = document.createElement('details');
    panel.id = 'bx-cloud-connect-test';
    panel.style.cssText = 'position:fixed;left:8px;bottom:8px;z-index:2147483647;max-width:min(340px,calc(100vw - 32px));padding:10px;border:1px solid #777;border-radius:10px;background:#171717;color:#fff;font:14px/1.5 system-ui;box-shadow:0 2px 14px #0008';
    const summary = document.createElement('summary');
    summary.textContent = 'Cloud Connect test';
    summary.style.cursor = 'pointer';
    panel.append(summary);
    const status = document.createElement('p');
    const hint = document.createElement('p');
    hint.textContent = 'After enabling, open Xbox’s controller icon. A visible option is not proof of controller input; test a game with Bluetooth disconnected.';
    panel.append(status, hint);

    function run(action) {
        try { action(); } catch (error) {
            status.textContent = error instanceof Error ? error.message : 'The test could not update settings.';
            panel.open = true;
            // A failed cookie write can still have saved a valid restore record.
            try { restoreButton.disabled = !readBackup(); } catch { restoreButton.disabled = true; }
        }
    }
    function button(label, action) {
        const element = document.createElement('button');
        element.type = 'button';
        element.textContent = label;
        element.style.cssText = 'margin:3px;padding:8px 10px;border:1px solid #aaa;border-radius:5px;background:#303030;color:#fff;font:inherit;cursor:pointer';
        element.addEventListener('click', () => run(action));
        panel.append(element);
        return element;
    }
    button('Enable and reload', enable);
    const restoreButton = button('Restore and reload', restore);
    button('Hide', () => panel.remove());
    run(() => {
        status.textContent = isEnabled(readEntries()) ? 'Test switches are enabled. Xbox connection is not yet verified.' : 'Test switches are not enabled.';
        restoreButton.disabled = !readBackup();
    });
    document.body.append(panel);
})();
