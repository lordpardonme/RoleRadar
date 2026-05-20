import type { AutofillPlan, ContactEmail, FormFieldDescriptor, JobPosting } from "@job-fit-hunter/shared";
import type { ContentMessage, PageScan } from "./messages";

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
  const pageText = visibleText();
  const cultureUrls = extractCultureUrls();
  return {
    pageUrl: location.href,
    pageTitle: document.title,
    pageText,
    jobs: extractJobs(pageText, cultureUrls),
    cultureUrls,
    contacts: {
      emails: extractEmails(pageText, [...document.querySelectorAll<HTMLAnchorElement>("a[href]")].map((anchor) => anchor.href))
    }
  };
}

function visibleText(): string {
  return normalize((document.body?.innerText ?? "").slice(0, 30000));
}

function extractJobs(pageText: string, cultureUrls: string[]): JobPosting[] {
  const jsonLdJobs = extractJsonLdJobs(cultureUrls);
  if (jsonLdJobs.length) return jsonLdJobs;

  const linkedJobs = extractLinkedJobs(cultureUrls);
  if (linkedJobs.length) return linkedJobs;

  const current = extractCurrentPageJob(pageText, cultureUrls);
  return current ? [current] : [];
}

function extractJsonLdJobs(cultureUrls: string[]): JobPosting[] {
  const jobs: JobPosting[] = [];
  const scripts = document.querySelectorAll<HTMLScriptElement>('script[type="application/ld+json"]');
  scripts.forEach((script) => {
    try {
      const parsed = JSON.parse(script.textContent ?? "");
      const nodes = flattenJsonLd(parsed);
      nodes
        .filter((node) => typeIncludes(node, "JobPosting"))
        .forEach((node) => {
          const title = textFrom(node.title);
          const description = stripHtml(textFrom(node.description));
          if (!title || !description) return;
          jobs.push({
            id: stableId(`${location.href}:${title}`),
            sourceUrl: location.href,
            title,
            ...(textFrom(node.hiringOrganization?.name) ? { company: textFrom(node.hiringOrganization.name) } : {}),
            ...(locationFrom(node.jobLocation) ? { location: locationFrom(node.jobLocation) } : {}),
            description,
            ...(textFrom(node.employmentType) ? { employmentType: textFrom(node.employmentType) } : {}),
            ...(textFrom(node.baseSalary?.value?.value) ? { salaryText: textFrom(node.baseSalary.value.value) } : {}),
            applyUrl: location.href,
            cultureUrls,
            extractedAt: new Date().toISOString()
          });
        });
    } catch {
      // Ignore malformed third-party structured data.
    }
  });
  return dedupeJobs(jobs);
}

function flattenJsonLd(input: unknown): Array<Record<string, any>> {
  if (Array.isArray(input)) return input.flatMap(flattenJsonLd);
  if (!input || typeof input !== "object") return [];
  const node = input as Record<string, any>;
  return [node, ...flattenJsonLd(node["@graph"])];
}

function typeIncludes(node: Record<string, any>, type: string): boolean {
  const value = node["@type"];
  return Array.isArray(value) ? value.includes(type) : value === type;
}

function extractLinkedJobs(cultureUrls: string[]): JobPosting[] {
  const anchors = [...document.querySelectorAll<HTMLAnchorElement>("a[href]")];
  const candidates = anchors.filter((anchor) => {
    const text = normalize(anchor.innerText);
    const href = anchor.href.toLowerCase();
    return text.length > 3 && text.length < 120 && /job|career|opening|position|greenhouse|lever|ashby|workday/.test(`${href} ${text.toLowerCase()}`);
  });

  return dedupeJobs(candidates.slice(0, 30).map((anchor) => {
    const card = anchor.closest("li, article, section, div");
    const description = normalize((card as HTMLElement | null)?.innerText ?? anchor.innerText);
    return {
      id: stableId(anchor.href),
      sourceUrl: location.href,
      title: normalize(anchor.innerText),
      ...(guessCompany() ? { company: guessCompany() } : {}),
      ...(guessLocation(description) ? { location: guessLocation(description) } : {}),
      description: description || normalize(document.body?.innerText ?? "").slice(0, 1200),
      applyUrl: anchor.href,
      cultureUrls,
      extractedAt: new Date().toISOString()
    };
  }));
}

function extractCurrentPageJob(pageText: string, cultureUrls: string[]): JobPosting | undefined {
  const title = normalize(document.querySelector("h1")?.textContent ?? document.title);
  if (!title) return undefined;
  const looksLikeJob = /responsibilities|requirements|qualifications|apply|experience|salary|benefits/i.test(pageText);
  if (!looksLikeJob) return undefined;
  return {
    id: stableId(location.href),
    sourceUrl: location.href,
    title,
    ...(guessCompany() ? { company: guessCompany() } : {}),
    ...(guessLocation(pageText) ? { location: guessLocation(pageText) } : {}),
    description: pageText.slice(0, 12000),
    applyUrl: location.href,
    cultureUrls,
    extractedAt: new Date().toISOString()
  };
}

function extractCultureUrls(): string[] {
  const seen = new Set<string>();
  const urls: string[] = [];
  [...document.querySelectorAll<HTMLAnchorElement>("a[href]")].forEach((anchor) => {
    const label = `${anchor.innerText} ${anchor.href}`.toLowerCase();
    if (!/culture|values|about|life-at|benefits|mission|careers/.test(label)) return;
    if (seen.has(anchor.href)) return;
    seen.add(anchor.href);
    urls.push(anchor.href);
  });
  return urls.slice(0, 8);
}

function extractForms(): FormFieldDescriptor[] {
  const controls = [...document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>("input, textarea, select")];
  return controls
    .filter((control) => !["hidden", "submit", "button", "reset"].includes(control.type))
    .map((control) => ({
      selector: selectorFor(control),
      label: labelFor(control),
      ...(control.getAttribute("name") ? { name: control.getAttribute("name") ?? undefined } : {}),
      type: control.type || control.tagName.toLowerCase(),
      required: control.required,
      ...(control instanceof HTMLSelectElement ? { options: [...control.options].map((option) => option.text) } : {})
    }));
}

function applyAutofill(plan: AutofillPlan): { applied: number; skipped: string[] } {
  let applied = 0;
  const skipped: string[] = [];
  plan.fields.forEach((field) => {
    const control = document.querySelector<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(field.selector);
    if (!control) {
      skipped.push(`${field.label}: field not found`);
      return;
    }
    if (field.requiresUserAction || control.type === "file") {
      skipped.push(`${field.label}: manual action required`);
      return;
    }
    setControlValue(control, field.value);
    applied += 1;
  });
  return { applied, skipped };
}

function setControlValue(control: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement, value: string): void {
  if (control instanceof HTMLSelectElement) {
    const option = [...control.options].find((item) => item.text.toLowerCase().includes(value.toLowerCase()) || item.value.toLowerCase() === value.toLowerCase());
    if (option) control.value = option.value;
  } else if (control.type === "checkbox" || control.type === "radio") {
    control.checked = /yes|true|authorized|remote/i.test(value);
  } else {
    control.value = value;
  }
  control.dispatchEvent(new Event("input", { bubbles: true }));
  control.dispatchEvent(new Event("change", { bubbles: true }));
}

function labelFor(control: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement): string {
  const id = control.id ? document.querySelector<HTMLLabelElement>(`label[for="${cssEscape(control.id)}"]`)?.innerText : undefined;
  const wrapped = control.closest("label")?.textContent;
  return normalize(id ?? wrapped ?? control.getAttribute("aria-label") ?? control.getAttribute("placeholder") ?? control.name ?? control.id ?? control.type);
}

function selectorFor(element: Element): string {
  if (element.id) return `#${cssEscape(element.id)}`;
  const name = element.getAttribute("name");
  if (name) return `${element.tagName.toLowerCase()}[name="${cssEscape(name)}"]`;
  const path: string[] = [];
  let current: Element | null = element;
  while (current && current !== document.body) {
    const parent = current.parentElement;
    if (!parent) break;
    const siblings = [...parent.children].filter((child) => child.tagName === current?.tagName);
    const index = siblings.indexOf(current) + 1;
    path.unshift(`${current.tagName.toLowerCase()}:nth-of-type(${index})`);
    current = parent;
  }
  return path.join(" > ");
}

function extractEmails(text: string, hrefs: string[]): ContactEmail[] {
  const regex = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
  const contacts = [
    ...hrefs
      .filter((href) => href.toLowerCase().startsWith("mailto:"))
      .map((href) => href.replace(/^mailto:/i, "").split(/[?,;]/)[0])
      .filter(Boolean)
      .map((email) => ({ email: email!.toLowerCase(), source: "mailto" as const, verified: true })),
    ...(text.match(regex) ?? []).map((email) => ({ email: email.toLowerCase(), source: "page-text" as const, verified: true }))
  ];
  const seen = new Set<string>();
  return contacts.filter((contact) => {
    if (seen.has(contact.email)) return false;
    seen.add(contact.email);
    return true;
  });
}

function guessCompany(): string | undefined {
  const meta = document.querySelector<HTMLMetaElement>('meta[property="og:site_name"], meta[name="application-name"]')?.content;
  if (meta) return normalize(meta);
  const parts = document.title.split(/[-|]/).map((part) => normalize(part)).filter(Boolean);
  return parts.length > 1 ? parts.at(-1) : undefined;
}

function guessLocation(text: string): string | undefined {
  const match = text.match(/\b(Remote|Hybrid|Onsite|New York|San Francisco|London|Austin|Seattle|Bengaluru|Bangalore|Hyderabad|Mumbai|Delhi|Pune)\b/i);
  return match?.[0];
}

function locationFrom(input: any): string | undefined {
  if (!input) return undefined;
  const node = Array.isArray(input) ? input[0] : input;
  const address = node?.address;
  return normalize([address?.addressLocality, address?.addressRegion, address?.addressCountry].filter(Boolean).join(", "));
}

function textFrom(input: unknown): string {
  if (Array.isArray(input)) return normalize(input.join(", "));
  if (input === undefined || input === null) return "";
  return normalize(String(input));
}

function stripHtml(input: string): string {
  const template = document.createElement("template");
  template.innerHTML = input;
  return normalize(template.content.textContent ?? input);
}

function dedupeJobs(jobs: JobPosting[]): JobPosting[] {
  const seen = new Set<string>();
  return jobs.filter((job) => {
    const key = `${job.title.toLowerCase()}|${job.applyUrl ?? job.sourceUrl}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function stableId(value: string): string {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(index);
    hash |= 0;
  }
  return `job_${Math.abs(hash)}`;
}

function normalize(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function cssEscape(value: string): string {
  return globalThis.CSS?.escape ? CSS.escape(value) : value.replace(/["\\#.:,[\]>+~*]/g, "\\$&");
}
