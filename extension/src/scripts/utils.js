/*******************************************************
 * utils.js
 *
 * PURPOSE:
 *   - Central hub for miscellaneous utility functions
 *     that manipulate the DOM, remove elements, track 
 *     user events, etc.
 *   - Dynamically imports other modules (Session, 
 *     Indicative, ResumeInfo, AutoFill) as needed.
 *
 * USAGE:
 *   1) This file can be included as a script in 
 *      manifest.json or imported dynamically in 
 *      your content/background scripts.
 *   2) Functions like `removeKebab()` or `searchTracking()` 
 *      can be called from anywhere in your extension 
 *      to manage UI adjustments or analytics tracking.
 *******************************************************/

// The base URL for loading extension scripts
const BASE_PLUGIN_URL = chrome.runtime.getURL("/");

/* 
 * Dynamically import 'session.js' 
 * (Contains session or data handling logic)
 */
const session = BASE_PLUGIN_URL + "src/scripts/session.js";
const Session = await import(session);

/*
 * Dynamically import 'track.js'
 * (Contains tracking/analytics code, presumably using 'Indicative')
 */
const indicative = BASE_PLUGIN_URL + "src/scripts/track.js";
const Indicative = await import(indicative);

/*
 * Dynamically import 'resume-infos.js'
 * (Likely handles reading or parsing resume data)
 */
const _resumeInfo = BASE_PLUGIN_URL + "src/scripts/resume-infos.js";
const ResumeInfo = await import(_resumeInfo);

/*
 * Dynamically import 'auto-fill.js'
 * (Logic for automatically filling forms with resume data)
 */
const _autofill = BASE_PLUGIN_URL + "src/scripts/auto-fill.js";
const AutoFill = await import(_autofill);

/**
 * removeKebab
 * ----------------------------------------------------
 * PURPOSE:
 *   Removes or hides certain "kebab" (three-dots) menus 
 *   or extraneous UI elements from multiple job platforms.
 *   Helps declutter the interface or prevent user confusion.
 *
 * USAGE:
 *   - Typically called once the page loads or 
 *     after the user navigates to a new job listing.
 */
export async function removeKebab() {
  const variant = window.RD_VARIANTS["exp_plugin_scoring"]?.value;

  // Example for Indeed
  if (window.location.host.includes("indeed.com")) {
    const buttons = document.querySelectorAll(".kebabMenu-button");
    buttons.forEach((button) => {
      button.parentElement.removeChild(button);
    });
  }

  // Example for benevolt.fr
  if (window.location.host.includes("benevolt.fr")) {
    var buttonsToRemove = document.querySelectorAll(".c-button.c-button--blue");
    buttonsToRemove.forEach(function (button) {
      button.remove();
    });
  }

  // ...similar checks for other domains (LinkedIn, Glassdoor, Jooble, Adzuna, etc.)
  // to remove or reposition various elements.

  // Note: Each block is domain-specific.
  // Use `querySelectorAll` to find the UI components
  // and manipulate or remove them as needed.
}

/**
 * searchTracking
 * ----------------------------------------------------
 * PURPOSE:
 *   Tracks user searches based on URL parameters 
 *   (e.g., location, job title, salary).
 *
 * PARAMETERS:
 *   JOB_INFO_SEARCH: object that defines parameter keys 
 *                    (e.g., .location, .title, etc.)
 *   searchedParms: object storing previously known 
 *                  search params (to detect changes).
 *   searchUrl: string, the current search page URL.
 *
 * RETURN:
 *   Updated search params if there's a new search action
 *   or `undefined` if nothing changed.
 */
export async function searchTracking(JOB_INFO_SEARCH, searchedParms, searchUrl) {
  const parsedUrl = new URL(searchUrl);
  const location = parsedUrl.searchParams.get(JOB_INFO_SEARCH.location) || "";
  const title = parsedUrl.searchParams.get(JOB_INFO_SEARCH.title) || "";
  const salaryMin = parsedUrl.searchParams.get(JOB_INFO_SEARCH.salaryMin) || "";
  const salaryMax = parsedUrl.searchParams.get(JOB_INFO_SEARCH.salaryMax) || "";
  const types = parsedUrl.searchParams.getAll(JOB_INFO_SEARCH.type) || [];
  const type = types.join(", ");

  let params = { location, type, title };

  if (JOB_INFO_SEARCH.exception) {
    params = JOB_INFO_SEARCH.exception;
  }

  // Check if user has changed search parameters
  if (
    searchedParms.location !== params.location ||
    searchedParms.type !== params.type ||
    searchedParms.title !== params.title
  ) {
    let property = {
      date: new Date(),
      domain: window.location.hostname,
      job: params.title,
      jobLocation: params.location,
      salary: salaryMin + " - " + salaryMax,
      salaryUnit: "",
      type: params.type,
    };
    if (params.location !== "" || params.type !== "" || params.title !== "") {
      Indicative.track(Indicative.jobSearch, property);
    }
    return params;
  }
  return;
}

/**
 * redirectionJobsList
 * ----------------------------------------------------
 * PURPOSE:
 *   Automatically redirect user to the main job listings 
 *   page on certain sites if they aren't already viewing 
 *   job listings.
 *
 * EXAMPLE:
 *   - If a user goes to the LinkedIn homepage, 
 *     redirect them to /jobs/search/
 *   - If on Indeed but not on "/jobs", redirect to search.
 */
export async function redirectionJobsList() {
  const host = window.location.host;

  const redirectTo = (url) => {
    const link = document.createElement("a");
    link.setAttribute("href", `https://${url}`);
    link.click();
  };

  // LinkedIn example
  if (host.includes("linkedin") && !window.location.href.includes("/jobs")) {
    redirectTo(host + "/jobs/search/?position=1&pageNum=0");
  }

  // Indeed example
  if (
    host.includes("indeed") &&
    !(window.location.href.includes("/jobs") || 
      window.location.href.includes("/cmp") || 
      window.location.href.includes("/viewjob"))
  ) {
    redirectTo(host + "/jobs?q=remote&l=Remote");
  }

  // ... similar for Glassdoor, bayt, leboncoin, etc.
}

/**
 * showHintOnce
 * ----------------------------------------------------
 * PURPOSE:
 *   Shows a “hint” or some UI prompt only once 
 *   when the user first views a job card, 
 *   then optionally navigates them to that job link.
 *
 * NOTE:
 *   - Uses `chrome.storage.local` to remember 
 *     that the hint was shown, so it doesn’t appear 
 *     repeatedly.
 */
export async function showHintOnce() {
  window.RD_CARD_FOCUSED = true;
  const _cardFocused = await chrome.storage.local.get(["rd_card_focus"]);
  if (_cardFocused && "rd_card_focus" in _cardFocused) {
    window.RD_CARD_FOCUSED = _cardFocused.rd_card_focus !== "true";
  }

  const isScannedHost = await Session.weScan();
  const jobCard = document.querySelector("#rd-list-0-0");
  setTimeout(() => {
    if (isScannedHost && jobCard && window.RD_JOB_LINK_0 && !window.RD_CARD_FOCUSED && window.RD_SHOW_HINT) {
      window.RD_CARD_FOCUSED = true;
      chrome.storage.local.set({ rd_card_focus: "true" });
      window.open(window.RD_JOB_LINK_0, "_self");
    }
  }, 3000);
}

/**
 * updateInputs
 * ----------------------------------------------------
 * PURPOSE:
 *   Dispatches a custom event to update form inputs 
 *   across the page based on some payload data 
 *   (e.g., user’s name, phone, etc.).
 *
 * USAGE:
 *   - Another part of your script can listen for
 *     "rdupdateinputs" and handle data merging 
 *     or DOM updates.
 */
export function updateInputs(payload) {
  const event = new CustomEvent("rdupdateinputs", {
    detail: { message: payload },
  });
  window.dispatchEvent(event);
}

/**
 * getLinkedinURLProfile
 * ----------------------------------------------------
 * PURPOSE:
 *   Extracts a LinkedIn public profile identifier 
 *   from the current page, stores it, and (optionally) 
 *   closes the tab via a background script message.
 *
 * PARAMS:
 *   closeTab: boolean, if true the tab is closed 
 *             after extraction.
 *   retry: number, how many times to attempt 
 *          extraction if the code snippet 
 *          isn’t found immediately.
 *
 * RETURNS:
 *   The LinkedIn public identifier (string) 
 *   or an empty string if not found.
 */
export async function getLinkedinURLProfile(closeTab = true, retry = 10) {
  // ... code that finds "publicIdentifier" in <code> blocks
  // and sets it in `chrome.storage.local`.
  //
  // If successful, it saves the link:
  //   Session.saveLinkedinUrl(`https://www.linkedin.com/in/${result}`)
  //
  // Then optionally closes the tab.

  // The snippet from your code goes here as-is, 
  // with added comments if needed.
}

/**
 * checkResumeDetail
 * ----------------------------------------------------
 * PURPOSE:
 *   Analyzes HTML forms for aria-label attributes 
 *   that match certain fields (e.g., phone, email), 
 *   then returns a set of actions to auto-fill them.
 *
 * PARAMS:
 *   formsHTML (string): The HTML of a form or multiple forms.
 *
 * RETURNS:
 *   An object with two properties:
 *   - cleanedFormsHTML: array of HTML strings 
 *     (with matched fields removed).
 *   - res: array of fill-in actions 
 *     (selector + action + value).
 */
export function checkResumeDetail(formsHTML) {
  let res = [];
  let cleanedFormsHTML = [];
  let cleanedHTML = formsHTML;

  // Example: match <input> with aria-label attributes
  const elementsWithAriaLabel = formsHTML.match(/<input[^>]+aria-label[^>]+>/g) || [];
  for (const element of elementsWithAriaLabel) {
    const ariaLabelMatch = element.match(/aria-label="([^"]+)"/);
    if (!ariaLabelMatch) continue;
    const ariaLabel = ariaLabelMatch[1];
    // Try to match with resume detail (phone, email, etc.)
    const normalizedLabel = searchAndNormalizeAriaLabel(ariaLabel);
    if (normalizedLabel !== null) {
      const idMatch = element.match(/id="([^"]+)"/);
      if (idMatch) {
        const id = idMatch[1];
        res.push({
          selector: "#" + id,
          action: "setValue",
          value: normalizedLabel,
        });
        cleanedHTML = cleanedHTML.replace(element, "");
      }
    }
  }
  cleanedFormsHTML.push(cleanedHTML);
  return { cleanedFormsHTML, res };
}

/**
 * searchAndNormalizeAriaLabel (helper)
 * ----------------------------------------------------
 * PURPOSE:
 *   Takes an aria-label and tries to match it with 
 *   a known resume detail. If a match is found, 
 *   returns the detail’s value (e.g., phone or email).
 *
 * NOTE:
 *   - Uses a phone normalization step if it detects 
 *     a phone number.
 */
function searchAndNormalizeAriaLabel(label) {
  const details = window.RD_SELECTED_RESUME_CONTENT["details"];
  const normalizedLabel = label.replace(/\s/g, "").toLowerCase();
  for (const key in details) {
    let normalizedKey = key.replace(/\s/g, "").toLowerCase();
    if (normalizedLabel.includes(normalizedKey)) {
      if (normalizedKey.includes("phone")) {
        return normalizePhoneNumber(details[key], normalizedLabel);
      }
      // Additional checks for email, address, etc.
      return details[key];
    }
  }
  return null;
}

/**
 * normalizePhoneNumber (helper)
 * ----------------------------------------------------
 * PURPOSE:
 *   If the user’s phone includes a +countryCode 
 *   but the form expects a local number or vice versa, 
 *   adjust it accordingly.
 */
function normalizePhoneNumber(phoneNumber, normalizedKey) {
  const countryCodeRegex = /\+(\d{1,3})/;
  const countryCodeMatch = phoneNumber.match(countryCodeRegex);
  const normalizedKeyMatch = normalizedKey.match(countryCodeRegex);
  if (normalizedKeyMatch && countryCodeMatch && countryCodeMatch[1] === normalizedKeyMatch[1]) {
    const countryCode = countryCodeMatch[1];
    return phoneNumber.replace(`+${countryCode}`, "");
  }
  return phoneNumber;
}

/**
 * analyzeForms
 * ----------------------------------------------------
 * PURPOSE:
 *   Iterates over multiple forms, calls AI-based 
 *   auto-fill logic (Session.autoFill), merges any 
 *   cover letter content, and executes the fill actions.
 *
 * PARAMS:
 *   forms (NodeList or array of HTML form strings).
 *
 * RETURNS:
 *   allActions: array of all fill actions performed.
 */
export async function analyzeForms(forms) {
  let allActions = [];
  try {
    const nonEmptyForms = Array.from(forms).filter((form) => !isEmptyForm(form));
    const promises = nonEmptyForms.map(async (form) => {
      // Process each form HTML...
      // e.g., call Session.autoFill() and 
      // then do Session.parseValues() + Session.executeActions().
    });
    await Promise.all(promises);
  } catch (error) {
    console.warn("Error in analyzeForms:", error);
  }
  return allActions;
}

/**
 * isEmptyForm (helper)
 * ----------------------------------------------------
 * PURPOSE:
 *   Simple check for whether the form HTML string 
 *   is basically empty or too short to be a real form.
 */
function isEmptyForm(formText) {
  const trimmedText = formText.trim();
  return trimmedText.length < 15;
}

/**
 * verifyInputsNotCleared
 * ----------------------------------------------------
 * PURPOSE:
 *   Double-check that auto-filled values are still 
 *   in the inputs (sometimes the page might overwrite them).
 *   If they were cleared, re-apply them via Session.executeAction().
 *
 * PARAMS:
 *   actions: array of objects with {selector, value, action}.
 */
export async function verifyInputsNotCleared(actions) {
  for (const { selector, value, action } of actions) {
    if (!selector || selector === "") continue;
    if (value === "resume.pdf") continue; // skip file inputs?
    const element = getElement(selector);
    if (!element) continue;
    if (element.value !== value) {
      Session.executeAction({ selector, value, action });
    }
  }
  window.RESUME_ATTACHED = false;
}

/**
 * getElement (helper)
 * ----------------------------------------------------
 * PURPOSE:
 *   Safely query a DOM element by a given selector,
 *   escaping any special characters like '[' or ']'.
 */
function getElement(selector) {
  const sanitizedSelector = selector?.replace(/\[/g, "\\[").replace(/\]/g, "\\]");
  return document.querySelector(sanitizedSelector) || null;
}

/**
 * setTextApply
 * ----------------------------------------------------
 * PURPOSE:
 *   Customizes the "Apply" button text based on 
 *   an experimental variant (e.g., "Quick Apply").
 *
 * NOTE:
 *   Currently returns immediately. 
 *   If you want to enable it, remove the `return;` line.
 */
export async function setTextApply(selector) {
  return; // No-op by default
  // ...
  // Example usage with variant
  // let variants = await Session.getVariant();
  // ...
}

/**
 * addTrackApplyBtn
 * ----------------------------------------------------
 * PURPOSE:
 *   Attaches a click handler to an "Apply" button 
 *   to track usage analytics, e.g. how many people click 
 *   "Easy Apply" vs. "External Apply."
 *
 * PARAMS:
 *   infos: object with jobLink, jobTitle, etc.
 *   applyBtnCss: CSS selector for the button(s) to track
 *   el: root DOM element to search within (defaults to `document`)
 *   apply_from_card: boolean, indicates if the button is 
 *                    in a job-card snippet.
 */
export function addTrackApplyBtn(infos, applyBtnCss, el = document, apply_from_card = false) {
  let buttons;
  if (apply_from_card) {
    buttons = el?.querySelector(applyBtnCss);
  } else {
    buttons = el?.querySelectorAll(applyBtnCss);
  }

  const clickHandler = () => {
    // ...
    // Example: Indicative.trackApplyBtn(website, jobLink, jobTitle, internal, link);
  };

  if (buttons) {
    buttons.forEach((button) => {
      button.removeEventListener("click", clickHandler);
      button.addEventListener("click", clickHandler);
    });
  }
}

/**
 * easyApplyProcess (helper inside addTrackApplyBtn)
 * ----------------------------------------------------
 * PURPOSE:
 *   Orchestrates an “Easy Apply” flow by:
 *     1) Setting phone number & country code
 *     2) Attaching the resume
 *     3) Stepping through additional form fields
 *     4) Invoking Session.autoFill() + Session.executeActions()
 *   This is specialized logic for LinkedIn or other 
 *   job boards that have multi-step “Easy Apply” flows.
 *
 * NOTE:
 *   Because it’s quite lengthy, keep it well commented
 *   and consider splitting it into smaller subfunctions 
 *   if needed.
 */
// function easyApplyProcess() { ... } 
// (Already included above in the snippet; keep it or refine.)

