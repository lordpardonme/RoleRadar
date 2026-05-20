import type { AutofillPlan } from "@job-fit-hunter/shared";
import type { ContentMessage, ExtensionMessage, RuntimeResponse } from "./messages";

const CONTENT_FILE = "assets/contentRuntime.js";

chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel?.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => undefined);
});

chrome.action.onClicked.addListener(async (tab) => {
  if (tab.id) await chrome.sidePanel?.open({ tabId: tab.id });
});

chrome.runtime.onMessage.addListener((message: ExtensionMessage, _sender, sendResponse) => {
  handleMessage(message)
    .then((data) => sendResponse({ ok: true, data } satisfies RuntimeResponse<unknown>))
    .catch((error: unknown) => sendResponse({ ok: false, error: error instanceof Error ? error.message : String(error) }));
  return true;
});

async function handleMessage(message: ExtensionMessage): Promise<unknown> {
  switch (message.type) {
    case "SCAN_PAGE":
      return sendToActiveTab({ type: "CONTENT_SCAN" });
    case "EXTRACT_FORMS":
      return sendToActiveTab({ type: "CONTENT_EXTRACT_FORMS" });
    case "APPLY_AUTOFILL":
      return sendToActiveTab({ type: "CONTENT_APPLY_AUTOFILL", plan: message.plan });
    case "PREVIEW_AUTOFILL":
      return message.fields;
    case "SCORE_JOB":
    case "DRAFT_EMAIL":
      return message.job;
    default:
      return assertNever(message);
  }
}

async function sendToActiveTab(message: ContentMessage): Promise<unknown> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) throw new Error("No active tab found.");
  await ensureContentRuntime(tab.id);
  return chrome.tabs.sendMessage(tab.id, message);
}

async function ensureContentRuntime(tabId: number): Promise<void> {
  try {
    await chrome.tabs.sendMessage(tabId, { type: "CONTENT_PING" } satisfies ContentMessage);
    return;
  } catch {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: [CONTENT_FILE]
    });
  }
}

function assertNever(value: never): never {
  throw new Error(`Unhandled extension message: ${JSON.stringify(value)}`);
}

void ({} as AutofillPlan);
