/*******************************************************
 * session.js
 * 
 * PURPOSE:
 *   - Manages AI interactions, job scanning, form filling,
 *     and other session-specific tasks (token retrieval,
 *     API calls, etc.).
 * 
 * NOTE:
 *   - Relies on global variables for extension state 
 *     (e.g., window.RD_SELECTED_RESUME).
 *******************************************************/

import { trackError, mkLoader, removeLoader, mountView, Indicative, log } from "./utils.js";

/**
 * autoFill
 * ----------------------------------
 * Uses GPT-like logic to fill forms. 
 * Called with an HTML string, returns 
 * an array of fill instructions.
 */
export async function autoFill(html, maxRetries = 3) {
    let result = null;
    if (maxRetries > 0) {
        try {
            result = await autoFillForm(html);
            if (result !== null) {
                return result; // If successful, return the result
            } else {
                log(`Retrying autoFillForm. Remaining retry attempt: ${maxRetries}`);
                return autoFill(html, maxRetries - 1);
            }
        } catch (e) {
            console.error("Error in autoFill:", e);
            trackError("autoFill", e.message || "Unknown error", "", false);
            return null;
        }
    } else {
        console.error(`autoFill failed after 3 attempts.`);
        return null;
    }

    // Helper: handles the actual fetch call
    async function autoFillForm(html) {
        const { success, token } = await loadToken();
        if (!success) {
            mountView("login");
            return;
        }
        const endpoint = `/meta/form-autofill`;
        const fetchOptions = mkFetchOption("POST", endpoint, token);
        if (!fetchOptions) {
            return;
        }
        try {
            const params = {
                resumeId: window.RD_SELECTED_RESUME,
                html: html,
            };
            let filteredRes = null;
            const response = await fetch(`${BASE_URL}${endpoint}`, {
                ...fetchOptions,
                body: JSON.stringify(params),
            });
            if (response.ok) {
                const res = await response.json();
                const itemCoverLetter = res.find(
                    (item) => typeof item?.value === "string" && item?.value?.toLowerCase()?.includes("cover letter")
                );
                if (itemCoverLetter) window.COVER_SELECTOR = itemCoverLetter.selector;
                filteredRes = res.filter(
                    (item) =>
                        item?.selector !== "#hasCoverLetter" &&
                        typeof item?.value === "string" &&
                        item?.selector !== window.COVER_SELECTOR
                );
                return filteredRes;
            } else {
                const errMsg = await response.text();
                trackError(endpoint, errMsg, response.status);
                log(response);
                return null;
            }
        } catch (e) {
            console.error(e.message);
            trackError("autoFillForm", e.message || "Unknown error", "", false);
            return null;
        }
    }
}

/**
 * attachResume
 * ----------------------------------
 * Fetches a user’s resume from stored URL, 
 * appends it as a PDF File to a file input, 
 * then dispatches a change event.
 */
export async function attachResume(selector, delay = 500) {
    return new Promise(async (resolve) => {
        try {
            const fileInput = document.querySelector(selector);
            if (!fileInput) {
                resolve(false);
            }
            const resumeList = window.RD_RESUMES;
            const selectedResume = resumeList.find((resume) => resume.resumeId === window.RD_SELECTED_RESUME);
            if (!selectedResume) {
                console.error("Selected resume not found");
                resolve(false);
            }

            let resumeUrl = selectedResume["uploadedResumeS3Url"];
            if (resumeUrl.includes("cloud.google")) {
                resumeUrl = resumeUrl.replace("cloud.google", "googleapis");
            }

            let filename = selectedResume["name"];
            filename = filename.replace(/\s+/g, "_") + ".pdf";
            fileInput.setAttribute("title", filename);

            if (resumeUrl) {
                const response = await fetch(resumeUrl);
                if (!response.ok) {
                    console.error("Failed to fetch resume");
                    resolve(false);
                }

                const blob = await response.blob();
                const resumeFile = new File([blob], filename, { type: "application/pdf" });
                const fileList = new DataTransfer();
                fileList.items.add(resumeFile);
                fileInput.files = fileList.files;

                const event = new Event("change", { bubbles: true });
                fileInput.dispatchEvent(event);

                const checkResumeInserted = setInterval(() => {
                    const insertedResume = document.querySelector(`[title="${filename}"]`);
                    if (insertedResume) {
                        clearInterval(checkResumeInserted);
                        window.RESUME_ATTACHED = true;
                        console.log("Resume attached");
                        setTimeout(() => {
                            resolve(true);
                        }, 1000);
                    }
                }, 500);
            } else {
                console.error("Resume URL not found");
                resolve(false);
            }
        } catch (error) {
            console.error("Error attaching resume:", error);
            resolve(false);
        }
    });
}

/**
 * saveLinkedinUrl
 * ----------------------------------
 * Sends the user’s LinkedIn profile 
 * to the backend (if token is valid).
 */
export async function saveLinkedinUrl(linkedinUrl) {
    let mkQuery = true;
    const { success, token } = await loadToken();
    if (!success || !linkedinUrl) {
        mkQuery = false;
    }
    if (!mkQuery) {
        return;
    }

    const endpoint = `/extension-users`;
    const fetchOptions = mkFetchOption("POST", endpoint, token);
    if (!fetchOptions) {
        return;
    }
    try {
        const params = { linkedinProfileURL: linkedinUrl };
        await fetch(`${BASE_URL}${endpoint}`, {
            ...fetchOptions,
            body: JSON.stringify(params),
        });
        return;
    } catch (e) {
        console.error(e.message);
        trackError("saveLinkedinUrl", e.message || "Unknown error", "", false);
    } finally {
        return;
    }
}

/**
 * weScan
 * ----------------------------------
 * Checks if the current domain is in 
 * a known “scannable” list (web job boards).
 */
export function weScan(EXCLUDE_LISTS = []) {
    const host = window.location.hostname;
    return (
        [...WEB_SCANNED_LISTS, ...EXCLUDE_LISTS].some((scannedHost) => host.includes(scannedHost)) &&
        !window.RD_SELECT_CC
    );
}

/* 
 * Other related functions like:
 *   - loadToken()
 *   - refreshToken()
 *   - trackError()
 *   - mountView()
 *   - mkFetchOption()
 *   - etc.
 * 
 * are presumably declared in (or imported from) 'utils.js' 
 * or this same file, depending on your existing architecture.
 * If they are in 'utils.js', make sure you import them here.
 * 
 * Below is a skeleton of some of these references 
 * (based on the original snippet).
 */

// Excerpt from your snippet:

const staging = false;
const liveTest = false;
const SA = false;

window.RD_IS_STAGING_VERSION = staging;
window.RD_IS_LIVE_TEST = liveTest;
window.RD_IS_SA_VERSION = SA;

export const BASE_URL = staging ? "https://api.resumedone-staging.com/v2" : "https://api.resumedone.co/v2";
export const JOB_BASE_URL = staging ? "https://job-api.resumedone-staging.com" : "https://job-api.resumedone.co";
export const STAGE_DOMAIN = "https://resumedone-webapp-feat-pdf-export-issue-perth-ghypepen5q-ew.a.run.app";

const PIN_FULL = chrome.runtime.getURL("src/assets/icon_pin_full.svg");
const pinFullIconTemplate = await fetch(PIN_FULL);
export const pinFullIcon = await pinFullIconTemplate.text();

/** 
 * Helper: fetch user token and relevant data 
 * from chrome.storage.local
 */
export async function loadToken() {
    try {
        const userDatas = await chrome.storage.local.get(["token", "seed", "userid", /* ... */]);
        let showWelcome = false;

        if ("seed" in userDatas) {
            window.USER_VARIANT_SEED = Number(userDatas.seed);
        } else {
            window.USER_VARIANT_SEED = Date.now();
            chrome.storage.local.set({ seed: `${window.USER_VARIANT_SEED}` });
        }

        if ("userid" in userDatas) {
            window.RD_USER_ID = userDatas.userid;
        }
        // ... more logic: set other RD_ flags from storage

        window.RD_INFO_LOADED = true;
        if ("token" in userDatas && userDatas.token.length > 10) {
            return { success: true, token: userDatas.token, isNew: showWelcome };
        } else {
            mountView("login");
            return { success: false, token: null, isNew: false };
        }
    } catch (e) {
        console.error(e.message);
        trackError("loadToken", e.message || "Unknown error", "", false);
        return { success: false, token: null, isNew: false };
    }
}

/**
 * refreshToken
 * ----------------------------------
 * Notifies background script to refresh 
 * the user’s token if expired.
 */
export async function refreshToken() {
    try {
        chrome.runtime.sendMessage({
            action: "refreshToken",
        });
        return true;
    } catch (e) {
        return false;
    }
}

/**
 * mkFetchOption
 * ----------------------------------
 * Builds the fetch options (method, headers, token, etc.)
 * for your API calls. 
 */
function mkFetchOption(method, endpoint, token = null, contentType = "application/json") {
    let fetchOptions = {
        method: method,
        headers: {
            Accept: "application/json",
            "X-source": "chrome-extension",
            "X-App-Version": chrome.runtime.getManifest().version,
        },
    };
    if (contentType) {
        fetchOptions.headers["Content-Type"] = contentType;
    }
    if (token) {
        fetchOptions.headers["authorization"] = `Bearer ${token}`;
    }
    if (window.RD_IS_SA_VERSION && !endpoint.startsWith("/agent-user/list")) {
        if (!window.RD_SA_SELECTED_USER) {
            mountView("select_user");
            return null;
        }
        fetchOptions.headers["X-User-Id"] = `${window.RD_SA_SELECTED_USER.agentClientUserId}`;
    }
    return fetchOptions;
}

// --------------------------------------------------------------
// Additional methods from your original snippet could follow here
// (login, logOut, mkDashboardUrl, fetchResumeList, etc.)
// Each would have minimal commentary if needed, preserving logic.
// --------------------------------------------------------------

/**
 * Example: trackError 
 * (already imported from utils.js if you prefer)
 */
// export function trackError(source, message = "", status = "", request = true) { ... }

