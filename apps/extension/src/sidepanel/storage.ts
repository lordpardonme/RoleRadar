import type { UserProfile } from "@job-fit-hunter/shared";
import { defaultSettings, type ApiSettings } from "./api";

const SESSION_PROFILE_KEY = "activeProfile";
const LOCAL_SETTINGS_KEY = "settings";
const LOCAL_PROFILE_ID_KEY = "profileId";
const HIDDEN_COMPANIES_KEY = "hiddenCompanies";

let memoryProfile: UserProfile | undefined;
let memoryProfileId: string | undefined;
let memorySettings: ApiSettings = defaultSettings();
let memoryHiddenCompanies: string[] = [];

export interface StoredState {
  profile: UserProfile | undefined;
  profileId: string | undefined;
  settings: ApiSettings;
  hiddenCompanies: string[];
}

export async function loadState(): Promise<StoredState> {
  if (!hasChromeStorage()) {
    return {
      profile: memoryProfile,
      profileId: memoryProfileId,
      settings: memorySettings,
      hiddenCompanies: memoryHiddenCompanies
    };
  }

  const session = await chrome.storage.session.get(SESSION_PROFILE_KEY);
  const local = await chrome.storage.local.get([LOCAL_SETTINGS_KEY, LOCAL_PROFILE_ID_KEY, HIDDEN_COMPANIES_KEY]);
  return {
    profile: session[SESSION_PROFILE_KEY] as UserProfile | undefined,
    profileId: local[LOCAL_PROFILE_ID_KEY] as string | undefined,
    settings: { ...defaultSettings(), ...(local[LOCAL_SETTINGS_KEY] as Partial<ApiSettings> | undefined) },
    hiddenCompanies: (local[HIDDEN_COMPANIES_KEY] as string[] | undefined) ?? []
  };
}

export async function storeProfile(profile: UserProfile, profileId?: string): Promise<void> {
  if (!hasChromeStorage()) {
    memoryProfile = profile;
    memoryProfileId = profileId;
    return;
  }

  await chrome.storage.session.set({ [SESSION_PROFILE_KEY]: profile });
  if (profileId) await chrome.storage.local.set({ [LOCAL_PROFILE_ID_KEY]: profileId });
}

export async function storeSettings(settings: ApiSettings): Promise<void> {
  if (!hasChromeStorage()) {
    memorySettings = settings;
    return;
  }

  await chrome.storage.local.set({ [LOCAL_SETTINGS_KEY]: settings });
}

export async function storeHiddenCompanies(companies: string[]): Promise<void> {
  if (!hasChromeStorage()) {
    memoryHiddenCompanies = companies;
    return;
  }

  await chrome.storage.local.set({ [HIDDEN_COMPANIES_KEY]: companies });
}

export async function clearProfile(): Promise<void> {
  if (!hasChromeStorage()) {
    memoryProfile = undefined;
    memoryProfileId = undefined;
    return;
  }

  await chrome.storage.session.remove(SESSION_PROFILE_KEY);
  await chrome.storage.local.remove(LOCAL_PROFILE_ID_KEY);
}

function hasChromeStorage(): boolean {
  return typeof chrome !== "undefined" && Boolean(chrome.storage?.local && chrome.storage?.session);
}
