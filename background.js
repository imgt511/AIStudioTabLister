/**
 * AI Studio Tab Lister - Background Service Worker
 * Manifest V3 compliant service worker for managing AI Studio context menu tabs.
 */

const PARENT_MENU_ID = "aiStudioParentMenu";
const NO_TABS_MENU_ID = "aiStudioNoTabsFound";
const AI_STUDIO_URL_PATTERN = "https://aistudio.google.com/*";
const AI_STUDIO_BASE_URL = "https://aistudio.google.com/";

// Concurrency lock for context menu operations
let isUpdating = false;
let pendingUpdate = false;

/**
 * Injected into AI Studio tabs to extract the active prompt or chat title.
 * Must be self-contained and run inside page DOM context.
 */
function getChatTitleFromPage() {
  try {
    // 1. Check title/heading input fields (modern Angular/Material AI Studio headers)
    const inputSelectors = [
      'input[aria-label*="Prompt" i]',
      'input[aria-label*="title" i]',
      'input[aria-label*="Name" i]',
      'input.prompt-title',
      'input[placeholder*="Untitled" i]',
      'textarea[aria-label*="title" i]'
    ];
    for (const selector of inputSelectors) {
      const input = document.querySelector(selector);
      if (input && input.value && input.value.trim().length > 0) {
        const val = input.value.trim();
        if (val.toLowerCase() !== "untitled chat" && val.toLowerCase() !== "untitled prompt") {
          return val;
        }
      }
    }

    // 2. Check header text and contenteditable elements
    const elementSelectors = [
      'h1[contenteditable="true"]',
      'div[contenteditable="true"]',
      'ms-prompt-header h1',
      'ms-prompt-header .title',
      'header h1',
      '[data-testid="prompt-title"]',
      'div[aria-label^="Chat title" i]',
      'div.chat-title',
      'h1',
      'h2'
    ];
    for (const selector of elementSelectors) {
      const element = document.querySelector(selector);
      if (element && element.innerText && element.innerText.trim().length > 0) {
        const text = element.innerText.trim();
        if (text.toLowerCase() !== "untitled chat" && text.toLowerCase() !== "untitled prompt") {
          return text;
        }
      }
    }

    // 3. Clean document.title without standard brand suffix
    if (document.title) {
      const cleanDocTitle = document.title
        .replace(/\s*[-—|]\s*Google AI Studio$/i, '')
        .replace(/^Google AI Studio\s*[-—|]?\s*/i, '')
        .trim();
      if (cleanDocTitle && cleanDocTitle.toLowerCase() !== "google ai studio") {
        return cleanDocTitle;
      }
    }
  } catch (e) {
    // Fall back to default
  }
  return "Untitled Prompt";
}

/**
 * Formats and truncates menu item titles.
 */
function formatMenuTitle(title, index) {
  const maxLen = 45;
  let cleanTitle = (title || "Untitled Prompt").trim();
  if (cleanTitle.length > maxLen) {
    cleanTitle = cleanTitle.substring(0, maxLen - 1) + "…";
  }
  return `${index}. ${cleanTitle}`;
}

/**
 * Rebuilds the context menu dynamically based on current AI Studio tabs.
 */
async function updateContextMenu() {
  try {
    await chrome.contextMenus.removeAll();
  } catch (e) {
    // Ignore removal errors
  }

  try {
    await chrome.contextMenus.create({
      id: PARENT_MENU_ID,
      title: "AI Studio Tabs",
      contexts: ["all"]
    });
  } catch (err) {
    console.warn("[AIStudioTabLister] Failed to create parent menu:", err);
    return;
  }

  let tabs = [];
  try {
    tabs = await chrome.tabs.query({ url: AI_STUDIO_URL_PATTERN });
  } catch (err) {
    console.error("[AIStudioTabLister] Error querying tabs:", err);
    return;
  }

  if (!tabs || tabs.length === 0) {
    try {
      await chrome.contextMenus.create({
        id: NO_TABS_MENU_ID,
        title: "No AI Studio tabs open",
        parentId: PARENT_MENU_ID,
        contexts: ["all"],
        enabled: false
      });
    } catch (e) {
      // Ignore
    }
    return;
  }

  // Iterate sequentially to preserve tab ordering
  for (let i = 0; i < tabs.length; i++) {
    const tab = tabs[i];
    let chatTitle = "";

    if (tab.status === "complete" && tab.id) {
      try {
        const injectionResults = await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: getChatTitleFromPage
        });
        if (injectionResults && injectionResults[0] && injectionResults[0].result) {
          chatTitle = injectionResults[0].result;
        }
      } catch (scriptErr) {
        // Fall back gracefully if script injection fails
      }
    }

    // Fallback to tab.title
    if (!chatTitle && tab.title) {
      const cleanTitle = tab.title
        .replace(/\s*[-—|]\s*Google AI Studio$/i, '')
        .replace(/^Google AI Studio\s*[-—|]?\s*/i, '')
        .trim();
      chatTitle = cleanTitle || "AI Studio Tab";
    }

    if (!chatTitle) {
      chatTitle = "Untitled Prompt";
    }

    const menuTitle = formatMenuTitle(chatTitle, i + 1);

    try {
      await chrome.contextMenus.create({
        id: `tab-${tab.id}`,
        title: menuTitle,
        parentId: PARENT_MENU_ID,
        contexts: ["all"]
      });
    } catch (createErr) {
      console.warn(`[AIStudioTabLister] Failed to create item for tab ${tab.id}:`, createErr);
    }
  }
}

/**
 * Schedules context menu updates through a mutex queue to prevent race conditions.
 */
async function scheduleContextMenuUpdate() {
  if (isUpdating) {
    pendingUpdate = true;
    return;
  }
  isUpdating = true;
  try {
    do {
      pendingUpdate = false;
      await updateContextMenu();
    } while (pendingUpdate);
  } catch (err) {
    console.error("[AIStudioTabLister] Error updating context menu:", err);
  } finally {
    isUpdating = false;
  }
}

// --- Event Listeners ---

// Context menu click handling
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.parentMenuItemId === PARENT_MENU_ID && String(info.menuItemId).startsWith("tab-")) {
    const tabId = parseInt(String(info.menuItemId).replace("tab-", ""), 10);
    if (!isNaN(tabId)) {
      try {
        const targetTab = await chrome.tabs.update(tabId, { active: true });
        if (targetTab && targetTab.windowId) {
          await chrome.windows.update(targetTab.windowId, { focused: true });
        }
      } catch (err) {
        console.warn(`[AIStudioTabLister] Could not focus tab ${tabId}:`, err);
        scheduleContextMenuUpdate();
      }
    }
  }
});

// Extension toolbar action click handling: switch to first AI Studio tab or open a new one
chrome.action.onClicked.addListener(async () => {
  try {
    const tabs = await chrome.tabs.query({ url: AI_STUDIO_URL_PATTERN });
    if (tabs && tabs.length > 0) {
      const targetTab = tabs[0];
      await chrome.tabs.update(targetTab.id, { active: true });
      if (targetTab.windowId) {
        await chrome.windows.update(targetTab.windowId, { focused: true });
      }
    } else {
      await chrome.tabs.create({ url: AI_STUDIO_BASE_URL });
    }
  } catch (err) {
    console.error("[AIStudioTabLister] Error handling action click:", err);
  }
});

// Lifecycle and tab state listeners
chrome.runtime.onInstalled.addListener(() => {
  scheduleContextMenuUpdate();
});

chrome.runtime.onStartup.addListener(() => {
  scheduleContextMenuUpdate();
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === "complete" || changeInfo.title || changeInfo.url) {
    scheduleContextMenuUpdate();
  }
});

chrome.tabs.onCreated.addListener(() => {
  scheduleContextMenuUpdate();
});

chrome.tabs.onRemoved.addListener(() => {
  scheduleContextMenuUpdate();
});

chrome.tabs.onReplaced.addListener(() => {
  scheduleContextMenuUpdate();
});

// Initial startup synchronization
scheduleContextMenuUpdate();