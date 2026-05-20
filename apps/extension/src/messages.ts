import type { AutofillPlan, ContactEmail, FormFieldDescriptor, JobPosting } from "@job-fit-hunter/shared";

export interface PageScan {
  pageUrl: string;
  pageTitle: string;
  pageText: string;
  jobs: JobPosting[];
  cultureUrls: string[];
  contacts: {
    emails: ContactEmail[];
  };
}

export type ExtensionMessage =
  | { type: "SCAN_PAGE" }
  | { type: "EXTRACT_FORMS" }
  | { type: "PREVIEW_AUTOFILL"; fields: FormFieldDescriptor[] }
  | { type: "APPLY_AUTOFILL"; plan: AutofillPlan }
  | { type: "SCORE_JOB"; job: JobPosting }
  | { type: "DRAFT_EMAIL"; job: JobPosting };

export type ContentMessage =
  | { type: "CONTENT_PING" }
  | { type: "CONTENT_SCAN" }
  | { type: "CONTENT_EXTRACT_FORMS" }
  | { type: "CONTENT_APPLY_AUTOFILL"; plan: AutofillPlan };

export interface RuntimeResponse<T> {
  ok: boolean;
  data?: T;
  error?: string;
}
