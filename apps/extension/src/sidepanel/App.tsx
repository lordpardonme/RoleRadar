import {
  DEFAULT_PERSONALITY_ITEMS,
  type AutofillPlan,
  type CompanyCultureProfile,
  type ContactEmail,
  type EmailDraft,
  type FormFieldDescriptor,
  type JobMatch,
  type JobPosting,
  type PersonalityAnswer,
  type UserProfile,
  type WorkValue
} from "@job-fit-hunter/shared";
import {
  AlertTriangle,
  BadgeCheck,
  BriefcaseBusiness,
  Check,
  ChevronDown,
  Copy,
  Eraser,
  EyeOff,
  FileText,
  Gauge,
  Mail,
  RefreshCw,
  ScanSearch,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Wand2
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  buildProfileFromForm,
  defaultSettings,
  deleteRemoteProfile,
  draftEmail,
  extractCulture,
  mapForm,
  saveProfile,
  scoreJobFit,
  type ApiSettings
} from "./api";
import { clearProfile, loadState, storeHiddenCompanies, storeProfile } from "./storage";
import type { PageScan, RuntimeResponse } from "../messages";

type View = "workbench" | "profile" | "resume";

interface RankedJob {
  job: JobPosting;
  match: JobMatch;
}

const WORK_VALUE_LABELS: Array<[WorkValue, string]> = [
  ["autonomy", "Autonomy"],
  ["collaboration", "Collaboration"],
  ["structure", "Structure"],
  ["pace", "Pace"],
  ["purpose", "Purpose"],
  ["learning", "Learning"],
  ["stability", "Stability"],
  ["compensation", "Compensation"],
  ["remote", "Remote"]
];

const SAMPLE_RESUME = `Ava Stone
ava@example.com
https://linkedin.com/in/ava
Software Engineer with 5 years building React, TypeScript, Node.js, Postgres, and AWS products.`;

export function App() {
  const [profile, setProfile] = useState<UserProfile>();
  const [profileId, setProfileId] = useState<string>();
  const [settings] = useState<ApiSettings>(defaultSettings());
  const [view, setView] = useState<View>("workbench");
  const [status, setStatus] = useState("Idle");
  const [warning, setWarning] = useState<string>();
  const [scan, setScan] = useState<PageScan>();
  const [culture, setCulture] = useState<CompanyCultureProfile>();
  const [rankedJobs, setRankedJobs] = useState<RankedJob[]>([]);
  const [selectedJobId, setSelectedJobId] = useState<string>();
  const [fields, setFields] = useState<FormFieldDescriptor[]>([]);
  const [autofillPlan, setAutofillPlan] = useState<AutofillPlan>();
  const [autofillSelections, setAutofillSelections] = useState<Record<string, boolean>>({});
  const [emailDraft, setEmailDraft] = useState<EmailDraft>();
  const [hiddenCompanies, setHiddenCompanies] = useState<string[]>([]);

  useEffect(() => {
    void loadState().then((state) => {
      setProfile(state.profile);
      setProfileId(state.profileId);
      setHiddenCompanies(state.hiddenCompanies);
      if (!state.profile) setView("profile");
    });
  }, []);

  const selected = useMemo(
    () => rankedJobs.find((item) => item.job.id === selectedJobId) ?? rankedJobs[0],
    [rankedJobs, selectedJobId]
  );

  async function handleProfileSaved(nextProfile: UserProfile) {
    setStatus("Saving profile");
    const result = await saveProfile(nextProfile, settings);
    await storeProfile(nextProfile, result.profileId);
    setProfile(nextProfile);
    setProfileId(result.profileId);
    setWarning(result.warning);
    setView("workbench");
    setStatus(result.profileId ? "Profile encrypted in backend" : "Profile active for session");
  }

  async function handleScan() {
    if (!profile) {
      setView("profile");
      setWarning("Complete profile first.");
      return;
    }
    setStatus("Scanning active tab");
    setWarning(undefined);
    setAutofillPlan(undefined);
    setAutofillSelections({});
    setEmailDraft(undefined);
    setFields([]);

    const pageScan = await sendRuntime<PageScan>({ type: "SCAN_PAGE" });
    setScan(pageScan);
    const company = pageScan.jobs[0]?.company;
    const cultureProfile = await extractCulture(settings, pageScan.pageText, pageScan.pageUrl, company);
    setCulture(cultureProfile);

    const visibleJobs = pageScan.jobs.filter((job) => !hiddenCompanies.includes(job.company ?? ""));
    const matches = await Promise.all(
      visibleJobs.map(async (job) => ({
        job,
        match: await scoreJobFit(settings, profile, job, cultureProfile, profileId)
      }))
    );
    const sorted = matches.sort((left, right) => right.match.score - left.match.score);
    setRankedJobs(sorted);
    setSelectedJobId(sorted[0]?.job.id);
    setStatus(sorted.length ? `${sorted.length} job${sorted.length === 1 ? "" : "s"} scored` : "No jobs found");
  }

  async function handleAutofillPreview() {
    if (!profile || !selected) return;
    setStatus("Mapping form fields");
    const extracted = await sendRuntime<FormFieldDescriptor[]>({ type: "EXTRACT_FORMS" });
    setFields(extracted);
    const plan = await mapForm(settings, profile, selected.job, extracted, profileId);
    setAutofillPlan(plan);
    setAutofillSelections(Object.fromEntries(plan.fields.map((field) => [field.selector, !field.requiresUserAction])));
    setStatus(`${plan.fields.length} autofill fields ready`);
  }

  async function handleApplyAutofill() {
    if (!autofillPlan) return;
    const reviewedPlan = {
      ...autofillPlan,
      fields: autofillPlan.fields.filter((field) => autofillSelections[field.selector] && !field.requiresUserAction)
    };
    if (!reviewedPlan.fields.length) {
      setWarning("No reviewed autofill fields selected.");
      return;
    }
    setStatus("Applying reviewed fields");
    const result = await sendRuntime<{ applied: number; skipped: string[] }>({ type: "APPLY_AUTOFILL", plan: reviewedPlan });
    setStatus(`${result.applied} fields filled`);
    if (result.skipped.length) setWarning(result.skipped.join(" | "));
  }

  async function handleDraftEmail() {
    if (!profile || !selected) return;
    setStatus("Drafting outreach");
    const contacts: ContactEmail[] = scan?.contacts.emails ?? [];
    const draft = await draftEmail(settings, profile, selected.job, contacts, profileId);
    setEmailDraft(draft);
    setStatus(draft.to.length ? "Verified contact draft ready" : "Draft ready without verified contact");
  }

  async function handleHideCompany(company?: string) {
    if (!company) return;
    const next = [...new Set([...hiddenCompanies, company])];
    setHiddenCompanies(next);
    await storeHiddenCompanies(next);
    setRankedJobs((jobs) => jobs.filter((item) => item.job.company !== company));
    setStatus(`${company} hidden`);
  }

  async function handleDeleteProfile() {
    if (profileId) await deleteRemoteProfile(settings, profileId).catch(() => undefined);
    await clearProfile();
    setProfile(undefined);
    setProfileId(undefined);
    setRankedJobs([]);
    setSelectedJobId(undefined);
    setView("profile");
    setStatus("Profile deleted");
  }

  function handleExport() {
    const blob = new Blob([JSON.stringify({ profile, profileId, hiddenCompanies }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "roleradar-export.json";
    anchor.click();
    URL.revokeObjectURL(url);
    setStatus("Export prepared");
  }

  return (
    <main className="shell">
      <header className="topbar">
        <div>
          <div className="brandRow">
            <ScanSearch size={19} />
            <h1>RoleRadar</h1>
          </div>
          <p>{status}</p>
        </div>
        <div className="topActions">
          <button className="iconButton" title="Profile" onClick={() => setView(view === "profile" ? "workbench" : "profile")}>
            <SlidersHorizontal size={17} />
          </button>
          <button className="iconButton" title="Resume preview" onClick={() => setView(view === "resume" ? "workbench" : "resume")}>
            <FileText size={17} />
          </button>
          <button className="iconButton primary" title="Scan active tab" onClick={handleScan}>
            <RefreshCw size={17} />
          </button>
        </div>
      </header>

      {warning ? (
        <div className="notice">
          <AlertTriangle size={16} />
          <span>{warning}</span>
        </div>
      ) : null}

      {view === "resume" ? (
        <ResumePreview />
      ) : view === "profile" || !profile ? (
        <ProfilePanel current={profile} onSaved={handleProfileSaved} onDelete={handleDeleteProfile} onExport={handleExport} />
      ) : (
        <Workbench
          profile={profile}
          scan={scan}
          culture={culture}
          rankedJobs={rankedJobs}
          selected={selected}
          fields={fields}
          autofillPlan={autofillPlan}
          autofillSelections={autofillSelections}
          emailDraft={emailDraft}
          onScan={handleScan}
          onSelect={setSelectedJobId}
          onPreviewAutofill={handleAutofillPreview}
          onApplyAutofill={handleApplyAutofill}
          onToggleAutofillField={(selector, selected) => setAutofillSelections((current) => ({ ...current, [selector]: selected }))}
          onDraftEmail={handleDraftEmail}
          onHideCompany={handleHideCompany}
          onExport={handleExport}
          onDelete={handleDeleteProfile}
        />
      )}
    </main>
  );
}

const RESUME_JOBS = [
  {
    company: "I-DOD",
    role: "Product Designer",
    date: "July 2025 - March 2026",
    location: "New Delhi, India",
    bullets: [
      "Designing end-to-end mobile app experience for relationship platform targeting Indian users, including onboarding, KYC verification, and profile creation flows.",
      "Collaborating with founding team (5 people) to define product requirements and user journeys for dating and marriage segments.",
      "Currently in beta testing with 500+ users, iterating based on feedback."
    ]
  },
  {
    company: "FuelBuddy",
    role: "Product Designer",
    date: "July 2023 - June 2024",
    location: "Gurgaon, India",
    bullets: [
      "Led UX for a new consumer fuel-pick service (Arjun), designing end-to-end flows from discovery to payment; project was taken to high-fidelity prototype but put on hold before launch.",
      "Reworked doorstep fuel delivery experience inside the main FuelBuddy app, reducing ordering from 8 to 3 steps and increasing order completion rate from 62% to 78% (A/B test with 12,000 users over 6 weeks).",
      "Designed the franchise web application used to manage fleets, drivers, tankers and deliveries across India and Dubai, including dashboards, order assignment, shift scheduling and Gantt-style planning views for operations teams.",
      "Created the Wheels driver app and supporting B2B management sections, covering login, shift scheduling, live jobs, navigation, error handling and odometer/quantity correction flows, helping reduce driver support tickets by 35% (450->290 per month)."
    ]
  },
  {
    company: "Uncover by Meddo",
    role: "Product Designer",
    date: "March 2022 - May 2023",
    location: "Gurgaon, India",
    bullets: [
      "Redesigned appointment booking flow reducing steps from 6 to 4, improving booking completion rate from 71% to 83% over 8-week period (tracked via Google Analytics).",
      "Designed and shipped new doctor profile page increasing profile views by 28% and appointment requests by 15% (A/B tested with 5,000 users).",
      "Conducted usability testing with 12 patients and 8 doctors to identify friction points in telemedicine experience, presenting findings to product and engineering teams.",
      "Worked as sole designer, contributing to design system documentation and component library in Figma."
    ]
  },
  {
    company: "AcadPlaza",
    role: "UI Designer",
    date: "June 2020 - March 2022",
    location: "Remote",
    bullets: [
      "Redesigned course catalog and search experience, increasing course enrollments by 18% quarter-over-quarter (Q3 to Q4 2021).",
      "Created responsive UI components and a basic style guide used across web and mobile learning experiences.",
      "Collaborated with an 8-person remote team (product, engineering, content) using Figma and Slack to ship iterative improvements."
    ]
  }
];

const RESUME_SKILLS = [
  { title: "Design", items: ["Figma (Auto Layout, Variables)", "Wireframing", "Prototyping", "Interaction Design", "Responsive & Mobile-First Design"] },
  { title: "Research & Analytics", items: ["User Interviews", "Usability Testing", "Journey Mapping", "A/B Testing", "Funnel Analysis", "Google Analytics", "Hotjar"] },
  { title: "AI & Workflow", items: ["ChatGPT / Perplexity (research synthesis, UX writing)", "FigJam AI (ideation support)"] },
  { title: "Tools", items: ["Figma", "Miro", "Adobe Creative Suite", "Rive", "Framer", "Claude Code"] }
];

function ResumePreview() {
  return (
    <section className="resumeViewport" aria-label="Figma resume implementation">
      <article className="resumePage">
        <header className="resumeIntro">
          <h2>MOHD HAYAAT ALI</h2>
          <p>Product Designer</p>
          <p>Product Designer with 4 years of experience in mobile and web products for consumer and SaaS companies, focused on onboarding, conversion optimisation, and data-informed UX.</p>
        </header>

        <address className="resumeContact">
          <a href="https://workofhayaat.framer.website" target="_blank" rel="noreferrer">Portfolio Link</a>
          <span>mohdhayaat1@outlook.com</span>
          <span>+91-7991880020</span>
          <span>+91-7905194153</span>
          <span>Delhi, India</span>
        </address>

        <div className="resumeDivider" />

        <main className="resumeLeftColumn">
          <section className="resumeSection">
            <h3>Experience</h3>
            <div className="resumeJobs">
              {RESUME_JOBS.map((job) => (
                <section className="resumeJob" key={job.company}>
                  <div className="resumeJobHeading">
                    <h4>{job.company}</h4>
                    <span>{job.role}</span>
                  </div>
                  <div className="resumeMeta">
                    <span>{job.date}</span>
                    <span>{job.location}</span>
                  </div>
                  <ul>
                    {job.bullets.map((bullet) => <li key={bullet}>{bullet}</li>)}
                  </ul>
                </section>
              ))}
            </div>
          </section>

          <section className="resumeSection resumeEducation">
            <h3>Education</h3>
            <h4>BBA, Business Administration</h4>
            <p><span>2017 - 2020</span><span>Sam Higginbottom University of Agriculture, Technology & Sciences</span></p>
          </section>
        </main>

        <aside className="resumeRightColumn">
          <h3>Skills</h3>
          <div className="resumeSkillStack">
            {RESUME_SKILLS.map((skill) => (
              <section className="resumeSkill" key={skill.title}>
                <h4>{skill.title}</h4>
                <ul>
                  {skill.items.map((item) => <li key={item}>{item}</li>)}
                </ul>
              </section>
            ))}
            <section className="resumeSkill">
              <h4>Design-to-Code</h4>
              <p>Anti Gravity + Claude Code + Codex<br />( i switch between the tools due to credit limits but maintain same repo )</p>
            </section>
          </div>
        </aside>
      </article>
    </section>
  );
}

function ProfilePanel(props: {
  current: UserProfile | undefined;
  onSaved: (profile: UserProfile) => void | Promise<void>;
  onDelete: () => void | Promise<void>;
  onExport: () => void;
}) {
  const [resumeText, setResumeText] = useState(props.current?.resumeText ?? SAMPLE_RESUME);
  const [consent, setConsent] = useState(Boolean(props.current));
  const [answers, setAnswers] = useState<PersonalityAnswer[]>(
    DEFAULT_PERSONALITY_ITEMS.map((item) => ({ id: item.id, value: 3 }))
  );
  const [workValues, setWorkValues] = useState<Record<WorkValue, number>>({
    autonomy: 75,
    collaboration: 70,
    structure: 55,
    pace: 60,
    purpose: 70,
    learning: 80,
    stability: 45,
    compensation: 50,
    remote: 80
  });
  const [targetRoles, setTargetRoles] = useState(props.current?.preferences.targetRoles.join(", ") ?? "Software Engineer, Frontend Engineer");
  const [targetLocations, setTargetLocations] = useState(props.current?.preferences.targetLocations.join(", ") ?? "Remote");
  const [remote, setRemote] = useState<UserProfile["preferences"]["remote"]>(props.current?.preferences.remote ?? "remote");
  const [minimumCompensation, setMinimumCompensation] = useState(props.current?.preferences.minimumCompensation?.toString() ?? "");
  const [needsVisaSponsorship, setNeedsVisaSponsorship] = useState(props.current?.preferences.needsVisaSponsorship ?? false);
  const [dealbreakers, setDealbreakers] = useState(props.current?.preferences.dealbreakers.join(", ") ?? "night shift");

  function updateAnswer(id: string, value: number) {
    setAnswers((items) => items.map((item) => item.id === id ? { ...item, value } : item));
  }

  function save() {
    if (!consent) return;
    props.onSaved(buildProfileFromForm({
      resumeText,
      answers,
      workValues,
      targetRoles,
      targetLocations,
      remote,
      minimumCompensation: minimumCompensation ? Number(minimumCompensation) : undefined,
      needsVisaSponsorship,
      dealbreakers
    }));
  }

  return (
    <section className="panelStack">
      <div className="sectionHeader">
        <ShieldCheck size={18} />
        <h2>Profile</h2>
      </div>

      <label className="consent">
        <input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} />
        <span>I allow RoleRadar to process resume, personality, job page, and form data for job-fit scoring.</span>
      </label>

      <label className="fieldBlock">
        <span>Resume</span>
        <textarea value={resumeText} onChange={(event) => setResumeText(event.target.value)} rows={8} />
      </label>

      <details className="fold" open>
        <summary>
          <span>Personality</span>
          <ChevronDown size={16} />
        </summary>
        <div className="questionGrid">
          {DEFAULT_PERSONALITY_ITEMS.map((item) => (
            <label key={item.id} className="rangeRow">
              <span>{item.prompt}</span>
              <input
                type="range"
                min={1}
                max={5}
                value={answers.find((answer) => answer.id === item.id)?.value ?? 3}
                onChange={(event) => updateAnswer(item.id, Number(event.target.value))}
              />
            </label>
          ))}
        </div>
      </details>

      <details className="fold" open>
        <summary>
          <span>Work Values</span>
          <ChevronDown size={16} />
        </summary>
        <div className="valueGrid">
          {WORK_VALUE_LABELS.map(([key, label]) => (
            <label key={key} className="rangeRow compact">
              <span>{label}</span>
              <input
                type="range"
                min={0}
                max={100}
                value={workValues[key]}
                onChange={(event) => setWorkValues({ ...workValues, [key]: Number(event.target.value) })}
              />
              <b>{workValues[key]}</b>
            </label>
          ))}
        </div>
      </details>

      <div className="formGrid">
        <label className="fieldBlock">
          <span>Target Roles</span>
          <input value={targetRoles} onChange={(event) => setTargetRoles(event.target.value)} />
        </label>
        <label className="fieldBlock">
          <span>Locations</span>
          <input value={targetLocations} onChange={(event) => setTargetLocations(event.target.value)} />
        </label>
        <label className="fieldBlock">
          <span>Remote</span>
          <select value={remote} onChange={(event) => setRemote(event.target.value as UserProfile["preferences"]["remote"])}>
            <option value="remote">Remote</option>
            <option value="hybrid">Hybrid</option>
            <option value="onsite">Onsite</option>
            <option value="any">Any</option>
          </select>
        </label>
        <label className="fieldBlock">
          <span>Minimum Comp</span>
          <input value={minimumCompensation} onChange={(event) => setMinimumCompensation(event.target.value)} inputMode="numeric" />
        </label>
      </div>

      <label className="consent slim">
        <input type="checkbox" checked={needsVisaSponsorship} onChange={(event) => setNeedsVisaSponsorship(event.target.checked)} />
        <span>Need visa sponsorship</span>
      </label>

      <label className="fieldBlock">
        <span>Dealbreakers</span>
        <input value={dealbreakers} onChange={(event) => setDealbreakers(event.target.value)} />
      </label>

      <div className="buttonRow sticky">
        <button className="button primary" disabled={!consent || resumeText.trim().length < 40} onClick={save}>
          <Check size={16} />
          Save
        </button>
        {props.current ? (
          <>
            <button className="button" onClick={props.onExport}>
              <FileText size={16} />
              Export
            </button>
            <button className="button danger" onClick={props.onDelete}>
              <Eraser size={16} />
              Delete
            </button>
          </>
        ) : null}
      </div>
    </section>
  );
}

function Workbench(props: {
  profile: UserProfile;
  scan: PageScan | undefined;
  culture: CompanyCultureProfile | undefined;
  rankedJobs: RankedJob[];
  selected: RankedJob | undefined;
  fields: FormFieldDescriptor[];
  autofillPlan: AutofillPlan | undefined;
  autofillSelections: Record<string, boolean>;
  emailDraft: EmailDraft | undefined;
  onScan: () => void;
  onSelect: (id: string) => void;
  onPreviewAutofill: () => void | Promise<void>;
  onApplyAutofill: () => void | Promise<void>;
  onToggleAutofillField: (selector: string, selected: boolean) => void;
  onDraftEmail: () => void | Promise<void>;
  onHideCompany: (company?: string) => void | Promise<void>;
  onExport: () => void;
  onDelete: () => void | Promise<void>;
}) {
  return (
    <section className="workbench">
      <div className="scoreStrip">
        <Metric icon={<BriefcaseBusiness size={16} />} label="Jobs" value={props.rankedJobs.length.toString()} />
        <Metric icon={<Gauge size={16} />} label="Best" value={props.rankedJobs[0]?.match.score ? `${props.rankedJobs[0].match.score}` : "--"} />
        <Metric icon={<BadgeCheck size={16} />} label="Profile" value={props.profile.parsedResume.skills.length.toString()} />
      </div>

      {props.rankedJobs.length ? (
        <div className="jobList">
          {props.rankedJobs.map((item) => (
            <button
              key={item.job.id}
              className={`jobItem ${props.selected?.job.id === item.job.id ? "active" : ""}`}
              onClick={() => props.onSelect(item.job.id)}
            >
              <span className="scoreBubble">{item.match.score}</span>
              <span>
                <b>{item.job.title}</b>
                <small>{[item.job.company, item.job.location].filter(Boolean).join(" - ") || item.job.sourceUrl}</small>
              </span>
            </button>
          ))}
        </div>
      ) : (
        <div className="emptyState">
          <Sparkles size={24} />
          <button className="button primary" onClick={props.onScan}>
            <ScanSearch size={16} />
            Scan Tab
          </button>
        </div>
      )}

      {props.selected ? (
        <article className="detail">
          <div className="detailHeader">
            <div>
              <h2>{props.selected.job.title}</h2>
              <p>{[props.selected.job.company, props.selected.job.location].filter(Boolean).join(" - ")}</p>
            </div>
            <strong>{props.selected.match.score}</strong>
          </div>

          <div className="breakdown">
            {Object.entries(props.selected.match.breakdown).map(([key, item]) => (
              <div key={key} className="barRow">
                <span>{key}</span>
                <div>
                  <i style={{ width: `${item.score}%` }} />
                </div>
                <b>{item.score}</b>
              </div>
            ))}
          </div>

          <p className="nextAction">{props.selected.match.nextAction}</p>

          <div className="twoCol">
            <Evidence title="Evidence" items={props.selected.match.evidence} />
            <Evidence title="Gaps" items={props.selected.match.gaps} />
          </div>

          {props.culture?.signals.length ? (
            <div className="cultureLine">
              {props.culture.signals.slice(0, 5).map((signal) => <span key={signal.value}>{signal.label}</span>)}
            </div>
          ) : null}

          <div className="buttonRow">
            <button className="button primary" onClick={props.onPreviewAutofill}>
              <Wand2 size={16} />
              Autofill
            </button>
            <button className="button" onClick={props.onDraftEmail}>
              <Mail size={16} />
              Email
            </button>
            <button className="button" onClick={() => props.onHideCompany(props.selected?.job.company)}>
              <EyeOff size={16} />
              Hide
            </button>
          </div>
        </article>
      ) : null}

      {props.autofillPlan ? (
        <Preview title="Autofill Preview" action="Apply Reviewed Fields" onAction={props.onApplyAutofill}>
          {props.autofillPlan.fields.map((field) => (
            <div key={field.selector} className="previewRow">
              <label className="reviewChoice">
                <input
                  type="checkbox"
                  checked={Boolean(props.autofillSelections[field.selector])}
                  disabled={Boolean(field.requiresUserAction)}
                  onChange={(event) => props.onToggleAutofillField(field.selector, event.target.checked)}
                />
                <b>{field.label}</b>
              </label>
              <code>{field.requiresUserAction ? "manual" : field.value}</code>
            </div>
          ))}
          {props.autofillPlan.warnings.map((item) => <p key={item} className="warnText">{item}</p>)}
          {props.fields.length ? <p className="muted">{props.fields.length} fields detected.</p> : null}
        </Preview>
      ) : null}

      {props.emailDraft ? (
        <Preview title="Email Draft" action="Copy Draft" onAction={() => navigator.clipboard.writeText(`${props.emailDraft?.subject}\n\n${props.emailDraft?.body}`)}>
          <div className="previewRow">
            <b>To</b>
            <code>{props.emailDraft.to.map((contact) => contact.email).join(", ") || "No verified contact"}</code>
          </div>
          <div className="previewRow">
            <b>Subject</b>
            <code>{props.emailDraft.subject}</code>
          </div>
          <pre>{props.emailDraft.body}</pre>
          {props.emailDraft.warnings.map((item) => <p key={item} className="warnText">{item}</p>)}
        </Preview>
      ) : null}

      <div className="buttonRow footerRow">
        <button className="button" onClick={props.onExport}>
          <FileText size={16} />
          Export
        </button>
        <button className="button danger" onClick={props.onDelete}>
          <Eraser size={16} />
          Delete
        </button>
      </div>
    </section>
  );
}

function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="metric">
      {icon}
      <span>{label}</span>
      <b>{value}</b>
    </div>
  );
}

function Evidence({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="evidence">
      <h3>{title}</h3>
      {items.length ? items.slice(0, 4).map((item) => <p key={item}>{item}</p>) : <p className="muted">None visible.</p>}
    </div>
  );
}

function Preview(props: { title: string; action: string; onAction: () => void; children: React.ReactNode }) {
  return (
    <section className="preview">
      <div className="previewHead">
        <h2>{props.title}</h2>
        <button className="button compactButton" onClick={props.onAction}>
          <Copy size={15} />
          {props.action}
        </button>
      </div>
      {props.children}
    </section>
  );
}

async function sendRuntime<T>(message: unknown): Promise<T> {
  if (typeof chrome === "undefined" || !chrome.runtime?.sendMessage) {
    return devRuntime<T>(message);
  }

  const response = await chrome.runtime.sendMessage(message) as RuntimeResponse<T>;
  if (!response.ok) throw new Error(response.error ?? "Extension runtime failed.");
  return response.data as T;
}

function devRuntime<T>(message: unknown): T {
  const typed = message as { type?: string; plan?: AutofillPlan };
  if (typed.type === "SCAN_PAGE") {
    return {
      pageUrl: "http://127.0.0.1:5173/demo-job",
      pageTitle: "Demo Senior Frontend Engineer",
      pageText: "Senior Frontend Engineer role. Build React, TypeScript, Node.js and Postgres products. Remote team with autonomy, collaboration, learning, mission impact, and flexible work.",
      cultureUrls: ["https://example.com/culture"],
      contacts: {
        emails: [{ email: "careers@example.com", source: "page-text", verified: true }]
      },
      jobs: [{
        id: "demo_job",
        sourceUrl: "http://127.0.0.1:5173/demo-job",
        title: "Senior Frontend Engineer",
        company: "Example Labs",
        location: "Remote",
        description: "Build React, TypeScript, Node.js and Postgres products. 5 years experience. Remote culture with autonomy, collaboration, learning, mission impact, and flexible work.",
        applyUrl: "http://127.0.0.1:5173/demo-job",
        cultureUrls: ["https://example.com/culture"],
        extractedAt: new Date().toISOString()
      }]
    } as T;
  }

  if (typed.type === "EXTRACT_FORMS") {
    return [
      { selector: "#firstName", label: "First Name", type: "text", required: true },
      { selector: "#email", label: "Email", type: "email", required: true },
      { selector: "#resume", label: "Resume", type: "file", required: true }
    ] as T;
  }

  if (typed.type === "APPLY_AUTOFILL") {
    return { applied: 0, skipped: ["Dev preview only. Load unpacked extension to fill live forms."] } as T;
  }

  throw new Error("Unsupported dev runtime message.");
}
