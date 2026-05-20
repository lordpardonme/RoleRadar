// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import { applyAutofillPlanToDocument, extractFormFieldsFromDocument, extractPageScanFromDocument } from "./extractors";

const NOW = new Date("2026-05-21T00:00:00.000Z");

describe("content extractors", () => {
  it("extracts JSON-LD job postings from ATS pages", () => {
    render(`
      <head>
        <base href="https://boards.greenhouse.io/acme/">
        <title>Senior Software Engineer - Acme</title>
        <meta property="og:site_name" content="Acme">
        <script type="application/ld+json">
          {
            "@context": "https://schema.org",
            "@type": "JobPosting",
            "title": "Senior Software Engineer",
            "description": "<p>Build React, TypeScript, Node.js products. 5 years experience.</p>",
            "hiringOrganization": { "name": "Acme" },
            "jobLocation": { "address": { "addressLocality": "Austin", "addressRegion": "TX", "addressCountry": "US" } },
            "employmentType": "FULL_TIME",
            "url": "https://boards.greenhouse.io/acme/jobs/123"
          }
        </script>
      </head>
      <body>
        <a href="/acme">Careers</a>
        <a href="https://acme.com/culture">Culture</a>
        <a href="mailto:talent@acme.com">Email talent</a>
      </body>
    `);

    const scan = extractPageScanFromDocument(document, "https://boards.greenhouse.io/acme/jobs/123", document.title, NOW);

    expect(scan.jobs).toHaveLength(1);
    expect(scan.jobs[0]).toMatchObject({
      title: "Senior Software Engineer",
      company: "Acme",
      location: "Austin, TX, US",
      employmentType: "FULL_TIME",
      applyUrl: "https://boards.greenhouse.io/acme/jobs/123"
    });
    expect(scan.cultureUrls).toContain("https://acme.com/culture");
    expect(scan.contacts.emails[0]).toMatchObject({ email: "talent@acme.com", verified: true });
  });

  it("extracts linked jobs from Lever, Ashby, Workday, and generic career lists", () => {
    render(`
      <head>
        <base href="https://acme.com/careers/">
        <title>Acme Careers</title>
        <meta property="og:site_name" content="Acme">
      </head>
      <body>
        <ul>
          <li><a href="https://jobs.lever.co/acme/one">Frontend Engineer</a><span>Remote - React TypeScript</span></li>
          <li><a href="https://jobs.ashbyhq.com/acme/two">Product Manager</a><span>New York - Growth product</span></li>
          <li><a href="https://acme.wd1.myworkdayjobs.com/jobs/three">Data Analyst</a><span>Austin - SQL</span></li>
          <li><a href="https://acme.com/careers/four">Customer Success Manager</a><span>Hybrid - Salesforce</span></li>
        </ul>
      </body>
    `);

    const scan = extractPageScanFromDocument(document, "https://acme.com/careers", document.title, NOW);

    expect(scan.jobs.map((job) => job.title)).toEqual([
      "Frontend Engineer",
      "Product Manager",
      "Data Analyst",
      "Customer Success Manager"
    ]);
    expect(scan.jobs[0]?.company).toBe("Acme");
    expect(scan.jobs[0]?.location).toBe("Remote");
    expect(scan.jobs[3]?.applyUrl).toBe("https://acme.com/careers/four");
  });

  it("falls back to current page when page looks like a job description", () => {
    render(`
      <head><title>Example Labs | Careers</title></head>
      <body>
        <h1>Backend Engineer</h1>
        <main>
          Responsibilities include building Node.js APIs. Requirements include 4 years experience.
          Benefits include remote work and learning budget. Apply through this page.
        </main>
      </body>
    `);

    const scan = extractPageScanFromDocument(document, "https://example.com/backend", document.title, NOW);

    expect(scan.jobs).toHaveLength(1);
    expect(scan.jobs[0]?.title).toBe("Backend Engineer");
    expect(scan.jobs[0]?.company).toBe("Careers");
    expect(scan.jobs[0]?.description).toContain("Responsibilities include");
  });

  it("extracts form fields and applies reviewed autofill without touching files", () => {
    render(`
      <form>
        <label for="firstName">First Name</label>
        <input id="firstName" name="first_name" required>
        <label>Email <input name="email" type="email"></label>
        <label for="resume">Resume</label>
        <input id="resume" type="file" required>
      </form>
    `);

    const fields = extractFormFieldsFromDocument(document);
    expect(fields).toEqual([
      { selector: "#firstName", label: "First Name", name: "first_name", type: "text", required: true },
      { selector: 'input[name="email"]', label: "Email", name: "email", type: "email", required: false },
      { selector: "#resume", label: "Resume", type: "file", required: true }
    ]);

    const result = applyAutofillPlanToDocument(document, {
      fields: [
        { selector: "#firstName", label: "First Name", value: "Ava", confidence: 95, reason: "profile" },
        { selector: "#resume", label: "Resume", value: "", confidence: 100, reason: "manual", requiresUserAction: true }
      ],
      warnings: []
    });

    expect((document.querySelector("#firstName") as HTMLInputElement).value).toBe("Ava");
    expect(result.applied).toBe(1);
    expect(result.skipped).toEqual(["Resume: manual action required"]);
  });
});

function render(html: string): void {
  document.documentElement.innerHTML = html;
}
