import type { AutofillPlan, ContactEmail, FormFieldDescriptor, JobPosting } from "@job-fit-hunter/shared";
import type { PageScan } from "../messages";

export function extractPageScanFromDocument(
  doc: Document,
  pageUrl: string,
  pageTitle = doc.title,
  now = new Date()
): PageScan {
  const pageText = visibleText(doc);
  const cultureUrls = extractCultureUrls(doc);
  return {
    pageUrl,
    pageTitle,
    pageText,
    jobs: extractJobsFromDocument(doc, pageUrl, pageTitle, pageText, cultureUrls, now),
    cultureUrls,
    contacts: {
      emails: extractEmails(pageText, [...doc.querySelectorAll<HTMLAnchorElement>("a[href]")].map((anchor) => anchor.href))
    }
  };
}

export function extractFormFieldsFromDocument(doc: Document): FormFieldDescriptor[] {
  const controls = [...doc.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>("input, textarea, select")];
  return controls
    .filter((control) => !["hidden", "submit", "button", "reset"].includes(control.type))
    .map((control) => {
      const name = control.getAttribute("name");
      return {
        selector: selectorFor(doc, control),
        label: labelFor(doc, control),
        ...(name ? { name } : {}),
        type: control.type || control.tagName.toLowerCase(),
        required: control.required,
        ...(control instanceof HTMLSelectElement ? { options: [...control.options].map((option) => option.text) } : {})
      };
    });
}

export function applyAutofillPlanToDocument(doc: Document, plan: AutofillPlan): { applied: number; skipped: string[] } {
  let applied = 0;
  const skipped: string[] = [];
  plan.fields.forEach((field) => {
    const control = doc.querySelector<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(field.selector);
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

export function extractJobsFromDocument(
  doc: Document,
  pageUrl: string,
  pageTitle: string,
  pageText: string,
  cultureUrls: string[],
  now = new Date()
): JobPosting[] {
  const jsonLdJobs = extractJsonLdJobs(doc, pageUrl, cultureUrls, now);
  if (jsonLdJobs.length) return jsonLdJobs;

  const linkedJobs = extractLinkedJobs(doc, pageUrl, pageTitle, pageText, cultureUrls, now);
  if (linkedJobs.length) return linkedJobs;

  const current = extractCurrentPageJob(doc, pageUrl, pageTitle, pageText, cultureUrls, now);
  return current ? [current] : [];
}

function visibleText(doc: Document): string {
  const body = doc.body as HTMLElement | null;
  return normalize((body?.innerText ?? body?.textContent ?? "").slice(0, 30000));
}

function extractJsonLdJobs(doc: Document, pageUrl: string, cultureUrls: string[], now: Date): JobPosting[] {
  const jobs: JobPosting[] = [];
  const scripts = doc.querySelectorAll<HTMLScriptElement>('script[type="application/ld+json"]');
  scripts.forEach((script) => {
    try {
      const parsed = JSON.parse(script.textContent ?? "");
      const nodes = flattenJsonLd(parsed);
      nodes
        .filter((node) => typeIncludes(node, "JobPosting"))
        .forEach((node) => {
          const title = textFrom(node.title);
          const description = stripHtml(doc, textFrom(node.description));
          const company = textFrom(node.hiringOrganization?.name);
          const locationText = locationFrom(node.jobLocation);
          const employmentType = textFrom(node.employmentType);
          const salaryText = textFrom(node.baseSalary?.value?.value ?? node.baseSalary?.value);
          const applyUrl = textFrom(node.url) || pageUrl;
          if (!title || !description) return;
          jobs.push({
            id: stableId(`${applyUrl}:${title}`),
            sourceUrl: pageUrl,
            title,
            ...(company ? { company } : {}),
            ...(locationText ? { location: locationText } : {}),
            description,
            ...(employmentType ? { employmentType } : {}),
            ...(salaryText ? { salaryText } : {}),
            applyUrl,
            cultureUrls,
            extractedAt: now.toISOString()
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

function extractLinkedJobs(
  doc: Document,
  pageUrl: string,
  pageTitle: string,
  pageText: string,
  cultureUrls: string[],
  now: Date
): JobPosting[] {
  const anchors = [...doc.querySelectorAll<HTMLAnchorElement>("a[href]")];
  const candidates = anchors.filter((anchor) => {
    const text = normalize(anchor.innerText || anchor.textContent || "");
    const href = anchor.href.toLowerCase();
    return text.length > 3 && text.length < 120 && /job|career|opening|position|greenhouse|lever|ashby|workday/.test(`${href} ${text.toLowerCase()}`);
  });

  return dedupeJobs(candidates.slice(0, 30).map((anchor) => {
    const card = anchor.closest("li") ?? anchor.closest("article") ?? anchor.closest("section") ?? anchor.closest("div") ?? anchor.parentElement;
    const description = normalize(elementText(card) || anchor.innerText || anchor.textContent || "");
    const company = guessCompany(doc, pageTitle);
    const locationText = guessLocation(`${description} ${elementText(anchor.parentElement)}`);
    return {
      id: stableId(anchor.href),
      sourceUrl: pageUrl,
      title: normalize(anchor.innerText || anchor.textContent || ""),
      ...(company ? { company } : {}),
      ...(locationText ? { location: locationText } : {}),
      description: description || pageText.slice(0, 1200),
      applyUrl: anchor.href,
      cultureUrls,
      extractedAt: now.toISOString()
    };
  }));
}

function extractCurrentPageJob(
  doc: Document,
  pageUrl: string,
  pageTitle: string,
  pageText: string,
  cultureUrls: string[],
  now: Date
): JobPosting | undefined {
  const title = normalize(doc.querySelector("h1")?.textContent ?? pageTitle);
  if (!title) return undefined;
  const looksLikeJob = /responsibilities|requirements|qualifications|apply|experience|salary|benefits/i.test(pageText);
  if (!looksLikeJob) return undefined;
  const company = guessCompany(doc, pageTitle);
  const locationText = guessLocation(pageText);
  return {
    id: stableId(pageUrl),
    sourceUrl: pageUrl,
    title,
    ...(company ? { company } : {}),
    ...(locationText ? { location: locationText } : {}),
    description: pageText.slice(0, 12000),
    applyUrl: pageUrl,
    cultureUrls,
    extractedAt: now.toISOString()
  };
}

function extractCultureUrls(doc: Document): string[] {
  const seen = new Set<string>();
  const urls: string[] = [];
  [...doc.querySelectorAll<HTMLAnchorElement>("a[href]")].forEach((anchor) => {
    const label = `${anchor.innerText || anchor.textContent || ""} ${anchor.href}`.toLowerCase();
    if (!/culture|values|about|life-at|benefits|mission/.test(label)) return;
    if (seen.has(anchor.href)) return;
    seen.add(anchor.href);
    urls.push(anchor.href);
  });
  return urls.slice(0, 8);
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

function setControlValue(control: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement, value: string): void {
  if (control instanceof HTMLSelectElement) {
    const option = [...control.options].find((item) => item.text.toLowerCase().includes(value.toLowerCase()) || item.value.toLowerCase() === value.toLowerCase());
    if (option) control.value = option.value;
  } else if (control instanceof HTMLInputElement && (control.type === "checkbox" || control.type === "radio")) {
    control.checked = /yes|true|authorized|remote/i.test(value);
  } else {
    control.value = value;
  }
  control.dispatchEvent(new Event("input", { bubbles: true }));
  control.dispatchEvent(new Event("change", { bubbles: true }));
}

function labelFor(doc: Document, control: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement): string {
  const id = control.id ? doc.querySelector<HTMLLabelElement>(`label[for="${cssEscape(control.id)}"]`)?.innerText : undefined;
  const wrapped = control.closest("label")?.textContent;
  return normalize(id ?? wrapped ?? control.getAttribute("aria-label") ?? control.getAttribute("placeholder") ?? control.name ?? control.id ?? control.type);
}

function selectorFor(doc: Document, element: Element): string {
  if (element.id) return `#${cssEscape(element.id)}`;
  const name = element.getAttribute("name");
  if (name) return `${element.tagName.toLowerCase()}[name="${cssEscape(name)}"]`;
  const path: string[] = [];
  let current: Element | null = element;
  while (current && current !== doc.body) {
    const parent: Element | null = current.parentElement;
    if (!parent) break;
    const tagName = current.tagName;
    const siblings = [...parent.children].filter((child) => child.tagName === tagName);
    const index = siblings.indexOf(current) + 1;
    path.unshift(`${current.tagName.toLowerCase()}:nth-of-type(${index})`);
    current = parent;
  }
  return path.join(" > ");
}

function guessCompany(doc: Document, pageTitle: string): string | undefined {
  const meta = doc.querySelector<HTMLMetaElement>('meta[property="og:site_name"], meta[name="application-name"]')?.content;
  if (meta) return normalize(meta);
  const parts = pageTitle.split(/[-|]/).map((part) => normalize(part)).filter(Boolean);
  return parts.length > 1 ? parts.at(-1) : undefined;
}

function elementText(element: Element | null): string {
  if (!element) return "";
  const innerHtml = (element as HTMLElement).innerHTML;
  if (innerHtml) return innerHtml.replace(/<[^>]+>/g, " ");
  const innerText = (element as HTMLElement).innerText;
  if (innerText) return innerText;
  const childText = [...element.childNodes].map((node) => node.textContent ?? "").filter(Boolean).join(" ");
  return childText || element.textContent || "";
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

function stripHtml(doc: Document, input: string): string {
  const template = doc.createElement("template");
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
  return typeof CSS !== "undefined" && typeof CSS.escape === "function"
    ? CSS.escape(value)
    : value.replace(/["\\#.:,[\]>+~*]/g, "\\$&");
}
