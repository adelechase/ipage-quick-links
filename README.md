# iPage Quick GR and NG

A Firefox add-on that automatically displays Goodreads rating, ratings count, reviews count, want-to-read count, and direct Goodreads/NetGalley book links above Notes on an individual Ingram iPage product page.

**Status:** Version 1.0.1 is prepared for signing. No signed release is published yet. This source revision opens one Goodreads and one NetGalley background tab for each lookup and keeps them available for staff inspection; complete signed-in Firefox behavior and live Goodreads extraction remain unverified.

## License

[PolyForm Noncommercial 1.0.0](LICENSE). Use, modify, and redistribute under its terms. Required Notice: Copyright 2026 Adele Lesli Chase. Include LICENSE and NOTICE with redistributed copies. This is source-available software with noncommercial restrictions.

## Publisher setup (one time)

1. For public downloads and remixing, make this repository public in **Settings → General → Danger Zone → Change repository visibility**. Only the extension and distribution files belong here; do not upload account credentials or private catalog exports.
2. Open **Settings → Pages**. Set **Source: GitHub Actions**. This supersedes the earlier suggestion to select main /docs; the included workflows deploy that folder directly.
3. Under **Actions**, run **Publish download page**. After it succeeds, check https://adelechase.github.io/ipage-quick-links/updates.json — it should initially contain an empty updates list.

Permanent update address: `https://adelechase.github.io/ipage-quick-links/updates.json`.
Keep the repository name and this address stable once signed copies are installed.

## First signed release — no local software installation needed

1. In **Actions → Build unsigned add-on**, open the successful run and download **unsigned-addon-for-mozilla** from Artifacts. Extract that artifact download once. The ZIP inside, `ipage-quick-links-1.0.1-UNSIGNED.zip`, is the file for Mozilla. If no run exists, click **Run workflow**.
2. At https://addons.mozilla.org/developers/ submit a new add-on, select **On your own**, and upload that inner ZIP. Complete signing. If asked about source: the extension is plain readable JavaScript with no compilation. See [reviewer notes](REVIEWER-NOTES.md).
3. Download Mozilla's signed XPI. Install that exact file in Firefox and test it. Never edit/recompress a signed XPI.
4. Rename the signed file to `ipage-quick-links-1.0.1.xpi` (renaming is okay). In GitHub **Releases → Draft a new release**, use tag `v1.0.1`, targeting the main commit used by the build. Attach that signed XPI and publish as a regular release, not a prerelease.
5. In **Actions → Publish signed release → Run workflow**, enter `v1.0.1`. This downloads the attached XPI, checks it against the current source, creates its SHA-256 update entry, commits the feed, and deploys Pages. No Mozilla API credentials are needed.
6. Check the website and update JSON. New users install from the signed download link; if Firefox downloads it instead, use **about:addons → gear → Install Add-on From File**. Remove a temporary copy first.

The release helper checks signature-file presence, not the cryptographic signature. Firefox performs signature verification. If a workflow is blocked by branch protection or GitHub Actions permission settings, review the failure before changing repository policy; there is no force push.

## Later updates

Edit code in `extension/`; increase the version in BOTH `extension/manifest.json` and `release-config.json` (for example 1.0.2); update CHANGELOG.md. Build, submit a new self-distributed version of the SAME Mozilla add-on, download and test the signed XPI, publish GitHub release v1.0.2 with asset ipage-quick-links-1.0.2.xpi, and run Publish signed release with that tag. Keep main's release source unchanged between the build and publication so validation can compare the signed bytes.

Never change the add-on ID: `ipage-quick-links@adele.local`. Each new version needs signing. Firefox checks the feed periodically; updates are not an immediate push. Test using an older signed installation and **Check for Updates** in Firefox. The first unsigned temporary build has no working update channel.

If upload succeeded but deployment failed, rerun the workflow after fixing the reported setup issue. The feed remains empty until a signed release is processed. Do not replace an existing version's XPI with different bytes; publish a higher version.

## Developer use

Load `extension/manifest.json` temporarily through Firefox's about:debugging. For a local signing ZIP run `python3 release.py prepare` (Python 3.9+, standard library only). For local feed preparation run `python3 release.py finalize /path/to/signed.xpi`; upload the signed asset to its GitHub Release separately before deploying docs/.

The add-on targets the individual product page containing #pd-title and #add-to-sl-note-gb, not the multi-row cart list. Missing counts or uncertain matches show unavailable. It opens one regular background tab for Goodreads and one for NetGalley, reuses those two tabs throughout the lookup, keeps them open for inspection, and adds a Close GR/NG tabs button above Notes. It does not edit Notes. See [privacy information](docs/privacy.html).

## References

- https://extensionworkshop.com/documentation/publish/submitting-an-add-on/
- https://extensionworkshop.com/documentation/manage/updating-your-extension/
- https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages
