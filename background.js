const PARENT_MENU_ID = "aiStudioParentMenu";
let updateTimeout;

// This function is injected into the page to find the chat's title.
function getChatTitleFromPage() {
  // We will try a list of potential CSS selectors to find the title element.
  // This makes the extension more robust against site updates.
  const selectors = [
    'h1[contenteditable="true"]',      // The original selector
    'div[aria-label^="Chat title"]',   // A selector based on accessibility attributes
    'div.chat-title',                 // A hypothetical class-based selector
    'h1'                              // A general H1 tag as a last resort
  ];

  for (const selector of selectors) {
    const element = document.querySelector(selector);
    if (element && element.innerText && element.innerText.trim() !== "") {
      const title = element.innerText.trim();
      // Ensure we don't just return the placeholder text as a valid title
      if (title.toLowerCase() !== "untitled chat") {
        return title; // Success! We found the title.
      }
    }
  }

  // If none of the selectors found a valid title, return the default.
  return "Untitled Chat";
}

// This is the core function that rebuilds the context menu.
function updateContextMenu() {
  if (updateTimeout) {
    clearTimeout(updateTimeout);
  }
  chrome.contextMenus.removeAll(() => {
    if (chrome.runtime.lastError) {} // Ignore errors

    chrome.contextMenus.create({
      id: PARENT_MENU_ID,
      title: "AI Studio Tabs",
      contexts: ["page"]
    });

    chrome.tabs.query({ url: "https://aistudio.google.com/*" }, (tabs) => {
      if (tabs.length === 0) {
        chrome.contextMenus.create({
          id: "no-tabs-found",
          title: "No AI Studio tabs found",
          parentId: PARENT_MENU_ID,
          contexts: ["page"],
          enabled: false
        });
        return;
      }

      tabs.forEach(tab => {
        // We only inject if the tab is fully loaded to avoid timing issues.
        if (tab.status === "complete") {
          chrome.scripting.executeScript({
            target: { tabId: tab.id },
            function: getChatTitleFromPage,
          }, (injectionResults) => {
            if (chrome.runtime.lastError || !injectionResults || !injectionResults[0]) {
              return;
            }
            const chatTitle = injectionResults[0].result;
            chrome.contextMenus.create({
              id: `tab-${tab.id}`,
              title: chatTitle,
              parentId: PARENT_MENU_ID,
              contexts: ["page"]
            });
          });
        }
      });
    });
  });
}

// Schedules an update to the context menu.
function scheduleUpdate() {
  if (updateTimeout) {
    clearTimeout(updateTimeout);
  }
  updateTimeout = setTimeout(updateContextMenu, 150);
}

// --- Event Listeners ---

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.parentMenuItemId === PARENT_MENU_ID && info.menuItemId.toString().startsWith('tab-')) {
    const tabId = parseInt(info.menuItemId.replace('tab-', ''));
    chrome.tabs.update(tabId, { active: true });
    chrome.tabs.get(tabId, (tabToFocus) => {
      if (tabToFocus) {
        chrome.windows.update(tabToFocus.windowId, { focused: true });
      }
    });
  }
});

chrome.tabs.onUpdated.addListener(scheduleUpdate);
chrome.tabs.onCreated.addListener(scheduleUpdate);
chrome.tabs.onRemoved.addListener(scheduleUpdate);
chrome.runtime.onInstalled.addListener(updateContextMenu);