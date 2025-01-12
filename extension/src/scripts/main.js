/*******************************************************
 * main.js
 *
 * PURPOSE:
 *  - Initializes and orchestrates the extension’s main UI 
 *    (e.g., floating action button (FAB), overlays, popups).
 *  - Hooks into the job scanning, session management, 
 *    and tracking logic.
 *  - Dynamically imports other modules (`session.js`, 
 *    `track.js`, `cv-scan.js`, `utils.js`, `views.js`) 
 *    and calls their methods.
 *******************************************************/

// Imports and resource fetches
const BASE_PLUGIN_URL = chrome.runtime.getURL("/");

const HOVER_MENU = BASE_PLUGIN_URL + "src/component/hovermenu.html";
const HOVER_MENU_DESIGN_2 = BASE_PLUGIN_URL + "src/component/hovermenu_design_2.html";

const _session = BASE_PLUGIN_URL + "src/scripts/session.js";
const Session = await import(_session);
window.skipMountJobView = false;

// indicative tracking
const Indicative = await import(BASE_PLUGIN_URL + "src/scripts/track.js");

// CV scan scripts
const CvScan = await import(BASE_PLUGIN_URL + "src/scripts/cv-scan.js");

// utility scripts
const Utils = await import(BASE_PLUGIN_URL + "src/scripts/utils.js");

// views scripts
const Views = await import(BASE_PLUGIN_URL + "src/scripts/views.js");

// Fetch HTML + SVG assets
const mainBtnAsset = await (await fetch(BASE_PLUGIN_URL + "src/component/plugin_button.html")).text();
const loaderIcon = await (await fetch(BASE_PLUGIN_URL + "src/component/btn-loader.html")).text();
const logo = await (await fetch(BASE_PLUGIN_URL + "src/assets/logo.svg")).text();
const logo_design_2 = await (await fetch(BASE_PLUGIN_URL + "src/assets/logo_design_2.svg")).text();
const closeIcon = await (await fetch(BASE_PLUGIN_URL + "src/assets/icon_close.svg")).text();
const pin_icon = await (await fetch(BASE_PLUGIN_URL + "src/assets/icon_pin.svg")).text();
const logo_sm_icon = await (await fetch(BASE_PLUGIN_URL + "src/assets/logo-sm.svg")).text();

// High-level state variables
let apiToken;
let prevView = "";
let prevPopupView = "";
let views = {};
let popupViews = {};

let trackOnce = true;
let injIdx = 0;
let CURRENT_URL,
    JOB_LIST,
    CHILD_NODE,
    TEST_EL,
    JOB_TITLE,
    JOB_LINK,
    COMPANY_LOGO,
    COMPANY_PAGE,
    COMPANY_NAME,
    JOB_LOCATION,
    JOB_DESCRIPTION,
    JOB_BOOKMARK,
    JOB_INFO_SEARCH,
    JOB_APPLY;
let JobDetails = false;
let throttleMount = 0;

// Default no-op references
let JobApplicationProcess = () => {};
let JobInject = () => {};
let GetJobList = () => {};
let GetJobTitle = (el, jobTitle) => el.querySelector(jobTitle).innerText; 
// etc. for GetJobLink, GetCompanyLogo ...

// Basic arrays and counters
let p_idx = [];
let len = {};

// UI elements
let main_btn = null; 
let lastViewTime = Date.now();

let card = null;
let showOvl = false;

let hover_menu = null;
let hover_menu_ovl = null;

let notificationBadge = null;

let popup = null;
let popup_ovl = null;
let showPopupOvl = false;

let detailsUrl = "";
let searchUrl = "";
let searchedParms = {
    location: "",
    type: "",
    title: "",
};

//-----------------------------------------
// Core: mountView and mountPopupView
//-----------------------------------------

/**
 * mountPopupView
 * --------------------------------------------
 * Loads the specified popup view (e.g., 
 * "scan_hint", "no_resume") into the popup overlay.
 */
async function mountPopupView(p, forceMount = false) {
  let popupView = p;
  // if the requested popup doesn’t exist, exit
  if (!(popupView in popupViews)) {
    return;
  }
  try {
    // Some special logic for "scan_hint" if "exp_hint_design" is set to fancy
    if (
      popupView == "scan_hint" &&
      window.RD_VARIANTS &&
      window.RD_VARIANTS["exp_hint_design"] &&
      window.RD_VARIANTS["exp_hint_design"].value == "fancy"
    ) {
      popupView = "scan_hint_fancy";
    }

    // Check if we’re re-opening the same hint
    if (
      prevPopupView == popupView &&
      (popupView == "scan_hint" || popupView == "scan_hint_fancy" || popupView == "onboarding")
    ) {
      return;
    }
    if (showPopupOvl && prevPopupView.indexOf("scan_hint") > -1 && popupView == "no_resume") {
      return;
    }

    // Skip if "no_resume" and user is in "hint" mode
    if (popupView == "no_resume" && window.RD_SHOW_HINT) {
      return;
    }
    if (popupView != "select_resume") {
      window.RD_HAD_SELECTED_RESUME = false;
    }

    // Unbind old actions if we’re switching popups
    if (prevPopupView) {
      popupViews[prevPopupView].actions.forEach((el) => {
        const actionBtn = popup.querySelector(el.id) || document.querySelector(el.id);
        if (actionBtn) actionBtn.removeEventListener(el.type, mkAction(el.callback));
      });
    }

    // If hint is off but we requested a hint popup
    if (popupView.indexOf("scan_hint") > -1 && !window.RD_SHOW_HINT) {
      window.RD_PREVENT_POPUP_CLOSE = false;
      return;
    }

    // Fill popup with the new template
    popup.innerHTML = popupViews[popupView].template;

    // If the popup has a “mods” function (e.g., to init DOM or watchers), call it
    if ("mods" in popupViews[popupView]) {
      await popupViews[popupView].mods();
    }
    // Re-bind actions
    popupViews[popupView].actions.forEach((el) => {
      const actionBtn = popup.querySelector(el.id) || document.querySelector(el.id);

      if (actionBtn && "attrs" in el) {
        el.attrs.forEach((attr) => {
          actionBtn.setAttribute(attr.key, attr.value);
        });
      }
      if (actionBtn && "mods" in el) {
        el.mods(actionBtn);
      }
      if (actionBtn && "callback" in el) {
        actionBtn.addEventListener(el.type, mkAction(el.callback));
      }
    });

    // Typically if we’re not in a hint or special process, 
    // user can close the popup
    if (
      popupView != "scan_hint" &&
      popupView != "scan_hint_fancy" &&
      popupView != "onboarding" &&
      popupView != "apply_template"
    ) {
      window.RD_PREVENT_POPUP_CLOSE = false;
    }
  } catch (e) {
    console.error(e);
  } finally {
    prevPopupView = popupView || p;
    let property = {
      date: new Date(),
      domain: CURRENT_URL.origin,
    };
    Indicative.trackView(`${p}_popup`, property);
    return;
  }
}

/**
 * mountView
 * --------------------------------------------
 * Loads the given view (like "job", "scan", "autofill") 
 * into the main “card” element in the bottom corner.
 */
async function mountView(view, forceMount = false, show = true) {
  if (!(view in views)) {
    return;
  }
  // Some special toggles for "job" vs "autofill" etc.
  if ((window.RD_DEFAULT_PLUGIN_SESSION || prevView == "autofill") && view == "job" && window.RD_ACTIVE_APPLY_FORM) {
    view = "autofill";
  }
  if (Session.weScan() && document.querySelector("#rd-match-btn") && view == "autofill") return;
  if (view === "job" && (window.skipMountJobView || Session.weScan()) && !forceMount) return;

  // Trigger a “view” event
  let property = {
    date: new Date(),
    domain: CURRENT_URL.origin,
  };
  Indicative.trackView(view, property);

  // Unbind old event actions
  if (prevView) {
    views[prevView].actions.forEach((el) => {
      const actionBtn = card.querySelector(el.id);
      if (actionBtn) actionBtn.removeEventListener(el.type, mkAction(el.callback));
    });
  }

  // If “no_resume” view is requested, show that as a popup
  if (view == "no_resume") {
    if (window.RD_SHOW_HINT) return;
    mountPopupView("no_resume");
    showPopup();
    prevView = view;
    rdShowLogo();
    return;
  }

  // Adjust styling for card if a certain max-height or box-shadow is set
  let displayNone = false;
  if ("max-height" in views[view].props) {
    card.style.setProperty("max-height", views[view].props["max-height"]);
    if (views[view].props["max-height"] === 0) {
      card.style.setProperty("box-shadow", "none !important");
      displayNone = true;
    } else {
      card.style.removeProperty("box-shadow");
    }
  } else {
    card.style.removeProperty("box-shadow");
    card.style.removeProperty("max-height");
    card.style.removeProperty("transition");
  }

  // Set card width from the view’s props
  if (typeof views[view].props.width == "number") {
    card.style.setProperty("--rd-card-width", `${views[view].props.width}px`);
  }
  if (typeof views[view].props.width == "string") {
    card.style.setProperty("--rd-card-width", `${views[view].props.width}`);
  }

  // Fill card with the new view’s template
  card.innerHTML = views[view].template;

  // If the view has a “mods” function, run it
  if ("mods" in views[view]) {
    await views[view].mods();
  }

  // Re-bind events for the new view
  views[view].actions.forEach((el) => {
    const actionBtn = card.querySelector(el.id);
    if (actionBtn && "attrs" in el) {
      el.attrs.forEach((attr) => {
        actionBtn.setAttribute(attr.key, attr.value);
      });
    }
    if (actionBtn && "mods" in el) {
      el.mods(actionBtn);
    }
    if (actionBtn && "callback" in el) {
      actionBtn.addEventListener(el.type, mkAction(el.callback));
    }
  });

  prevView = view;

  // For the “job” view, set up a text editor, etc.
  if (view == "job") {
    const jobButton = card.querySelector("#rd-job-btn-text");
    const boardName = Session.getBoardName(window.RD_SELECTED_BOARD?.boardId || -1, "Job board");
    jobButton.innerText = boardName;

    const EDITOR = BASE_PLUGIN_URL + "src/plugin/rd-editor.js";
    const rdeditor = await import(EDITOR);

    document.getElementById("rd-editor") &&
      rdeditor.init({
        element: document.getElementById("rd-editor"),
        onChange: (html) => {
          // ...
        },
        actions: [
          "bold",
          "italic",
          "underline",
          "strikethrough",
          "olist",
          "ulist",
          {
            name: "link",
            result: () => {
              const url = window.prompt("Enter the link URL");
              if (url) {
                rd - editor.exec("createLink", this.ensureHTTP(url));
              }
            },
          },
        ],
      });
  }

  // Possibly update form inputs if user selected a job card
  setTimeout(() => {
    const inputValues = window.latestInputValues || window.savedPayload;
    inputValues && updateInputs(inputValues);
  }, 500);

  // If scanning result
  if (view == "scan") {
    window.skipMountJobView = true;
    if (window.RD_RESUMES && window.RD_RESUMES.length > 0 && window.RD_SELECTED_RESUME_CONTENT) {
      Session.log("mounting scan result");
      await CvScan.updateMatchList(
        card,
        {
          match: window.matchedSkills || [],
          missing: window.missingSkills || [],
          percentage: window.percSkills || 0,
        },
        window.matchedjobTitle
      );
      // If we want to show the card
      show && (await showCard()) && rdShowClose();
      show || rdShowLogo();
    } else {
      mountPopupView("no_resume");
      showPopup();
      closeCard(false);
      return;
    }
  } else {
    // If not scanning, just show the card
    show && showCard();
  }
}

/**
 * mkAction
 * --------------------------------------------
 * Tiny helper: returns the passed callback 
 * so it can be used as an event listener.
 */
function mkAction(action) {
  return action;
}

//-----------------------------------------
// Job Info and Click Controllers
//-----------------------------------------

function getInfos(el) {
  // Gather job info from HTML
  const jobTitle = JOB_TITLE != "" ? GetJobTitle(el, JOB_TITLE) : "";
  const jobLink = JOB_LINK != "" ? GetJobLink(el, JOB_LINK) : "";
  const companyLogoSrc = COMPANY_LOGO != "" ? GetCompanyLogo(el, COMPANY_LOGO) : "";
  const companyPage = COMPANY_PAGE != "" ? GetCompanyPage(el, COMPANY_PAGE) : "";
  const companyName = COMPANY_NAME != "" ? GetCompanyName(el, COMPANY_NAME) : "";
  const jobLocation = JOB_LOCATION != "" ? GetJobLocation(el, JOB_LOCATION) : "";
  let jobDescription = JOB_DESCRIPTION != "" ? GetJobDescription(el, JOB_DESCRIPTION) : "";
  if (jobDescription == "") jobDescription = el.innerText;

  return { jobTitle, jobLink, companyLogoSrc, companyPage, companyName, jobLocation, jobDescription };
}

/**
 * switchCard
 * --------------------------------------------
 * Toggles the main card’s visibility, 
 * flipping the “showOvl” flag, etc.
 */
async function switchCard(showSettCard = true) {
  showOvl = !showOvl;
  const dimOvl = 1 * showOvl;
  card.style.setProperty("--dim-ovl", `${dimOvl}`);

  if (!showOvl) {
    window.skipMountJobView = false;
    rdShowLogo();

    if (prevView === "settings" || prevView === "boardselect") {
      Session.saveSettings();
    }
    if (prevView === "tips") {
      window.RD_TIPS && chrome.storage.local.set({ last_tip: `${window.RD_TIPS.post_id}` });
      window.RD_TIPS = null;
    }

    showSettCard && showSettingCard();
  } else {
    closeSettingCard();
    rdShowClose();
  }
  return true;
}

// Standard show/hide card + popup
export async function showCard() {
  if (!showOvl) {
    await switchCard();
  }
  return true;
}
export function closeCard(showSettCard = true) {
  if (prevView === "scan" && window.RD_HAD_SELECTED_RESUME) {
    showPopup("select_resume");
  }
  if (showOvl) {
    switchCard(showSettCard);
  }
  return true;
}
export function showSettingCard() {
  if (showOvl) return;
  hover_menu_ovl.style.setProperty("--dim-hv", "1");
}
export function closeSettingCard() {
  hover_menu_ovl.style.setProperty("--dim-hv", "0");
}

// For popup
export function switchPopup(payload) {
  showPopupOvl && closePopup(payload);
}
export function showPopup(view = "") {
  if (view != "") {
    mountPopupView(view);
  }
  popup_ovl.style.setProperty("--dim-popup", "1");
  showPopupOvl = true;
}
export function closePopup(payload) {
  if ((window.RD_SHOW_UPLOAD_RESUME === "showing" || window.RD_PREVENT_POPUP_CLOSE) && payload != "force") {
    return;
  }
  if (window.RD_SHOW_UPLOAD_RESUME === "showing") {
    window.RD_SHOW_UPLOAD_RESUME = false;
    chrome.storage.local.set({ rd_show_upload_resume: "false" });
  } else if (window.RD_SHOW_ONBOARDING == "showing") {
    window.RD_SHOW_ONBOARDING = false;
  }
  window.RD_PREVENT_POPUP_CLOSE = false;
  popup_ovl.style.setProperty("--dim-popup", "0");
  popup.innerHTML = "";
  showPopupOvl = false;
}

// Toggle main FAB icon between loading, logo, close
export async function rdShowLoading() {
  rdShowLogo();
}
export async function rdShowLogo() {
  if (window.RD_VARIANTS && window.RD_VARIANTS["exp_plugin_button_design"].value == "design-2") {
    main_btn.innerHTML = logo_design_2 + loaderIcon;
  } else {
    main_btn.innerHTML = logo + loaderIcon;
    main_btn.classList.add("rd-fa-btn");
    main_btn.classList.remove("rd-fa-btn-white");
  }
}
export async function rdShowClose() {
  main_btn.classList.remove("rd-fa-btn");
  main_btn.classList.add("rd-fa-btn-white");
  main_btn.innerHTML = closeIcon;
}

/**
 * mkClickEventController
 * --------------------------------------------
 * Returns a function that, on click:
 *   1) updates input fields with job info
 *   2) optionally calls Session.saveToBoard()
 *   3) triggers scanning if flagged
 */
function mkClickEventController(payload, save = false, forBookmarkBtns = true, forListScanBtns = false) {
  async function ClickEventController(ev) {
    Session.log(payload);
    if (forBookmarkBtns) {
      ev.stopPropagation();
      ev.preventDefault();
      window.LAST_SAVE_BTN = ev.target;
    }
    if (prevView != "login" && prevView != "job") {
      if (forBookmarkBtns) mountView("job", true);
    }
    if (forBookmarkBtns && !showOvl) {
      rdShowLoading();
      setTimeout(() => {
        switchCard();
      }, 6000);
    }
    setTimeout(
      () => {
        updateInputs(payload);
        save && Session.saveToBoard();
      },
      save ? 500 : 1
    );
    if (forListScanBtns) {
      window.fromCard = true;
      await chrome.storage.local.set({ fromCard: "true" });
    }
  }
  return ClickEventController;
}

/**
 * updateInputSelected
 * --------------------------------------------
 * Called when the user highlights text in the page 
 * (like an address). We auto-insert it into whichever 
 * input is “activeInput.”
 */
function updateInputSelected(activeInput, content) {
  if (content === "") return;
  let activeInput_;
  if (activeInput === "#rd-editor") {
    activeInput_ = document.querySelector(".rd-editor-content");
    if (activeInput_) activeInput_.innerText = content;
  }
  let property = {
    date: new Date(),
    field: activeInput,
    content: content,
    domain: CURRENT_URL.origin,
  };
  Indicative.track(Indicative.pluginFilledManually, property);
}

/**
 * updateInputs
 * --------------------------------------------
 * Transfers job data (title, link, company, etc.) 
 * into the main extension form fields.
 */
export async function updateInputs({
  jobTitle,
  jobLink,
  companyLogoSrc,
  companyPage,
  companyName,
  jobLocation,
  jobDescription,
}) {
  try {
    if (prevView === "job") {
      const inputTitle = document.querySelector("#rd-inp-job-title");
      const inputLink = document.querySelector("#rd-inp-job-link");
      const inputCompanyName = document.querySelector("#rd-inp-company-name");
      const inputLocation = document.querySelector("#rd-inp-job-location");
      const divLabel = document.querySelector(".rd-editor-content");

      inputTitle.value = jobTitle;
      inputLink.value = jobLink;
      inputCompanyName.value = companyName;
      inputLocation.value = jobLocation;
      divLabel.innerText = jobDescription;
      window.latestInputValues = null;
    } else {
      window.latestInputValues = {
        jobTitle,
        jobLink,
        companyLogoSrc,
        companyPage,
        companyName,
        jobLocation,
        jobDescription,
      };
    }
  } catch (e) {
    // ...
  } finally {
    if (jobLink && companyName && jobLink && jobDescription) {
      window.savedPayload = {
        jobTitle,
        jobLink,
        companyLogoSrc,
        companyPage,
        companyName,
        jobLocation,
        jobDescription,
      };
    }
    return;
  }
}

// Additional internal helpers for details or pinned jobs, etc.
// ...

/**
 * watch
 * --------------------------------------------
 * A recurring function (runs every 2 seconds)
 * to check for new job cards, auto-run scanning logic, 
 * handle hint popups, bulk scanning, etc.
 */
async function watch(step = 0) {
  try {
    if (showOvl || showPopupOvl) {
      lastViewTime = Date.now();
    }
    // If user is idle for > 60 seconds, show tips
    if (Date.now() - lastViewTime > 60000 && window.RD_TIPS) {
      mountView("tips");
    }

    // Example LinkedIn logic: detect special “connections” page
    if (
      CURRENT_URL.host.includes("linkedin") &&
      window.LINKEDIN_ACCOUNT &&
      CURRENT_URL.pathname.startsWith("/mynetwork/invite-connect/connections")
    ) {
      // Session.mkInvitBtns(); 
    }

    // If user is on LinkedIn feed, show tips cta
    if (
      CURRENT_URL.host.includes("linkedin") &&
      window.LINKEDIN_ACCOUNT &&
      (CURRENT_URL.pathname.startsWith("/feed") || CURRENT_URL.pathname.startsWith("/posts/cohenfab"))
    ) {
      Session.mkShowTipsCta(CURRENT_URL);
    }

    // If we have a job list defined, iterate it for new/updated job items
    let job_list = null;
    if (JOB_LIST) {
      job_list = GetJobList(JOB_LIST);
    }
    if (job_list) {
      let mountedBtns = document.querySelectorAll(".rd-bookmark-btn");
      if (mountedBtns.length === 0) {
        p_idx = [];
        len = {};
        injIdx = 0;
      }
      job_list.forEach((el, key) => {
        const lis = el.childNodes;
        if (!(key in len)) {
          len[key] = 0;
        }
        if (lis.length > len[key]) {
          len[key] = len[key] + addBtn(lis, key, CHILD_NODE, TEST_EL) - (len[key] == 0 * 1);
        }
      });
      if (trackOnce) {
        let property = {
          date: new Date(),
          domain: window.location.hostname,
        };
        Indicative.track(Indicative.viewJob, property);
        trackOnce = false;
      }
    }

    // Check if user triggered “Show Upload Resume” or “Onboarding”
    if (window.RD_SHOW_UPLOAD_RESUME && window.RD_SHOW_UPLOAD_RESUME != "showing") {
      window.RD_SHOW_UPLOAD_RESUME = "showing";
      mountPopupView("create_upload") && showPopup();
    }
    if (window.RD_SHOW_ONBOARDING && window.RD_SHOW_ONBOARDING != "showing" && !window.RD_SHOW_UPLOAD_RESUME) {
      window.RD_SHOW_ONBOARDING = "showing";
      mountPopupView("onboarding") && showPopup();
    }

    // If user wants to show a hint
    if (window.RD_SHOW_HINT && !window.RD_SHOW_ONBOARDING) {
      let matchBtn = null;
      let rect = null;
      const matchBtns = document.querySelectorAll("#rd-match-btn");
      const scoreBanners = document.querySelectorAll("#rd-score-banner");
      if ((matchBtns && matchBtns.length) || (scoreBanners && scoreBanners.length)) {
        if (matchBtns && matchBtns.length) {
          matchBtn = matchBtns[matchBtns.length - 1];
          rect = matchBtn.getBoundingClientRect();
        }
        if (scoreBanners && scoreBanners.length) {
          matchBtn = scoreBanners[scoreBanners.length - 1];
          rect = matchBtn.getBoundingClientRect();
        }
      }

      if (matchBtn && rect && rect.left > 0) {
        window.RD_CARD_FOCUSED = true;
        mountPopupView("scan_hint") && showPopup();
        window.RD_SHOW_HINT = false;
      } else {
        Utils.showHintOnce();
      }
    }

    // If jobDetails is provided, gather job details 
    // (like advanced data) from the DOM
    JobDetails && getJobDetails(JobDetails);
    document.querySelectorAll(".rd-rm").forEach((el) => {
      el.remove();
    });

    // Remove extraneous UI elements
    Utils.removeKebab();
    // Watch or run any custom job application flow
    JobApplicationProcess();

    // Possibly track user’s search queries
    if (JOB_INFO_SEARCH && window.location.href !== searchUrl) {
      searchUrl = document.location.href;
      const _searchedParms = await Utils.searchTracking(JOB_INFO_SEARCH, searchedParms, searchUrl);
      if (_searchedParms) {
        searchedParms = _searchedParms;
      }
    }

    // If we have unfilled forms, show the “autofill” view
    if (!showPopupOvl && window.RD_APPLY_FORMS && window.RD_APPLY_FORMS.length) {
      const unfilledForms = window.RD_APPLY_FORMS.filter((el) => !el.filled);
      unfilledForms.length && mountView("auto_fill");
    }

    // Bulk scanning logic, special to LinkedIn, if user’s variant says so
    // ...
  } catch (error) {
    console.error(error);
  } finally {
    setTimeout(() => {
      watch(step + 1);
    }, 2000);
  }
}

/**
 * init
 * --------------------------------------------
 * Called to bootstrap the extension logic. 
 * @param {object} param0 
 *   - A collection of references (jobTitle selector, etc.), 
 *     plus site-specific callbacks.
 */
export async function init({
  // destructured params with defaults
  currentUrl = null,
  jobList = null,
  childNodeName = null,
  childTestEl = null,
  jobTitle = null,
  jobLink = null,
  companyLogo = null,
  companyPage = null,
  companyName = null,
  jobLocation = null,
  jobDescription = "",
  jobBookmark = "",
  jobInfoSearch = {},
  jobApply = "",
  getJobList = (jobList, retry = 0) => {
    const job_list = document.querySelectorAll(jobList);
    if ((!job_list || job_list.length == 0) && retry < 10) {
      setTimeout(() => {
        return getJobList(jobList, retry + 1);
      }, 2000);
    }
    return job_list;
  },
  getJobTitle,
  getJobLink,
  getCompanyLogo,
  getCompanyPage,
  getCompanyName,
  getJobLocation,
  getJobDescription = () => {},
  getJobBookmark = () => {},
  jobInject = () => {},
  jobDetails = false,
  jobApplicationProcess = () => {},
  fromDefault = false,
  fill = null,
}) {
  if (window.RD_ACTIVE_PLUGIN_SESSION) return;
  window.RD_ACTIVE_PLUGIN_SESSION = true;

  CURRENT_URL = currentUrl;

  // If not from default script, store all user-provided references
  if (!fromDefault) {
    JOB_LIST = jobList;
    CHILD_NODE = childNodeName;
    TEST_EL = childTestEl;
    JOB_TITLE = jobTitle;
    JOB_LINK = jobLink;
    COMPANY_LOGO = companyLogo;
    COMPANY_PAGE = companyPage;
    COMPANY_NAME = companyName;
    JOB_LOCATION = jobLocation;
    JOB_DESCRIPTION = jobDescription;
    JOB_BOOKMARK = jobBookmark;
    JOB_INFO_SEARCH = jobInfoSearch;
    JOB_APPLY = jobApply;
    GetJobList = getJobList;
    GetJobTitle = getJobTitle;
    GetJobLink = getJobLink;
    GetCompanyLogo = getCompanyLogo;
    GetCompanyPage = getCompanyPage;
    GetCompanyName = getCompanyName;
    GetJobLocation = getJobLocation;
    GetJobDescription = getJobDescription;
    GetJobBookmark = getJobBookmark;
    JobDetails = jobDetails;
    JobApplicationProcess = jobApplicationProcess;
    JobInject = jobInject;
  } else {
    // from default fallback script
    chrome.runtime.sendMessage({ action: "injectCss" });
    window.RD_DEFAULT_PLUGIN_SESSION = true;
  }

  // If in SA mode with a “saemail” param, auto-fetch that user
  if (window.RD_IS_SA_VERSION && CURRENT_URL.searchParams.has("saemail")) {
    const saEmail = CURRENT_URL.searchParams.get("saemail");
    const saUsers = await Session.fetchUserList(saEmail, false);
    if (saUsers && saUsers.length) {
      window.RD_SA_SELECTED_USER = saUsers[0];
      window.skip_sa_select_user = true;
      chrome.storage.local.set({ sa_selected_user: JSON.stringify(saUsers[0]) });
    }
  }

  // Bind custom events for mounting or toggling views
  window.addEventListener("rdmountpopupview", (ev) => {
    mountPopupView(ev.detail.message);
  });
  window.addEventListener("rdmountview", (ev) => {
    let force = false;
    let show = true;
    if ("force" in ev.detail) force = ev.detail.force;
    if ("show" in ev.detail) show = ev.detail.show;
    mountView(ev.detail.message, force, show);
  });
  window.addEventListener("rdclosecard", (ev) => {
    closeCard(ev.detail.message);
  });
  window.addEventListener("rdshowpopup", (ev) => {
    showPopup(ev.detail.message);
  });
  window.addEventListener("rdclosepopup", (ev) => {
    closePopup(ev.detail.message);
  });
  window.addEventListener("rdclosesett", (ev) => {
    closeSettingCard();
  });
  Utils.getLinkedinURLProfile();

  // Load token (user or guest). Then load A/B test variants
  let _ = await Session.loadToken();
  if (!window.RD_VARIANTS) {
    await Session.getVariant();
  }

  // Create main FAB + overlays if they don't exist yet
  if (window.RD_VARIANTS && "exp_plugin_button_position" in window.RD_VARIANTS) {
    if (window.RD_VARIANTS["exp_plugin_button_position"].value === "upper") {
      document.body.style.setProperty("--rd-bottom-margin", "55px");
    }
  }
  main_btn = document.querySelector("#rd-fa-btn");
  if (!main_btn) {
    const main_btn_cnt = document.createElement("div");
    main_btn_cnt.classList.add("rd-plugin-btn-cnt");
    main_btn_cnt.innerHTML = mainBtnAsset;
    main_btn = main_btn_cnt.querySelector("#rd-fa-btn");
    const scan_btn = main_btn_cnt.querySelector("#rd-fa-scan-btn");

    if (window.RD_VARIANTS && window.RD_VARIANTS["exp_plugin_button_design"].value == "design-2") {
      main_btn_cnt.classList.add("rd-plugin-btn-cnt-design-2");
      main_btn.classList.add("rd-fa-btn-design-2", "rd-fa-btn-white");
      scan_btn.addEventListener("click", (ev) => {
        const match_banner = document.querySelector("#rd-score-banner");
        match_banner && match_banner.click();
        ev.preventDefault();
        ev.stopPropagation();
      });
    } else {
      main_btn_cnt.classList.add("rd-plugin-btn-cnt-design-1");
      main_btn.classList.add("rd-fa-btn", "rd-fa-btn-design-1");
      scan_btn && scan_btn.remove();
    }
    document.body.appendChild(main_btn_cnt);
  }
  main_btn.setAttribute("style", "display: flex !important");

  // Show loader icon initially
  rdShowLoading();

  // Hover menu container
  hover_menu_ovl = document.createElement("div");
  hover_menu_ovl.id = "rd-hv-overlay";
  hover_menu_ovl.classList.add("rd-hv-overlay");

  hover_menu = document.createElement("div");
  hover_menu.id = "rd-hv";
  hover_menu.classList.add("rd-hv");
  hover_menu.style.setProperty("--dim-hv", "0");

  // If using design-2, load the fancy hover menu; else the classic
  if (window.RD_VARIANTS && window.RD_VARIANTS["exp_plugin_design"].value == "design-2") {
    const hmInnerHTML = await fetch(HOVER_MENU_DESIGN_2);
    hover_menu.innerHTML = await hmInnerHTML.text();
  } else {
    const hmInnerHTML = await fetch(HOVER_MENU);
    hover_menu.innerHTML = await hmInnerHTML.text();
  }
  hover_menu_ovl.appendChild(hover_menu);
  document.body.appendChild(hover_menu_ovl);

  // Popup overlay
  popup_ovl = document.createElement("div");
  popup_ovl.id = "rd-popup-overlay";
  popup_ovl.classList.add("rd-popup-overlay");

  popup = document.createElement("div");
  popup.id = "rd-popup";
  popup.style.setProperty("--dim-popup", "0");

  popup_ovl.appendChild(popup);
  document.body.appendChild(popup_ovl);

  // Initialize any auto-fill menu items
  const rd_auto_fill_menu = document.getElementById("rd-auto-fill-menu");
  if (rd_auto_fill_menu && !window.RD_ACTIVE_APPLY_FORM) {
    rd_auto_fill_menu.style.display = "none";
  } else {
    const rd_save_to_board_menu = document.getElementById("rd-save-to-board");
    const rd_adapt_resume = document.getElementById("rd-adapt-resume");
    const rd_view_board_menu = document.getElementById("rd-view-board");
    if (rd_save_to_board_menu) rd_save_to_board_menu.style.display = "none";
    if (rd_adapt_resume) rd_adapt_resume.style.display = "none";
    if (rd_view_board_menu) rd_view_board_menu.style.display = "none";
  }
  const rd_select_user_menu = document.getElementById("rd-select-user-menu");
  if (rd_select_user_menu && !window.RD_IS_SA_VERSION) {
    rd_select_user_menu.style.display = "none";
  }

  // The main extension card
  card = document.createElement("div");
  card.id = "rd-ovl";
  card.classList.add("rd-ovl");
  card.style.setProperty("--dim-ovl", "0");

  // Load popup + normal card views
  popupViews = await Views.createPopupViews(popup, CURRENT_URL);
  views = await Views.createViews(card, CURRENT_URL, fill);

  // Start the watch function to handle job scanning, etc.
  watch();

  // Attempt to create a session using the loaded token
  await createSession(_.success && _.token, _.isNew);

  // Add storage listeners for changes like user tokens
  chrome.storage.onChanged.addListener(async (changes, namespace) => {
    for (let [key, { oldValue, newValue }] of Object.entries(changes)) {
      if (key == "rd_show_hint" && newValue == "false") {
        closePopup("force");
        window.RD_END_HINT = true;
      }
      if (key == "token") {
        await createSession(newValue, false);
      }
      if (key == "usertype") {
        window.USER_SESSION_TYPE = newValue;
      }
      if (key == "sa_selected_user") {
        // e.g. refresh boards/resumes if user changed
      }
      if (key == "rd_show_notification") {
        if (newValue === "true") {
          Session.addNotification();
        } else {
          Session.removeNotification();
        }
      }
    }
  });

  document.body.appendChild(card);

  // Listen for text selection (to fill certain fields manually)
  window.addEventListener(
    "mouseup",
    () => {
      const excludedElements = document.querySelectorAll("#rd-cnt-job");
      const isExcluded = Array.from(excludedElements).some((excludedElement) => {
        return excludedElement.contains(event.target);
      });
      if (!isExcluded) {
        const content = document.getSelection()?.toString();
        if (!content) return;
        try {
          chrome.storage.local.get(["activeInput"], function (result) {
            var activeInputValue = result.activeInput;
            if (activeInputValue) {
              updateInputSelected(activeInputValue, content);
            } else {
              updateInputSelected(activeInputValue, content);
            }
          });
        } catch (error) {}
      }
    },
    false
  );

  // Hover menu events (bookmark, adapt resume, etc.)
  hover_menu.querySelector("#rd-save-to-board").addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    const bookmark_button = document.querySelector("#rd-bookmark");
    if (bookmark_button) bookmark_button.click();
  });
  const adaptResumeBtn = hover_menu.querySelector("#rd-adapt-resume");
  if (adaptResumeBtn) {
    if (!(await Session.weScan())) adaptResumeBtn.remove();
    else {
      adaptResumeBtn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        const match_button = document.querySelector("#rd-match-btn");
        match_button && match_button.click();
      });
    }
  }
  const autoFillMenu = hover_menu.querySelector("#rd-auto-fill-menu");
  if (autoFillMenu) {
    autoFillMenu.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      Session.mountView("autofill", true);
    });
  }
  const selectUserMenu = hover_menu.querySelector("#rd-select-user-menu");
  if (selectUserMenu) {
    selectUserMenu.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      mountView("select_user", true);
    });
  }
  hover_menu.querySelector("#rd-view-board").addEventListener("click", async (e) => {
    e.preventDefault();
    e.stopPropagation();
    Indicative.trackView("open_board");
    const dashboardUrl = await Session.mkDashboardUrl();
    window.open(dashboardUrl, "_blank");
  });
  hover_menu.querySelector("#rd-view-settings").addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    showCard();
    mountView("settings");
  });

  // Main FAB button click
  main_btn.addEventListener("click", async (ev) => {
    if (window.RD_MOUSE_EV_HANDLER.wasMoving()) {
      return;
    }
    Session.removeNotification(true);
    let property = {
      date: new Date(),
      domain: currentUrl.hostname,
      plugin_click_from: "job_boards",
    };
    Indicative.track(Indicative.pluginButtonClicked, property);

    let match_button = document.querySelector(".rd-hint-match-btn");
    let match_banner = document.querySelector("#rd-score-banner");
    if (match_button) {
      match_button.click();
      return;
    }
    match_button = document.querySelector("#rd-match-btn");
    const doScan = await Session.weScan();

    if (!match_button && doScan && CURRENT_URL.pathname.indexOf("/posts/cohenfab") == -1 && CURRENT_URL.pathname.indexOf("/in/cohenfab") == -1) {
      Utils.redirectionJobsList();
    }
    if (!showOvl && !showPopupOvl) {
      if (doScan) {
        if (match_button) {
          rdShowLoading();
          if (!window.rdIsScaning) match_button.click();
        }
        if (match_banner) {
          if (!window.rdIsScaning) match_banner.click();
        }
      } else {
        mountView("job");
        switchCard();
      }
    } else {
      showOvl && switchCard();
      showPopupOvl && closePopup();
    }
    ev.stopPropagation();
  });

  Session.mkMouseMoveEv(main_btn);

  popup.addEventListener("click", (ev) => {
    ev.stopPropagation();
  });
  popup_ovl.addEventListener("click", (ev) => {
    closePopup();
  });

  main_btn.addEventListener("mouseover", (ev) => {
    showSettingCard();
    ev.stopPropagation();
  });
  hover_menu_ovl.addEventListener("mouseover", (ev) => {
    showSettingCard();
    ev.stopPropagation();
  });
  main_btn.addEventListener("mouseleave", (ev) => {
    closeSettingCard();
    ev.stopPropagation();
  });
  hover_menu_ovl.addEventListener("mouseleave", (ev) => {
    closeSettingCard();
    ev.stopPropagation();
  });

  rdShowLogo();

  if (window.RD_IS_STAGING_VERSION) {
    Session.getLinkedinUrl();
  }
  return;
}
