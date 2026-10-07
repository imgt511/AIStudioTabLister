# Chrome Web Store Listing — AI Studio Tab Lister

> Last Updated: 2026-09-15

## Store Listing

**Extension Name**
AI Studio Tab Lister

**Short Description**
Lists open Google AI Studio tabs in the context menu and toolbar for fast switching between prompts.

**Detailed Description**
AI Studio Tab Lister helps developers and prompt engineers manage multiple Google AI Studio tabs efficiently.

Key Features:
- Right-click anywhere in Chrome to view all currently open Google AI Studio tabs.
- Real-time prompt title extraction showing exact prompt names in the menu.
- Instant one-click switching to any AI Studio tab and automatic window focusing.
- Click the extension toolbar icon to quickly jump to your AI Studio tab or open a new session.
- Completely lightweight Manifest V3 service worker architecture with zero background battery drain.

How to Use:
1. Open one or more prompt sessions on Google AI Studio (aistudio.google.com).
2. Right-click anywhere on any webpage.
3. Hover over "AI Studio Tabs" in the context menu.
4. Click on any tab name to switch directly to it.

Privacy and Security:
AI Studio Tab Lister operates entirely on-device within your browser. It does not collect, store, or transmit any user data, prompt contents, or browsing history.

**Category**
Developer Tools

**Single Purpose**
Lists open Google AI Studio tabs in the browser context menu and enables instant one-click switching between prompt sessions.

**Primary Language**
English

## Graphics & Assets

| Asset | Dimensions | Status | Filename |
|---|---|---|---|
| Store Icon | 128×128 PNG | ✅ Ready | `images/icon128.png` |
| Small Tile | 440×280 PNG | ⬜ Not created | `stuff/AppImages/windows11/SmallTile.scale-100.png` |
| Screenshot 1 | 1280×800 | ⬜ Not created | |

## Permissions Justification

| Permission | Type | Justification |
|---|---|---|
| `contextMenus` | permissions | Required to create the "AI Studio Tabs" submenu in Chrome's right-click context menu. |
| `tabs` | permissions | Required to discover open Google AI Studio tabs and switch active tab / window focus upon selection. |
| `scripting` | permissions | Required to inspect the DOM of Google AI Studio tabs to extract active prompt titles for menu display. |
| `https://aistudio.google.com/*` | host_permissions | Scoped strictly to Google AI Studio domains so the extension can extract prompt titles only from AI Studio tabs. |

## Privacy & Data Use

### Data Collection
**Does the extension collect user data?** No

| Data Type | Collected? | Transmitted Off-Device? | Purpose | Shared with Third Parties? |
|---|---|---|---|---|
| Personally identifiable info | No | No | None | No |
| Health info | No | No | None | No |
| Financial info | No | No | None | No |
| Authentication info | No | No | None | No |
| Personal communications | No | No | None | No |
| Location | No | No | None | No |
| Web history | No | No | None | No |
| User activity | No | No | None | No |
| Website content | No | No | None | No |

### Data Use Certification
- [x] Data is NOT sold to third parties
- [x] Data is NOT used for purposes unrelated to the extension's core functionality
- [x] Data is NOT used for creditworthiness or lending purposes

## Distribution
**Visibility**: Public
**Regions**: All regions
**Pricing**: Free

## Version History

| Version | Date | Changes | Status |
|---|---|---|---|
| 1.3.0 | 2026-09-15 | Manifest V3 complete modernization, async/await service worker, race condition mutex lock, multi-tier title resolution, toolbar quick action. | Draft |
| 1.2.0 | 2025-12-14 | Initial MV3 release with basic context menu listing. | Published |
