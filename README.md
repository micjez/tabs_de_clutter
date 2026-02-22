# Tabs De Clutter

A browser extension that helps you manage tab overload by organizing your browsing session.

## What It Does

This extension solves the common problem of having too many tabs open by:

- **Closing duplicate tabs** - Automatically identifies and closes duplicate tabs in the current window
- **Bookmarking all tabs** - Saves all open tabs as bookmarks in a dated folder for later reference. Ensures your bookmark collection remains clean by avoiding duplicate bookmarks
- **Saving current tab as AI note** - Extracts the active page content, summarizes it with OpenAI, and saves a Markdown note
- **Saving current tab URL as note** - Saves a simple Markdown note named after the page title containing the page URL
- **Exporting bookmark folders to Markdown** - Save a bookmark folder as a `.md` note from the bookmark context menu

## When to Use It

- When you have dozens of research tabs open
- When your browser becomes slow due to too many tabs
- When you want to save your current browsing session for later
- When you want a wiki-style AI summary of the current page as Markdown
- When you want a quick Markdown note that stores only the current page URL
- When you want a Markdown note of a bookmark folder
- During research with many similar resources

## How It Works

### Duplicate Detection

The extension detects duplicates using **exact URL matching**. Two tabs are considered duplicates if they have identical URLs (including query parameters and fragments). URLs are not normalized - `<https://example.com>` and `<https://example.com/>` are treated as different URLs.

### Tab Handling Behavior

- **Pinned tabs**: Pinned tabs are **preserved** and will not be closed
- **Active tab**: The extension **does not close** your currently active tab, even if it's a duplicate
- **Multiple windows**: Only operates on the **current window** - other browser windows are unaffected

### Bookmark Organization

- Creates a new bookmark folder with a customizable date-based name (default: `follow_up_YYYY_MM_DD_HH_mm`)
- All open tabs (except duplicates) are bookmarked into this folder
- Bookmarks are created under the "Other Bookmarks" folder (or any folder containing "other" in its name)
- If a folder with the same name already exists, you can choose to increment the name or append to the existing folder

### Save Bookmark Folder as Markdown

- Right-click a bookmark folder and choose **Save as note**
- Generates a Markdown file with a table of bookmarks (title, date added, folder path)
- A native save dialog opens so you can choose where to save the `.md` file

### Save Current Tab as AI Note

- Open the extension popup and click **Save Current Tab as Note**
- The extension extracts readable content from the active tab (`article`, `main`, then body fallback)
- Extracted text is sent to OpenAI API using your configured API key/model
- Output is saved as Markdown via native save dialog
- Summaries can include Mermaid diagrams when the source contains process/loop/decision content
- The extension strips accidental outer ````markdown` wrappers from model output before saving

### Save Current Tab URL as Note

- Open the extension popup and click **Save Current Tab URL as Note**
- Creates a Markdown file named from the active tab title
- File content contains the active tab URL
- A native save dialog opens so you can choose where to save the `.md` file

## Preferences (Options)

Open the Preferences/Options page from the extension popup (*Preferences* button), or via the browser extension details page.

### Default folder naming

- **Folder name template (default)**: `follow_up_{YYYY}_{MM}_{DD}_{HH}_{mm}`
- **Supported variables**:
  - `{YYYY}` year
  - `{MM}` month (01-12)
  - `{DD}` day (01-31)
  - `{HH}` hour (00-23)
  - `{mm}` minute (00-59)

### When the folder already exists

- **Increment name by 1 (default)**

  If a folder with the rendered name already exists, the extension creates a new one with `_1`, `_2`, ... appended.

- **Append to existing folder**

  If a folder with the rendered name already exists, the extension reuses it and adds new bookmarks there.

### Where bookmarks are created

Bookmarks are created under the browser’s “Other Bookmarks” root folder (the extension searches for a root folder containing the word `other`).

### AI note settings

- **OpenAI API Key**: Required to use *Save Current Tab as Note*
- **Model**: OpenAI model used for summarization (default: `gpt-4.1-mini`)
- **Prompt Override**: Optional custom prompt if you want to control output style
- **Max Input Characters**: Limits extracted page text sent to OpenAI

### Privacy / data handling

- For AI note generation, the extension sends extracted page content and source metadata to OpenAI API.
- The extension does **not** send only URL for summarization; it sends extracted text to ensure reliable output.
- Do not use AI note generation for pages containing sensitive/private content unless you are comfortable sending it to OpenAI.

## Installation

### Chrome

1. Download the latest release from the GitHub repository
2. You will get a ZIP file (e.g., `tabs-de-clutter-chrome-v1.0.0.zip`)
3. Open Chrome and go to `chrome://extensions`
4. Enable "Developer mode" (toggle in top right)
5. Drag and drop the ZIP file onto the extensions page
6. Confirm the installation when prompted

### Firefox

Install directly from the Firefox Add-ons store:
[https://addons.mozilla.org/en-US/developers/addon/tabs-de-clutter/edit](https://addons.mozilla.org/en-US/developers/addon/tabs-de-clutter/edit)

For local development:

1. Download the latest release from the GitHub repository
2. Extract the downloaded ZIP file
3. Open Firefox and go to `about:debugging#/runtime/this-firefox`
4. Click "Load Temporary Add-on…"
5. Select the `manifest.json` file from the extracted folder's `firefox` subfolder

## Project layout

In src there are the source files for both Chrome and Firefox.

- `src/chrome/manifest.json`

  Chrome-specific manifest (MV3).

- `src/firefox/manifest.json`

  Firefox-specific manifest.

  Note: for local development via `about:debugging` this repo builds a Firefox **MV2** output, because some Firefox configurations disable MV3 service workers.

- `dist/`

  Build output (what you load unpacked into the browsers):

  - `dist/chrome/`
  - `dist/firefox/`

## Build

To build the extension for both Chrome and Firefox:

```bash
npm run build
```

Watch mode (rebuild on changes):

```bash
npm run build:watch
```

## Tests

```bash
npm test
```
