import type { AutofillPlan } from "@job-fit-hunter/shared";
import type { ContentMessage } from "./messages";
import type { PageScan } from "./messages";
import { applyAutofillPlanToDocument, extractFormFieldsFromDocument, extractPageScanFromDocument } from "./content/extractors";

declare global {
  interface Window {
    __jobFitHunterContentLoaded?: boolean;
  }
}

if (!window.__jobFitHunterContentLoaded) {
  window.__jobFitHunterContentLoaded = true;
  chrome.runtime.onMessage.addListener((message: ContentMessage, _sender, sendResponse) => {
    try {
      if (message.type === "CONTENT_PING") sendResponse({ ready: true });
      if (message.type === "CONTENT_SCAN") sendResponse(scanPage());
      if (message.type === "CONTENT_EXTRACT_FORMS") sendResponse(extractForms());
      if (message.type === "CONTENT_APPLY_AUTOFILL") sendResponse(applyAutofill(message.plan));
    } catch (error) {
      sendResponse({ error: error instanceof Error ? error.message : String(error) });
    }
    return true;
  });
}

function scanPage(): PageScan {
  return extractPageScanFromDocument(document, location.href, document.title);
}

function extractForms() {
  return extractFormFieldsFromDocument(document);
}

function applyAutofill(plan: AutofillPlan) {
  return applyAutofillPlanToDocument(document, plan);
}
