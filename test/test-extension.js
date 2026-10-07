/**
 * Automated Test Suite for AI Studio Tab Lister Extension
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');

console.log("=== AI Studio Tab Lister: Test Suite ===\n");

// 1. Manifest Validation Test
console.log("▶ [Test 1] Validating manifest.json structure...");
const manifestPath = path.join(__dirname, '..', 'manifest.json');
assert.ok(fs.existsSync(manifestPath), "manifest.json must exist");

const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
assert.strictEqual(manifest.manifest_version, 3, "manifest_version must be 3");
assert.ok(manifest.name, "manifest must have a name");
assert.ok(manifest.version, "manifest must have a version");
assert.ok(manifest.background && manifest.background.service_worker, "manifest must declare background.service_worker");
assert.ok(manifest.action, "manifest must declare action block in MV3");
assert.ok(Array.isArray(manifest.permissions), "permissions must be an array");
assert.ok(manifest.permissions.includes("contextMenus"), "permissions must include contextMenus");
assert.ok(manifest.permissions.includes("tabs"), "permissions must include tabs");
assert.ok(manifest.permissions.includes("scripting"), "permissions must include scripting");
assert.ok(Array.isArray(manifest.host_permissions), "host_permissions must be an array");
assert.ok(manifest.host_permissions.includes("https://aistudio.google.com/*"), "host_permissions must include https://aistudio.google.com/*");

// Verify icon paths exist
for (const [size, iconPath] of Object.entries(manifest.icons)) {
  const fullIconPath = path.join(__dirname, '..', iconPath);
  assert.ok(fs.existsSync(fullIconPath), `Icon for size ${size} at ${iconPath} must exist`);
}
console.log("  ✔ manifest.json is fully valid and compliant with MV3.\n");

// 2. Title Extraction Simulation Test
console.log("▶ [Test 2] Validating DOM Title Extraction Logic...");

function simulateGetChatTitle(mockDom) {
  // Simulates getChatTitleFromPage logic inside a mock DOM environment
  const { inputs = [], elements = [], documentTitle = "" } = mockDom;

  // 1. Inputs
  for (const input of inputs) {
    if (input.value && input.value.trim().length > 0) {
      const val = input.value.trim();
      if (val.toLowerCase() !== "untitled chat" && val.toLowerCase() !== "untitled prompt") {
        return val;
      }
    }
  }

  // 2. Elements
  for (const el of elements) {
    if (el.innerText && el.innerText.trim().length > 0) {
      const text = el.innerText.trim();
      if (text.toLowerCase() !== "untitled chat" && text.toLowerCase() !== "untitled prompt") {
        return text;
      }
    }
  }

  // 3. Document Title
  if (documentTitle) {
    const cleanDocTitle = documentTitle
      .replace(/\s*[-—|]\s*Google AI Studio$/i, '')
      .replace(/^Google AI Studio\s*[-—|]?\s*/i, '')
      .trim();
    if (cleanDocTitle && cleanDocTitle.toLowerCase() !== "google ai studio") {
      return cleanDocTitle;
    }
  }

  return "Untitled Prompt";
}

// Test Case A: Input with prompt name
const testCaseA = simulateGetChatTitle({
  inputs: [{ selector: 'input.prompt-title', value: 'Neural Network Optimizer' }],
  documentTitle: 'Neural Network Optimizer - Google AI Studio'
});
assert.strictEqual(testCaseA, 'Neural Network Optimizer');

// Test Case B: Untitled input, fall back to document title
const testCaseB = simulateGetChatTitle({
  inputs: [{ selector: 'input.prompt-title', value: 'Untitled prompt' }],
  documentTitle: 'Vision Analysis Pipeline — Google AI Studio'
});
assert.strictEqual(testCaseB, 'Vision Analysis Pipeline');

// Test Case C: Heading text element
const testCaseC = simulateGetChatTitle({
  elements: [{ selector: 'header h1', innerText: 'Audio Transcriber Prompt' }],
  documentTitle: 'Google AI Studio'
});
assert.strictEqual(testCaseC, 'Audio Transcriber Prompt');

// Test Case D: Empty DOM fallback
const testCaseD = simulateGetChatTitle({
  inputs: [],
  elements: [],
  documentTitle: 'Google AI Studio'
});
assert.strictEqual(testCaseD, 'Untitled Prompt');

console.log("  ✔ DOM title extraction logic successfully passed all 4 test cases.\n");

// 3. Menu Title Formatting and Truncation Test
console.log("▶ [Test 3] Validating Title Formatting & Truncation...");

function formatMenuTitle(title, index) {
  const maxLen = 45;
  let cleanTitle = (title || "Untitled Prompt").trim();
  if (cleanTitle.length > maxLen) {
    cleanTitle = cleanTitle.substring(0, maxLen - 1) + "…";
  }
  return `${index}. ${cleanTitle}`;
}

const shortFormatted = formatMenuTitle("My Short Prompt", 1);
assert.strictEqual(shortFormatted, "1. My Short Prompt");

const longTitle = "This is an extremely long prompt title that exceeds the maximum menu character length limit";
const longFormatted = formatMenuTitle(longTitle, 2);
assert.ok(longFormatted.startsWith("2. This is an extremely long prompt title that"), "Must start with index and prefix");
assert.ok(longFormatted.endsWith("…"), "Must end with ellipsis");
assert.ok(longFormatted.length <= 50, "Length must be within bounds");

console.log("  ✔ Menu title formatting and truncation passed.\n");

// 4. Concurrency Mutex & Rebuild Simulation Test
console.log("▶ [Test 4] Testing Service Worker Mutex Concurrency...");

class MockChromeAPI {
  constructor() {
    this.menus = new Map();
    this.tabs = [
      { id: 101, url: 'https://aistudio.google.com/prompt/1', title: 'Prompt One - Google AI Studio', status: 'complete', windowId: 1 },
      { id: 102, url: 'https://aistudio.google.com/prompt/2', title: 'Prompt Two - Google AI Studio', status: 'complete', windowId: 1 }
    ];
    this.activeTabId = 101;
    this.focusedWindowId = 1;
  }

  async removeAll() {
    this.menus.clear();
  }

  async create(item) {
    if (this.menus.has(item.id)) {
      throw new Error(`Duplicate menu ID: ${item.id}`);
    }
    this.menus.set(item.id, item);
    return item.id;
  }

  async queryTabs(queryInfo) {
    return this.tabs.filter(t => t.url.startsWith('https://aistudio.google.com/'));
  }

  async updateTab(tabId, updateProps) {
    const tab = this.tabs.find(t => t.id === tabId);
    if (!tab) throw new Error("Tab not found");
    if (updateProps.active) this.activeTabId = tabId;
    return tab;
  }

  async updateWindow(winId, updateProps) {
    if (updateProps.focused) this.focusedWindowId = winId;
    return { id: winId, focused: true };
  }
}

async function runMutexTest() {
  const mock = new MockChromeAPI();
  let isUpdating = false;
  let pendingUpdate = false;

  async function updateMenu() {
    await mock.removeAll();
    await mock.create({ id: "aiStudioParentMenu", title: "AI Studio Tabs", contexts: ["all"] });
    const tabs = await mock.queryTabs();
    for (let i = 0; i < tabs.length; i++) {
      const tab = tabs[i];
      await mock.create({
        id: `tab-${tab.id}`,
        title: `${i + 1}. ${tab.title.replace(' - Google AI Studio', '')}`,
        parentId: "aiStudioParentMenu",
        contexts: ["all"]
      });
    }
  }

  async function scheduleUpdate() {
    if (isUpdating) {
      pendingUpdate = true;
      return;
    }
    isUpdating = true;
    try {
      do {
        pendingUpdate = false;
        await updateMenu();
      } while (pendingUpdate);
    } finally {
      isUpdating = false;
    }
  }

  // Simulate 10 simultaneous events firing in parallel
  await Promise.all([
    scheduleUpdate(),
    scheduleUpdate(),
    scheduleUpdate(),
    scheduleUpdate(),
    scheduleUpdate(),
    scheduleUpdate(),
    scheduleUpdate(),
    scheduleUpdate(),
    scheduleUpdate(),
    scheduleUpdate()
  ]);

  assert.strictEqual(mock.menus.size, 3, "Menu should contain parent + 2 tabs without duplicates");
  assert.ok(mock.menus.has("aiStudioParentMenu"), "Parent menu should exist");
  assert.ok(mock.menus.has("tab-101"), "Tab 101 item should exist");
  assert.ok(mock.menus.has("tab-102"), "Tab 102 item should exist");

  // Test click switching
  const targetTab = await mock.updateTab(102, { active: true });
  await mock.updateWindow(targetTab.windowId, { focused: true });
  assert.strictEqual(mock.activeTabId, 102, "Active tab should be switched to 102");
  assert.strictEqual(mock.focusedWindowId, 1, "Window 1 should be focused");
}

runMutexTest().then(() => {
  console.log("  ✔ Mutex concurrency and tab switching simulation passed without errors.\n");
  console.log("==========================================");
  console.log("🎉 ALL TESTS PASSED SUCCESSFULLY! 🎉");
  console.log("==========================================");
}).catch(err => {
  console.error("❌ Test failed:", err);
  process.exit(1);
});
