# Reviewer notes — iPage Quick GR and NG

Purpose: assist a librarian on the iPage individual product page by showing Goodreads statistics and direct Goodreads/NetGalley links above Notes. It does not submit orders or edit Notes.

This is an unlisted/self-distributed extension. The fixed ID is ipage-quick-links@adele.local. The release's configured HTTPS update_url is for Firefox update checks only. All executable code is included as readable JavaScript. No build compilation, minification, remote code execution, AI service, or external JavaScript dependency is used.

Code map:
- content.js reads #pd-title, contributor links, and ISBN/EAN, and inserts a shadow-DOM panel above #add-to-sl-note-gb.
- background.js performs ISBN/title searches, verifies candidate book identity, and caches results locally. It maintains at most one regular background tab for Goodreads and one for NetGalley, reusing those tabs for any snapshot reads and leaving them open for staff inspection. Explicit access blocks are reported.
- reader.js answers the extension's snapshot requests on the extension-opened Goodreads and NetGalley background tabs.
- core.js performs read-only DOM parsing, matching, and formatting.

Permissions are scoped to iPage, Goodreads, and NetGalley; local storage holds cached book results. Website content and search terms are declared in Firefox data collection permissions. No Notes text, passwords, or review prose is extracted for research.

Testing needs an authorized iPage account and an individual product opened from a selection list. No credentials are bundled. Goodreads/NetGalley behavior can depend on account and site access. Ask the submitter for an approved review environment if needed; no credentials should be invented or shared without account-owner authorization.

Prior 1.0.0 validation included supplied iPage HTML, live NetGalley HTML, representative Goodreads fixtures, and simulated background/message flows. The current source revision changes source-tab handling and adds the iPage close control; its tab-reuse and close-message flow were tested with a simulated Firefox tabs API. Complete signed-in Firefox behavior and live Goodreads extraction remain unverified.
