# Release history

## 1.0.6 — November 3, 2026; prepared for Mozilla signing
- Add the blue iPage icon for Firefox’s add-on interface.
- Display `0wtr` when a matched Goodreads book lacks an accessible want-to-read total; suppress the private-page missing-count message while retaining the missing count internally for retries.
- Display an em dash (—) instead of "unavailable" in Goodreads statistics when no value is available, except for the 0wtr case above.
- Add a last-resort Goodreads-only matching attempt that strips terminal parenthetical phrases from both Ingram and Goodreads titles, then verifies the title and author; existing ISBN, deluxe-edition, subtitle, and NetGalley behavior is preserved.
- Add display and matching regression tests. Retain signed v1.0.5 as the fallback.

## 1.0.5 — October 5, 2026; signed and published (fallback version)
- Recover missing Goodreads total want-to-read counts using a request without login cookies, then a temporary minimized private window when a rendered page is needed and Firefox private access is allowed. Only copy the count from the exact matched Goodreads book URL.
- Close the temporary private tab on success, failure, timeout, Update, Close, or navigation to another product; retain the regular GR/NG tabs for inspection. Show private-access guidance when needed.
- After ISBN, exact-title, and applicable deluxe-edition searches fail, try the title before the first colon plus the author on Goodreads. Verify both title and author. NetGalley matching is unchanged.
- Invalidate older cached lookups and shorten caching for missing want-to-read counts so unavailable counts can be retried.
- Add automated regressions for matching and count retrieval, and run tests before creating the signing ZIP.

## 1.0.4 — October 4, 2026; signed and published
- Added a Goodreads-only regular-edition fallback for explicit deluxe-edition labels, requiring matching title and author after ISBN and exact-title searches fail.
- Invalidated the prior lookup cache so failed deluxe-edition matches are retried.
- Clicking iPage's selection-list Update closes the current source tabs and supplies the next product as the native save's return destination, preserving iPage validation and the save payload. At the end of the list it keeps the normal destination.
- Closing tabs cancels pending lookups so they cannot reopen source tabs; late messages from the previous product cannot close the next product's tabs.

## 1.0.3 — signed and published
- Display the Goodreads rating first, for example **4.67 GR**, without the former colon or /5 suffix.
- Prefix ratings below 3.0 with **NR: **, for example **NR: 2.85 GR**. Ratings of exactly 3.0 and unavailable ratings have no NR prefix.

## 1.0.2 — October 3, 2026; signed and published
- Changed Goodreads and NetGalley source-page handling to use one normal background tab per site, reused throughout a lookup and left open for staff inspection.
- Added a **Close GR/NG tabs** button above Notes to close the two extension-opened source tabs.

## 1.0.1 — October 3, 2026; signed and published
- Configured the GitHub Pages update URL while keeping the existing add-on ID.
- Added PolyForm Noncommercial 1.0.0 license and notices to source and packaged add-on.
- Added GitHub Actions workflows for signing ZIPs, Pages, and signed-release publication.
- Added update-feed templates, optional local packaging/finalization helper, privacy disclosure, and release instructions.
- Book lookup and display behavior remained unchanged from 1.0.0.

## 1.0.0 — October 1, 2026
- Initial simplified Firefox extension: Goodreads counts and direct GR/NG links above iPage Notes on individual product pages.
