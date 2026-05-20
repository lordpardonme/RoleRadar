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

type View = "workbench" | "profile";

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
    setStatus(`${plan.fields.length} autofill fields ready`);
  }

  async function handleApplyAutofill() {
    if (!autofillPlan) return;
    setStatus("Applying reviewed fields");
    const result = await sendRuntime<{ applied: number; skipped: string[] }>({ type: "APPLY_AUTOFILL", plan: autofillPlan });
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

      {view === "profile" || !profile ? (
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
          emailDraft={emailDraft}
          onScan={handleScan}
          onSelect={setSelectedJobId}
          onPreviewAutofill={handleAutofillPreview}
          onApplyAutofill={handleApplyAutofill}
          onDraftEmail={handleDraftEmail}
          onHideCompany={handleHideCompany}
          onExport={handleExport}
          onDelete={handleDeleteProfile}
        />
      )}
    </main>
  );
}

function ProfilePanel(props: {
  current?: UserProfile;
  onSaved: (profile: UserProfile) => void;
  onDelete: () => void;
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
  scan?: PageScan;
  culture?: CompanyCultureProfile;
  rankedJobs: RankedJob[];
  selected?: RankedJob;
  fields: FormFieldDescriptor[];
  autofillPlan?: AutofillPlan;
  emailDraft?: EmailDraft;
  onScan: () => void;
  onSelect: (id: string) => void;
  onPreviewAutofill: () => void;
  onApplyAutofill: () => void;
  onDraftEmail: () => void;
  onHideCompany: (company?: string) => void;
  onExport: () => void;
  onDelete: () => void;
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
              <b>{field.label}</b>
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
  const response = await chrome.runtime.sendMessage(message) as RuntimeResponse<T>;
  if (!response.ok) throw new Error(response.error ?? "Extension runtime failed.");
  return response.data as T;
}
