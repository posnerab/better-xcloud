# Xbox Nano Cloud Connect in Safari: experimental test

This fork's first milestone is Nano Wi-Fi Cloud Connect in iOS Safari. A PWA
and a full Better xCloud port are separate work. This test is **not a verified
iOS fix**. It asks the Xbox site to enable its existing Cloud Connect feature;
Xbox still decides account, accessory and session eligibility.

## Try it on iPhone

1. Keep the Nano configured for Wi-Fi Cloud Connect with the Xbox account
   already used successfully on PC.
2. Install the free [Userscripts Safari extension](https://apps.apple.com/app/userscripts/id1463298887).
   Enable it in Settings > Apps > Safari > Extensions, and choose a scripts
   folder in the Userscripts app.
3. [Download cloud-connect.user.js](https://raw.githubusercontent.com/posnerab/better-xcloud/safari-cloud-connect/experiments/cloud-connect/cloud-connect.user.js)
   into that folder. Keep its `.user.js` filename.
4. Open <https://play.xbox.com/> **in Safari**, sign in, and allow Userscripts
   access to this website. Use the new site without the old Better xCloud
   userscript while testing.
5. Open **Cloud Connect test** at the bottom left, then **Enable and reload**.
6. Open Xbox's controller icon and check whether Cloud Connect/Nano appears.
   If offered, choose **Use here**. Test actual button and stick input in a game
   with the Nano in Wi-Fi mode and no Bluetooth connection to the iPhone.
   **Hide** dismisses the test panel for the current page.

Report separately: whether the option appears, whether the Nano is listed,
whether connection succeeds, and whether game input works. Include the iOS
version and any visible error. A controller icon alone does not verify input.

## Restore

While the userscript is still installed, use **Restore and reload**, then remove
or disable the script. Only the two original Cloud Connect overrides are restored;
other configuration entries added during the test are retained. Original values
for those two switches are saved locally before any cookie write. No tokens,
account identifiers or other cookie contents are saved or transmitted by the script.

The script uses Xbox's `configs` cookie at `/`, Secure, SameSite=Lax, with Xbox's
one-year configuration lifetime. Rewriting an existing cookie renews that lifetime.
If no entries remain on restoration, the cookie is removed. Removing the script
alone does not remove the override. Duplicate configuration cookies, conflicting
configuration URL parameters and externally changed test switches stop the write
instead of guessing. Other cookies and browser storage are not modified.

## Evidence and limits

Inspected on 2026-11-15:

- Microsoft's [Cloud Connect announcement](https://news.xbox.com/en-us/2026/11/04/cloud-gaming-inputs-preview/)
  describes a Wi-Fi controller linked to the same Xbox account.
- `play.xbox.com/assets/AccsSystem-ewxdnfq9.js` reads `accs.infra.enable` and
  `accs.ux.enable`. Eligibility additionally requires sign-in, an accessory in
  the rig lookup and an accepted service offering. The user-facing physical
  controller status also requires a connected ACCS session.
- `AccsRuntime-y0hpnxag.js` uses WebRTC; no direct Bluetooth or HID API calls were
  found in that module. This does not establish complete Safari compatibility.
- `entry.client-n7br5v3h.js` honors cookie configuration overrides, while its
  production URL override allowlist excludes these two switches. A request
  using an iPhone Safari user agent and the two-value cookie returned both
  switches as boolean `true` in Xbox's server-rendered configuration state.
  That anonymous request does not test sign-in, discovery, WebRTC or gameplay.

The script deliberately does not change account eligibility, streaming offerings,
controller registration, browser identity or Bluetooth handling. It does not
intercept network requests or automatically transfer an active controller.
Xbox may change these internals at any time.

## Validation and publication

Run `node --check experiments/cloud-connect/cloud-connect.user.js` and the browser
test with a locally installed Playwright:

```sh
PLAYWRIGHT_MODULE=/absolute/path/to/playwright/index.mjs node experiments/cloud-connect/test.mjs
```

Use `BROWSER_ENGINE=webkit` for the WebKit run. All nine cases passed in both
Chromium (Edge) and Playwright WebKit on 2026-11-15. The tests use isolated
contexts with mocked Xbox HTML; they validate cookie changes, restoration and
failure handling, not live Xbox compatibility or physical iPhone behavior.
Publish this experiment by pushing the `safari-cloud-connect` branch. The raw
GitHub script is the install artifact; no server deployment is required.
