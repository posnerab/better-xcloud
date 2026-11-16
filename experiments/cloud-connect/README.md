# Xbox Nano Cloud Connect in Safari: experimental test

The owner confirmed Nano connection and page controls in iPhone Safari, then
working gameplay after adding the Xbox page to the Home Screen as a PWA.
This is a successful physical-device report for this setup, not a full Better
xCloud port or a compatibility guarantee for every iOS version. The script asks
Xbox to enable its existing Cloud Connect feature; Xbox still decides account,
accessory and session eligibility.

## Shortcut installation on another iPhone or iPad

[Download the signed Xbox Cloud Connect Shortcut](https://xbox-cloud-connect-download.unitedcookie.chatgpt.site/).
The download page is private to its owner; sign in if prompted.

1. Download and open `Xbox-Cloud-Connect.shortcut`, then add it to Shortcuts.
2. Open <https://play.xbox.com/> in **Safari** and sign in with the Nano's Xbox account.
3. From Safari's **Share** menu, run **Xbox Cloud Connect** and choose
   **Enable Cloud Connect**. Allow JavaScript on the page if prompted.
4. Return to Safari and reload. Open Xbox's controller icon and connect the Nano.
5. Use **Share > Add to Home Screen**, then launch that Xbox app to play.

No Userscripts extension is required for this route. The Shortcut also offers
**Check settings** and **Restore previous settings**. Run those from Safari's
Share menu too; reload after restoration. It changes Safari's configuration,
not CloudGear's configuration. Changes to an existing Home Screen app's separate
storage are not verified.

The signed file was produced with Apple's `shortcuts sign --mode anyone`.
Eight isolated WebKit checks passed for workflow structure, JavaScript execution,
failure handling and restoration compatibility with the userscript. Import and
Share-menu execution on a physical iPhone/iPad remain unverified. The owner's
successful gameplay report below used the original userscript route.

## Original userscript installation on iPhone

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
7. For the confirmed gameplay setup, add the enabled Xbox page to the iPhone
   Home Screen using Safari's Share menu, then launch that Home Screen app.
   Enable the switches in Safari first; the userscript does not need to run
   inside the PWA for the owner's reported result.

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

Owner verification, 2026-11-15: the Nano connected and controlled the page in
Safari. In response to a request to test game input in Wi-Fi Cloud Connect mode
with Bluetooth disconnected from the iPhone, the owner confirmed that gameplay
worked after adding the page as a Home Screen PWA. This is owner-observed evidence,
not an instrumented controller/session trace. The exact iOS version, game title,
cold-launch persistence and PWA rollback have not been recorded. Do not assume
that later Safari cookie changes automatically update an already installed PWA.

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

### Rebuild the Shortcut

Generate artifacts outside the Git checkout, then sign on macOS:

```sh
python3 experiments/cloud-connect/build_shortcut.py /tmp/cloud-connect-shortcut
shortcuts sign --mode anyone \
  --input '/tmp/cloud-connect-shortcut/Xbox Cloud Connect.unsigned.shortcut' \
  --output /tmp/cloud-connect-shortcut/Xbox-Cloud-Connect.shortcut
PLAYWRIGHT_MODULE=/absolute/path/to/playwright/index.mjs node experiments/cloud-connect/test-shortcut.mjs
```

The builder reuses the userscript's cookie and restore logic, removing reloads
so Shortcuts can receive its completion result before navigation. It performs
no network requests and contains no credentials or account-specific data.
Publish the signed file through the existing private download Site, preserving
the userscript downloads and current audience. Signing validates packaging;
browser tests do not establish physical-device Shortcut compatibility.
