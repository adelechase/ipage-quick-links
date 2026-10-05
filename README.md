# iPage Quick GR and NG

A Firefox add-on that automatically displays Goodreads rating, ratings count, reviews count, want-to-read count, and direct Goodreads/NetGalley book links above Notes on an individual Ingram iPage product page.

**Status:** Version 1.0.4 is signed and published. Version 1.0.5 is prepared for Mozilla signing, with logged-out want-to-read counts and a final Goodreads title-before-colon/author fallback.

## License

[PolyForm Noncommercial 1.0.0](LICENSE). Use, modify, and redistribute under its terms. Required Notice: Copyright 2026 Adele Lesli Chase. Include LICENSE and NOTICE with redistributed copies. This is source-available software with noncommercial restrictions.

## Publisher setup (one time)

1. For public downloads and remixing, make this repository public in **Settings → General → Danger Zone → Change repository visibility**. Only the extension and distribution files belong here; do not upload account credentials or private catalog exports.
2. Open **Settings → Pages**. Set **Source: GitHub Actions**. This supersedes the earlier suggestion to select main /docs; the included workflows deploy that folder directly.
3. Under **Actions**, run **Publish download page**. After it succeeds, check https://adelechase.github.io/ipage-quick-links/updates.json — it contains the published signed updates. The download-page workflow also runs automatically when `docs/` or its workflow changes on main.

Permanent update address: `https://adelechase.github.io/ipage-quick-links/updates.json`.
Keep the repository name and this address stable once signed copies are installed.

## Publishing version 1.0.5 — no local software installation needed

1. In **Actions → Build unsigned add-on**, open the successful run for the 1.0.5 source commit and download **unsigned-addon-for-mozilla** from Artifacts. Extract that artifact download once. The ZIP inside, `ipage-quick-links-1.0.5-UNSIGNED.zip`, is the file for Mozilla.
2. At https://addons.mozilla.org/developers/ upload that ZIP as a **new version of the existing add-on**. Keep the same add-on ID and complete signing. If asked about source: the extension is plain readable JavaScript with no compilation. See [reviewer notes](REVIEWER-NOTES.md).
3. Download Mozilla's signed XPI. Install that exact file in Firefox and test it. For the private-window fallback, open `about:addons`, select iPage Quick GR and NG, and set **Run in Private Windows → Allow**. Reload iPage and click Refresh. Never edit or recompress a signed XPI.
4. Rename the signed file to `ipage-quick-links-1.0.5.xpi` if needed. In GitHub **Releases → Draft a new release**, use tag `v1.0.5`, targeting the exact main commit used by the build. Attach that signed XPI and publish it as a regular release, not a prerelease.
5. In **Actions → Publish signed release → Run workflow**, enter `v1.0.5`. This downloads the attached XPI, checks it against the current source, creates its SHA-256 update entry, commits the feed, and deploys Pages.
6. Check the website and update JSON. Existing installations should then be able to receive 1.0.5 through Firefox's update mechanism.

The release helper checks signature-file presence, not the cryptographic signature. Firefox performs signature verification. If a workflow is blocked by branch protection or GitHub Actions permission settings, review the failure before changing repository policy; there is no force push.

## Later updates

Edit code in `extension/`; increase the version in BOTH `extension/manifest.json` and `release-config.json` (for example 1.0.5); update CHANGELOG.md. Build, submit a new self-distributed version of the SAME Mozilla add-on, download and test the signed XPI, publish GitHub release v1.0.5 with asset ipage-quick-links-1.0.5.xpi, and run Publish signed release with that tag. Keep main's release source unchanged between the build and publication so validation can compare the signed bytes.

Never change the add-on ID: `ipage-quick-links@adele.local`. Each new version needs signing. Firefox checks the feed periodically; updates are not an immediate push. Test using an older signed installation and **Check for Updates** in Firefox. The first unsigned temporary build has no working update channel.

If upload succeeded but deployment failed, rerun the workflow after fixing the reported setup issue. The live feed changes only after a successful Pages deployment. Do not replace an existing version's XPI with different bytes; publish a higher version.

## Developer use

Load `extension/manifest.json` temporarily through Firefox's about:debugging. For a local signing ZIP run `python3 release.py prepare` (Python 3.9+, standard library only). For local feed preparation run `python3 release.py finalize /path/to/signed.xpi`; upload the signed asset to its GitHub Release separately before deploying docs/.

The add-on targets the individual product page containing #pd-title and #add-to-sl-note-gb, not the multi-row cart list. Missing counts or uncertain matches show unavailable. It opens one regular background tab for Goodreads and one for NetGalley, reuses those two tabs throughout the lookup, keeps them open for inspection, and adds a Close GR/NG tabs button above Notes. Clicking iPage's selection-list **Update** closes the current GR/NG tabs and asks iPage to return to the next product after its native save. The extension preserves iPage's validation and save payload; it does not submit a separate request or change Notes. If there is no next-product link, Update keeps its normal destination. Tabs close on the click even if iPage then asks you to correct an invalid field; use Refresh to reopen them. Moving to another product starts its own lookup.

Goodreads tries ISBN and exact title first. If a title has an explicit deluxe-edition label, it then searches the regular title plus author and requires both to match. If those searches fail and the title contains a colon, the final Goodreads search uses the part before the first colon plus the author. Candidate pages must match both the shortened title and author. For example, Dangerous Ground: A Novel of Suspense (Alex Carter #6) by Alice Henderson can match Dangerous Ground by Alice Henderson. NetGalley matching is unchanged.

When the matched Goodreads page lacks the total want-to-read count, the extension first fetches that same book page without login cookies. If a rendered page is still needed and private access is allowed, it opens a temporary minimized private window and closes its own tab after success, failure, or cancellation. Firefox cannot hide a window's only active tab; a minimized window can briefly appear in the taskbar. The normal GR/NG tabs remain available for inspection. Private windows share Firefox's private session, so keep Goodreads signed out there for a logged-out view. Missing counts stay unavailable, never zero, and private-access instructions appear in the panel when needed.

Run `node --test tests/*.test.cjs` for matching, logged-out counts, permission handling, source-tab cancellation, and ownership regressions. The signing-build workflow runs these tests before packaging. Validation also used the supplied saved iPage HTML and its native JavaScript to verify the POST payload, next-product return URL, end-of-list behavior, and failed validation. The new private-window behavior and live Goodreads count extraction still need verification in Firefox after signing. See [privacy information](docs/privacy.html).

## References

- https://extensionworkshop.com/documentation/publish/submitting-an-add-on/
- https://extensionworkshop.com/documentation/manage/updating-your-extension/
- https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages
