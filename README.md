# iPage Quick GR and NG

A Firefox add-on that automatically displays Goodreads rating, ratings count, reviews count, want-to-read count, and direct Goodreads/NetGalley book links above Notes on an individual Ingram iPage product page.

**Status:** v1.0.5 is signed, published, and retained as the **fallback** ([signed XPI](https://github.com/adelechase/ipage-quick-links/releases/download/v1.0.5/ipage-quick-links-1.0.5.xpi)). v1.0.6 is being prepared for Mozilla signing and is not yet a signed release.

## License

This project is licensed under the [PolyForm Noncommercial License 1.0.0](LICENSE). You may use, modify, and redistribute the code for noncommercial purposes, including use by libraries, educational institutions, public research organizations, charitable organizations, and government institutions. Commercial use requires separate permission from the copyright holder.

SPDX identifier: `PolyForm-Noncommercial-1.0.0`
## Publisher setup (one time)

1. For public downloads and remixing, make this repository public in **Settings → General → Danger Zone → Change repository visibility**. Only the extension and distribution files belong here; do not upload account credentials or private catalog exports.
2. Open **Settings → Pages**. Set **Source: GitHub Actions**. This supersedes the earlier suggestion to select main /docs; the included workflows deploy that folder directly.
3. Under **Actions**, run **Publish download page**. After it succeeds, check https://adelechase.github.io/ipage-quick-links/updates.json — it contains the published signed updates. The download-page workflow also runs automatically when `docs/` or its workflow changes on main.

Permanent update address: `https://adelechase.github.io/ipage-quick-links/updates.json`.
Keep the repository name and this address stable once signed copies are installed.

## Publish v1.0.6

The previous signed **v1.0.5** remains the fallback release. Its [signed XPI](https://github.com/adelechase/ipage-quick-links/releases/download/v1.0.5/ipage-quick-links-1.0.5.xpi) and `v1.0.5` tag are preserved. Do not change the live update feed to v1.0.6 until Mozilla signs that version.

1. In GitHub **Actions → Build unsigned add-on**, open the successful run for the v1.0.6 source commit. Download **unsigned-addon-for-mozilla** under Artifacts and extract the downloaded artifact once. Inside is `ipage-quick-links-1.0.6-UNSIGNED.zip`; submit this **inner** ZIP to Mozilla.
2. Sign in at [Mozilla Add-ons Developer Hub](https://addons.mozilla.org/developers/). Select the existing, self-distributed/unlisted **iPage Quick GR and NG** add-on. Choose **Upload New Version** (label may vary). Do not submit a new add-on. Upload the unsigned ZIP and follow the prompts. The scripts are readable JavaScript, with no build tools or generated source; refer to [reviewer notes](REVIEWER-NOTES.md) if asked.
3. After Mozilla signs it, download the signed `.xpi` from the new version page and test it in Firefox using `about:addons` → gear → **Install Add-on From File**. Keep the signed file unchanged; renaming the file is fine.
4. Name the signed file `ipage-quick-links-1.0.6.xpi`. In GitHub **Releases → Draft a new release**, create `v1.0.6` from the source commit used in step 1, attach the signed XPI, and publish a normal (non-prerelease) release. Use the [changelog](CHANGELOG.md) for release notes.
5. In GitHub **Actions → Publish signed release → Run workflow**, enter `v1.0.6`. This checks the signed package against the repo source, updates the signed Firefox feed and download page, and deploys GitHub Pages. Do not edit the release source files between steps 1 and 5.
6. Check the [download page](https://adelechase.github.io/ipage-quick-links/), the [Firefox update feed](https://adelechase.github.io/ipage-quick-links/updates.json), and Firefox **about:addons → gear → Check for Updates**. The fallback v1.0.5 will still be available as a signed older release.

## Later updates

For future changes, bump both `release-config.json` and `extension/manifest.json`, update `CHANGELOG.md`, and repeat unsigned build → Mozilla signing → GitHub signed release → Publish signed release. Keep the existing extension ID and update URL unchanged; change `fallback_version` only when a newer signed fallback is desired.

## Developer use

Load `extension/manifest.json` temporarily through Firefox's about:debugging. For a local signing ZIP run `python3 release.py prepare` (Python 3.9+, standard library only). For local feed preparation run `python3 release.py finalize /path/to/signed.xpi`; upload the signed asset to its GitHub Release separately before deploying docs/.

The add-on targets the individual product page containing #pd-title and #add-to-sl-note-gb, not the multi-row cart list. Unavailable Goodreads statistics display em dashes, except for a missing want-to-read count on a matched book, which displays as 0wtr. It opens one regular background tab for Goodreads and one for NetGalley, reuses those two tabs throughout the lookup, keeps them open for inspection, and adds a Close GR/NG tabs button above Notes. Clicking iPage's selection-list **Update** closes the current GR/NG tabs and asks iPage to return to the next product after its native save. The extension preserves iPage's validation and save payload; it does not submit a separate request or change Notes. If there is no next-product link, Update keeps its normal destination. Tabs close on the click even if iPage then asks you to correct an invalid field; use Refresh to reopen them. Moving to another product starts its own lookup.

Goodreads tries ISBN and exact title first, then any applicable deluxe-edition and title-before-colon plus author fallbacks. If no match is found, its final search strips trailing parenthetical phrases from the iPage title and compares against Goodreads titles with those suffixes also stripped. Candidate details must still match the author. NetGalley matching is unchanged.

When the matched Goodreads page lacks the total want-to-read count, the extension first fetches that same book page without login cookies. If a rendered page is still needed and private access is allowed, it opens a temporary minimized private window and closes its own tab after success, failure, or cancellation. Firefox cannot hide a window's only active tab; a minimized window can briefly appear in the taskbar. The normal GR/NG tabs remain available for inspection. Private windows share Firefox's private session, so keep Goodreads signed out there for a logged-out view. Missing want-to-read totals stay unavailable internally for retry but display as 0wtr when Goodreads matched the book; private-access instructions appear in the panel when needed.

Run `node --test tests/*.test.cjs` for matching, logged-out counts, permission handling, source-tab cancellation, and ownership regressions. The signing-build workflow runs these tests before packaging. Validation also used the supplied saved iPage HTML and its native JavaScript to verify the POST payload, next-product return URL, end-of-list behavior, and failed validation. The new private-window behavior and live Goodreads count extraction still need verification in Firefox after signing. See [privacy information](docs/privacy.html).

## References

- https://extensionworkshop.com/documentation/publish/submitting-an-add-on/
- https://extensionworkshop.com/documentation/manage/updating-your-extension/
- https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages
