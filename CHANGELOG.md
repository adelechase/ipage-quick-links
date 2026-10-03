# Release history

## 1.0.3 — prepared October 3, 2026; pending signing and publication
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
