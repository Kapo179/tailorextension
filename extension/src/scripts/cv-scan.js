/*******************************************************
 * cv-scan.js
 *
 * PURPOSE:
 *  - Renders and updates keyword matching lists 
 *    (matched vs. missing skills).
 *  - Creates “Match” or “Optimize” buttons and
 *    “Score banner” elements on job boards.
 *  - Integrates with session, track, and resume-info 
 *    modules for scanning logic and analytics.
 *******************************************************/

const BASE_PLUGIN_URL = chrome.runtime.getURL("/");

const _session = BASE_PLUGIN_URL + "src/scripts/session.js";
const Session = await import(_session);

const _resumeInfo = BASE_PLUGIN_URL + "src/scripts/resume-infos.js";
const ResumeInfo = await import(_resumeInfo);

const indicative = BASE_PLUGIN_URL + "src/scripts/track.js";
const Indicative = await import(indicative);

// Fetch icons and HTML templates
let matchIcon     = await (await fetch(BASE_PLUGIN_URL + "src/assets/match_icon.svg")).text();
let logoIcon      = await (await fetch(BASE_PLUGIN_URL + "src/assets/logo-sm.svg")).text();
let whitelogoIcon = await (await fetch(BASE_PLUGIN_URL + "src/assets/white-logo.svg")).text();
const arrowRight  = await (await fetch(BASE_PLUGIN_URL + "src/assets/arrow_right_white.svg")).text();

let scoreBanner  = await (await fetch(BASE_PLUGIN_URL + "src/component/score-banner.html")).text();
let scoreBanner2 = await (await fetch(BASE_PLUGIN_URL + "src/component/score-banner_design_2.html")).text();

/**
 * updateMatchList
 * -------------------------------------------------------
 * Updates the matched vs. missing keywords list 
 * in the scanning UI, adjusting the progress disk,
 * suggestions, and headings based on `values.match/missing`.
 */
export async function updateMatchList(card, values = { match: [], missing: [], percentage: 0 }, jobTitle) {
  let design = "control";
  if (window.RD_VARIANTS && "exp_plugin_scan_result_design" in window.RD_VARIANTS) {
    design = window.RD_VARIANTS["exp_plugin_scan_result_design"].value;
  }

  // Grab elements (titles, lists, progress disk, etc.)
  const matchTitle = card.querySelector("#rd-match-title");
  const missingTitle = card.querySelector("#rd-missing-title");
  const matchList = card.querySelector("#rd-match-list");
  const missingList = card.querySelector("#rd-missing-list");
  const matchValue = card.querySelector("#rd-match-progress-disk");
  const matchLabel = card.querySelector(".rd-match-label");

  // Progress UI
  matchValue.style.setProperty("--rd-progress-val", `${values.percentage}%`);
  matchValue.style.setProperty("--rd-progress-val-px", `${300 - values.percentage * 3}px`);
  matchLabel.textContent = `${values.percentage}%`;

  // Pre-fetch additional icons
  const _greenCheck     = await fetch(BASE_PLUGIN_URL + "src/assets/check.svg");
  const _checkCircle    = await fetch(BASE_PLUGIN_URL + "src/assets/check_circle_grey.svg");
  const _checkCircleGreen = await fetch(BASE_PLUGIN_URL + "src/assets/check_circle_green.svg");
  const _redClose       = await fetch(BASE_PLUGIN_URL + "src/assets/close.svg");
  const _checkIconSmall = await fetch(BASE_PLUGIN_URL + "src/assets/check_small_green.svg");
  const _redDotSmall    = await fetch(BASE_PLUGIN_URL + "src/assets/dot_small_red.html");
  const _greenDotSmall  = await fetch(BASE_PLUGIN_URL + "src/assets/dot_small_green.html");
  const _plusIcon       = await fetch(BASE_PLUGIN_URL + "src/assets/icon_plus_grey.svg");
  const _minusIcon      = await fetch(BASE_PLUGIN_URL + "src/assets/icon_minus_grey.svg");

  let greenCheck        = await _greenCheck.text();
  let checkCircleGreen  = await _checkCircleGreen.text();
  let checkIconSmall    = await _checkIconSmall.text();
  let redClose          = await _redClose.text();
  let checkCircle       = await _checkCircle.text();
  const redDotSmall     = await _redDotSmall.text();
  const greenDotSmall   = await _greenDotSmall.text();
  const plusIcon        = await _plusIcon.text();
  const minusIcon       = await _minusIcon.text();

  const isRtl = Session.getBidiDir() === "rtl";
  let matchListCount = 0;

  // Normalized strings for advanced counting
  const nResumeStr = normalize(mkResumeStr(window.RD_SELECTED_RESUME_CONTENT));
  const nJdStr = normalize(window.matchedDescription);

  // Populate matched keywords
  if (matchList) {
    matchList.style = `min-height: ${window.rd_prev_match_height || 0}px; max-height: ${window.rd_prev_match_height || 0}px;`;
    matchList.innerHTML = "";
    for (let i = 0; i < values.match.length; i++) {
      const el = document.createElement("div");
      const value = values.match[i];
      const valueEl = document.createElement("span");
      valueEl.innerText = value;
      const kwCountEl = getKwCount(value, design);  // Optionally show occurrence
      if (isRtl) {
        el.className = `rd-match-list-content-${design}-rtl rd-text-content rd-text-13p rd-g500-color`;
        kwCountEl && el.appendChild(kwCountEl);
        el.appendChild(valueEl);
        el.appendChild(getCheckedIcon(design));
      } else {
        el.className = `rd-match-list-content-${design} rd-text-content rd-text-13p rd-g500-color`;
        el.appendChild(getCheckedIcon(design));
        el.appendChild(valueEl);
        kwCountEl && el.appendChild(kwCountEl);
      }
      matchList.appendChild(el);
      matchListCount += 1;
    }
  }
  if (!values.match.length) {
    matchTitle && matchTitle.remove();
    missingTitle && missingTitle.setAttribute("style", "padding-bottom: 4px");
  }

  // Populate missing keywords
  if (missingList) {
    missingList.style = `min-height: ${window.rd_prev_missing_height || 0}px; max-height: ${window.rd_prev_missing_height || 0}px;`;
    missingList.innerHTML = "";
    for (let i = 0; i < values.missing.length; i++) {
      const el = document.createElement("div");
      const value = values.missing[i];
      const valueEl = document.createElement("span");
      valueEl.innerText = value;
      const kwCountEl = getKwCount(value, design);
      if (isRtl) {
        el.className = `rd-match-list-content-${design}-rtl rd-text-content rd-text-13p rd-g500-color`;
        kwCountEl && el.appendChild(kwCountEl);
        el.appendChild(valueEl);
        el.appendChild(getUncheckedIcon(design));
      } else {
        el.className = `rd-match-list-content-${design} rd-text-content rd-text-13p rd-g500-color`;
        el.appendChild(getUncheckedIcon(design));
        el.appendChild(valueEl);
        kwCountEl && el.appendChild(kwCountEl);
      }
      // For new-design-2, we place missing inside matchList
      if (design == "control") {
        missingList.appendChild(el);
      } else {
        matchList.appendChild(el);
        matchListCount += 1;
      }
    }
  }
  if (!values.missing.length) {
    missingTitle && missingTitle.remove();
  }

  // If the total list < 15, expand the accordion (auto)
  const accCta = card.querySelector("div.rd-skills__accordion");
  if (accCta && matchListCount < 15) {
    accCta.classList.remove("rd_skills_hidden");
    accCta.classList.add("rd_skills_show");
    accCta.style = "opacity: 0; pointer-events: none;";
  }

  // Banner and label updates
  const bannerMatch = card.querySelector("#rd-match-hint-text");
  if (bannerMatch) {
    const m = values.match.length;
    const t = values.match.length + values.missing.length;
    bannerMatch.innerHTML = chrome.i18n.getMessage("extResultKwMatch", [`${m}`, `${t}`]);
  }
  const kwMatch = card.querySelector("#rd-result__match-text");
  if (kwMatch) {
    const m = values.match.length;
    const t = values.match.length + values.missing.length;
    const locale = Session.getLocale();
    // Adjust text for new-design-2 in certain locales
    const matchHtml =
      design == "new-design-2" && /(en|fr)/.test(locale)
        ? chrome.i18n.getMessage("suggKwMatch", [`${m}`, `${t}`])
        : chrome.i18n.getMessage("extBannerKwMatch", [`${m}`, `${t}`]);
    kwMatch.innerHTML = matchHtml;
  }

  // Recalculate list heights
  if (matchList) {
    matchList.removeAttribute("style");
    const rect = matchList.getBoundingClientRect();
    window.rd_prev_match_height = rect.height;
  }
  if (missingList) {
    missingList.removeAttribute("style");
    const rect = missingList.getBoundingClientRect();
    window.rd_prev_missing_height = rect.height;
  }

  // Update suggestions (resume improvements, etc.)
  updateSuggestion(card, jobTitle);
  return;

  /**
   * getKwCount
   * ------------------------------------
   * Renders a small “count” element 
   * (like "ResumeOccurrences / JDOccurrences")
   * for new-design-2. Optionally includes 
   * a plus/minus button if your resume count is 0.
   */
  function getKwCount(kW, design) {
    if (design !== "new-design-2") {
      return null;
    }
    // We fetch precomputed “skillCounts” and “jdSkillCounts” from window
    let resumeCountValue = checkRO(kW);
    let JDCountValue = checkJDO(kW);

    const countEl = document.createElement("div");
    const countCnt = document.createElement("div");
    const resumeCountEl = document.createElement("span");
    const countSepEl = document.createElement("span");
    const jdCountEl = document.createElement("span");
    const countAddBtn = document.createElement("button");

    // basic formatting
    resumeCountEl.id = "rd_occ_count";
    resumeCountEl.style = "min-width: 7px;";
    resumeCountEl.setAttribute("data-id", Session.normalizeStr(kW));
    resumeCountEl.setAttribute("status-id", "missing");
    resumeCountEl.setAttribute("data-count", resumeCountValue);
    resumeCountEl.innerText = resumeCountValue;
    countSepEl.innerText = "/";
    jdCountEl.innerText = JDCountValue;

    countCnt.classList.add("rd-g400-color", "rd-text-13p", "rd-text-content");
    countCnt.style = "display: flex; flex-wrap: nowrap; min-width: 20px; font-size: 11px;";
    countCnt.appendChild(resumeCountEl);
    countCnt.appendChild(countSepEl);
    countCnt.appendChild(jdCountEl);
    countEl.appendChild(countCnt);

    // If resume count is 0, we optionally add plus/minus
    if (resumeCountValue == 0) {
      // For demonstration, we create a button but do not attach it
      // to the DOM for production usage, you can uncomment if needed.
      const addLabel = document.createElement("div");
      addLabel.setAttribute("rd-action", "add");
      addLabel.innerHTML = plusIcon;

      const removeLabel = document.createElement("div");
      removeLabel.setAttribute("rd-action", "remove");
      removeLabel.innerHTML = minusIcon;

      countAddBtn.classList.add("rd-keywords__action");
      countAddBtn.style = "display: flex; align-content: center; justify-content: center; align-items: center;";
      countAddBtn.appendChild(addLabel);
      countAddBtn.appendChild(removeLabel);
      countAddBtn.addEventListener("click", (ev) => {
        const countStatus = resumeCountEl.getAttribute("status-id");
        if (countStatus === "missing") {
          resumeCountEl.setAttribute("status-id", "added");
          const kwCount = Number(resumeCountEl.getAttribute("data-count") || 0);
          resumeCountEl.innerText = `${kwCount + 1}`;
        } else if (countStatus === "added") {
          resumeCountEl.setAttribute("status-id", "missing");
          const kwCount = Number(resumeCountEl.getAttribute("data-count") || 0);
          resumeCountEl.innerText = `${kwCount}`;
        }
        ev.preventDefault();
        ev.stopPropagation();
      });
      // countEl.appendChild(countAddBtn);
    }

    countEl.classList.add("rd-g400-color", "rd-text-13p", "rd-text-content");
    countEl.style = "display: flex; flex-wrap: nowrap; font-size: 11px;";
    countEl.setAttribute("data-id", Session.normalizeStr(kW));
    return countEl;

    function checkJDO(kw) {
      // How many times the JD text references kw
      if (window.jdSkillCounts) {
        const filtered = window.jdSkillCounts.filter((el) => el.text == kw);
        if (filtered.length) return filtered[0].value;
      }
      return 1;
    }
    function checkRO(kw) {
      // How many times the resume references kw
      if (window.skillCounts) {
        const filtered = window.skillCounts.filter((el) => el.text == kw);
        if (filtered.length) return filtered[0].value;
      }
      return 0;
    }
  }

  // Helpers to normalize strings and get icons
  function normalize(str) {
    return Session.normalizeStr(str);
  }
  function mkResumeStr(resumeObj) {
    if (!resumeObj) return "";
    return Session.mkResumeStr(resumeObj);
  }
  function getCheckedIcon(design) {
    const el = document.createElement("div");
    let icon = greenCheck;
    switch (design) {
      case "control":
        icon = greenCheck;
        break;
      case "new-design":
        icon = checkCircleGreen;
        break;
      case "new-design-2":
        icon = checkIconSmall;
        break;
    }
    el.innerHTML = icon;
    return el.firstChild;
  }
  function getUncheckedIcon(design) {
    const el = document.createElement("div");
    let icon = redClose;
    switch (design) {
      case "control":
        icon = redClose;
        break;
      case "new-design":
        icon = checkCircle;
        break;
      case "new-design-2":
        icon = redDotSmall;
        break;
    }
    el.innerHTML = icon;
    return el.firstChild;
  }

  /**
   * updateSuggestion
   * -------------------------------------------------
   * Updates “resume suggestions” tips displayed 
   * in the scanning result. E.g. checks for phone, 
   * address, web presence, etc. and sets icons/text.
   */
  async function updateSuggestion(_card, _jobTitle) {
    const resumeInfos = ResumeInfo.getInfo(window.RD_SELECTED_RESUME_CONTENT);
    const suggTabs = _card.querySelectorAll(".rd-scoring__sugg-tabs div[suggestion-tab-item]");
    if (suggTabs) {
      suggTabs.forEach((tab) => {
        tab.addEventListener("click", () => {
          const actives = _card.querySelectorAll(`.rd-scoring__sugg-tabs div[selected="true"]`);
          actives && actives.forEach((el) => el.removeAttribute("selected"));
          tab.setAttribute("selected", "true");
        });
      });
    }

    // Define checks (address, phone, education, etc.)
    // Each has a "check" function returning { valid, positiveCheckMark, negativeCheckMark }
    let checks = {
      address: {
        positiveCheckMark: chrome.i18n.getMessage("suggAddressPos"),
        negativeCheckMark: chrome.i18n.getMessage("suggAddressNeg"),
        check: function () {
          const valid = resumeInfos.Address && resumeInfos.Address.length > 1;
          return {
            valid,
            positiveCheckMark: this.positiveCheckMark,
            negativeCheckMark: this.negativeCheckMark,
          };
        },
      },
      email: {
        positiveCheckMark: chrome.i18n.getMessage("suggEmailPos"),
        negativeCheckMark: chrome.i18n.getMessage("suggEmailNeg"),
        check: function () {
          const pattern = /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[...])|((\w+\.)+\w{2,}))$/;
          const valid = resumeInfos.Email && pattern.test(resumeInfos.Email);
          return { valid, positiveCheckMark: this.positiveCheckMark, negativeCheckMark: this.negativeCheckMark };
        },
      },
      phone: {
        positiveCheckMark: chrome.i18n.getMessage("suggPhonePos"),
        negativeCheckMark: chrome.i18n.getMessage("suggPhoneNeg"),
        check: function () {
          const valid = resumeInfos.Phone && resumeInfos.Phone.length > 1;
          return { valid, positiveCheckMark: this.positiveCheckMark, negativeCheckMark: this.negativeCheckMark };
        },
      },
      education: {
        positiveCheckMark: chrome.i18n.getMessage("suggEducationPos"),
        negativeCheckMark: chrome.i18n.getMessage("suggEducationNeg"),
        check: function () {
          const valid = resumeInfos.Educations && resumeInfos.Educations.length >= 1;
          return { valid, positiveCheckMark: this.positiveCheckMark, negativeCheckMark: this.negativeCheckMark };
        },
      },
      workExperience: {
        positiveCheckMark: chrome.i18n.getMessage("suggWorkExpPos"),
        negativeCheckMark: chrome.i18n.getMessage("suggWorkExpNeg"),
        check: function () {
          const valid = resumeInfos.Experiences && resumeInfos.Experiences.length >= 1;
          return { valid, positiveCheckMark: this.positiveCheckMark, negativeCheckMark: this.negativeCheckMark };
        },
      },
      jobTitle: {
        positiveCheckMark: chrome.i18n.getMessage("suggJobTitlePos"),
        negativeCheckMark: chrome.i18n.getMessage("suggJobTitleNeg"),
        check: function () {
          let valid = false;
          try {
            // Check if resume’s details or experiences match jobTitle
            if (
              window.RD_SELECTED_RESUME_CONTENT?.details?.title &&
              Session.strMatch(
                window.RD_SELECTED_RESUME_CONTENT.details.title.toLowerCase(),
                _jobTitle.toLowerCase()
              )
            ) {
              valid = true;
            } else if (resumeInfos.Experiences && resumeInfos.Experiences.length >= 1) {
              resumeInfos.Experiences.forEach((el) => {
                if (el.title && Session.strMatch(el.title.toLowerCase(), _jobTitle.toLowerCase())) {
                  valid = true;
                }
              });
            }
          } catch (error) {
            console.error(error);
          } finally {
            return {
              valid,
              positiveCheckMark: this.positiveCheckMark.replace("[Job_Title]", `<strong>${_jobTitle}</strong>`),
              negativeCheckMark: this.negativeCheckMark.replace("[Job_Title]", `<strong>${_jobTitle}</strong>`),
            };
          }
        },
      },
      webPresence: {
        positiveCheckMark: chrome.i18n.getMessage("suggResumeWebPos"),
        negativeCheckMark: chrome.i18n.getMessage("suggResumeWebNeg"),
        check: function () {
          const valid =
            resumeInfos.Website ||
            resumeInfos.Linkedin ||
            resumeInfos.GitHub ||
            resumeInfos.Portfolio ||
            resumeInfos.Twitter ||
            resumeInfos.Dribbble ||
            resumeInfos.Behance;
          return { valid, positiveCheckMark: this.positiveCheckMark, negativeCheckMark: this.negativeCheckMark };
        },
      },
      wordCount: {
        positiveCheckMark: chrome.i18n.getMessage("suggResumeWordCountPos"),
        negativeCheckMark: chrome.i18n.getMessage("suggResumeWordCountNeg"),
        check: function () {
          let len = nResumeStr ? nResumeStr.split(" ").length : 0;
          let valid = len < 1000;
          return {
            valid,
            positiveCheckMark: this.positiveCheckMark.replace("[word_count]", `${len}`),
            negativeCheckMark: this.negativeCheckMark,
          };
        },
      },
      // Additional checks for layout, date, font, etc. are set to always valid or placeholders
      layout: {
        positiveCheckMark: `Your resume doesn't contain images`,
        negativeCheckMark: `Your resume doesn't contain images`,
        check: function () {
          return { valid: true, positiveCheckMark: this.positiveCheckMark, negativeCheckMark: this.negativeCheckMark };
        },
      },
      date: {
        positiveCheckMark: `Dates are properly formatted.`,
        negativeCheckMark: `Dates are not properly formatted.`,
        check: function () {
          return { valid: true, positiveCheckMark: this.positiveCheckMark, negativeCheckMark: this.negativeCheckMark };
        },
      },
      font: {
        positiveCheckMark: `
          <div>${greenDotSmall} <p>Minimal bold styling => better readability.</p></div>
          <div>${greenDotSmall} <p>Readable color font.</p></div>
          <div>${greenDotSmall} <p>Not overusing different fonts.</p></div>
          <div>${greenDotSmall} <p>Standard font used.</p></div>
          <div>${greenDotSmall} <p>Font size meets ATS standards.</p></div>
          <div>${greenDotSmall} <p>No overuse of special characters.</p></div>
        `,
        negativeCheckMark: `There is an overuse of fonts.`,
        check: function () {
          return { valid: true, positiveCheckMark: this.positiveCheckMark, negativeCheckMark: this.negativeCheckMark };
        },
      },
      page: {
        positiveCheckMark: `
          <div>${greenDotSmall} <p>No info in footers.</p></div>
          <div>${greenDotSmall} <p>No info in headers.</p></div>
          <div>${greenDotSmall} <p>Margins are consistent.</p></div>
          <div>${greenDotSmall} <p>Standard page size.</p></div>
        `,
        negativeCheckMark: `Possibly overusing fonts or layout changes.`,
        check: function () {
          return { valid: true, positiveCheckMark: this.positiveCheckMark, negativeCheckMark: this.negativeCheckMark };
        },
      },
    };

    // For each check, update the corresponding element in the suggestions UI
    for (const key in checks) {
      try {
        const el = _card.querySelector(`#rd-suggestion__${key}`);
        const markIcon = _card.querySelector(`#rd-suggestion__${key} div.rd-suggestion__icon`);
        const markText = _card.querySelector(`#rd-suggestion__${key} div.rd-suggestion__text`);

        if (el && markIcon && markText) {
          const { valid, positiveCheckMark, negativeCheckMark } = checks[key].check();
          if (valid) {
            markText.innerHTML = /<div>/.test(positiveCheckMark)
              ? positiveCheckMark
              : `<p>${positiveCheckMark}</p>`;
            markIcon.innerHTML = "";
            markIcon.appendChild(getCheckedIcon("new-design-2"));
            el.setAttribute("category-check", "valid");
          }
          if (!valid && negativeCheckMark.length > 10) {
            markText.innerHTML = /<div>/.test(negativeCheckMark)
              ? negativeCheckMark
              : `<p>${negativeCheckMark}</p>`;
            markIcon.innerHTML = "";
            markIcon.appendChild(getUncheckedIcon("new-design-2"));
          } else if (!valid) {
            // If no negative message, remove the element
            el.remove();
          }
        }
      } catch (error) {
        continue;
      }
    }

    // Tally “searchability” vs “recruiter-tips” categories
    const searchabilities = _card.querySelectorAll('[category-id="searchability"][category-check="valid"]');
    const recruiterTips   = _card.querySelectorAll('[category-id="recruiter-tips"][category-check="valid"]');

    if (searchabilities.length == 6) {
      const tab_icon = _card.querySelector("#rd-scoring-icon__searchability");
      tab_icon && tab_icon.classList.add("rd-suggestion__icon_on");
      tab_icon && tab_icon.classList.remove("rd-suggestion__icon_off");
    } else if (searchabilities.length > 0) {
      const tab_icon = _card.querySelector("#rd-scoring-icon__searchability");
      tab_icon && tab_icon.classList.add("rd-suggestion__icon_mid");
      tab_icon && tab_icon.classList.remove("rd-suggestion__icon_off");
    }

    if (recruiterTips.length == 2) {
      const tab_icon = _card.querySelector("#rd-scoring-icon__tips");
      tab_icon && tab_icon.classList.add("rd-suggestion__icon_on");
      tab_icon && tab_icon.classList.remove("rd-suggestion__icon_off");
    } else if (recruiterTips.length > 0) {
      const tab_icon = _card.querySelector("#rd-scoring-icon__tips");
      tab_icon && tab_icon.classList.add("rd-suggestion__icon_mid");
      tab_icon && tab_icon.classList.remove("rd-suggestion__icon_off");
    }
  }
}

/**
 * createMatchBtn
 * -------------------------------------------------------
 * Creates a “Match” or “Optimize” button on job boards,
 * hooking into `analyseResume()` and tracking events.
 */
export async function createMatchBtn(_parent, jobDetail, CURRENT_URL, jobId) {
  let parent = _parent;
  let host = CURRENT_URL.hostname.match(/(\w+)\.(\w+)$/)[0].split(".")[0];
  if (window.location.href.indexOf("/linkedin-search") != -1) {
    host = "linkedin";
    window.LINKEDIN_ACCOUNT = true;
  }
  if (window.location.host.includes("adzuna") && window.location.href.includes("search")) return;
  if (!(await Session.weScan())) return;
  if (!parent) return;

  let variant = window.RD_VARIANTS;
  if (!variant) {
    variant = await Session.getVariant();
  }

  // If the user’s experiment variant is "optimize_button"
  // then we create a match button, else we create a “Score Banner”.
  if (window.RD_VARIANTS["exp_plugin_scoring"].value == "optimize_button") {
    let matchBtn = createMatchBtn(parent, jobId);

    // If a scanning is triggered from the job list...
    const _fromCard = await chrome.storage.local.get(["fromCard"]);
    if ((_fromCard && _fromCard["fromCard"] === "true") || window.fromCard) {
      if (!window.location.host.includes("glassdoor")) {
        window.RD_LIST_SCAN = true;
        window.fromCard = false;
        await chrome.storage.local.set({ fromCard: "false" });
        matchBtn.click();
        Session.mkLoader("#rd-match-btn>svg", true);
        Session.mkLoader(".rd-score-banner__kw-count span");
        Session.mkLoader("#rd-score-banner-score-cnt span#rd-banner__perc");
      }
    }
  } else {
    // Possibly show an “Optimize CTA” on the job detail
    if (window.RD_VARIANTS.exp_plugin_jd_optimise_cta.value === "with_optimise_cta") {
      createOptimiseCta(parent, jobId);
    }
    // Then create the “score banner”
    const new_banner = createScoreBanner(parent, jobId);
    if (!window.rdIsScaning && new_banner) {
      window.rdIsScaning = true;
      let property = { date: new Date(), domain: CURRENT_URL.origin, scan_from: window.RD_LIST_SCAN ? "list" : "detail", ...jobDetail };
      window.RD_VARIANTS.exp_plugin_result_auto_refresh.value === "true" &&
        Indicative.track(Indicative.optimiseResumeCvScan, property);
      Session.mkLoader("#rd-match-btn>svg", true);
      Session.mkLoader(".rd-score-banner__kw-count span");
      Session.mkLoader("#rd-score-banner-score-cnt span#rd-banner__perc");
      Session.analyseResume(
        jobDetail,
        jobId,
        true,
        false,
        window.RD_VARIANTS.exp_plugin_result_auto_refresh.value === "true"
      );
    }
    if (window.rdIsScaning) {
      Session.mkLoader("#rd-match-btn>svg", true);
      Session.mkLoader(".rd-score-banner__kw-count span");
      Session.mkLoader("#rd-score-banner-score-cnt span#rd-banner__perc");
    }
  }

  /**
   * createMatchBtn (inner)
   * ------------------------------------------
   * Actually constructs the button element,
   * sets classes, and binds click => analyseResume.
   */
  function createMatchBtn(parent, jobId) {
    if (document.querySelector(`#rd-match-btn[data-id="${jobId}"]`)) return;
    removeMatchBtn();

    let matchBtn = document.createElement("button");
    matchBtn.type = "button";
    matchBtn.id = "rd-match-btn";
    matchBtn.setAttribute("data-id", jobId);
    const ctaText = variant["exp_plugin_text_scanCTA"].value;

    if (window.RD_VARIANTS["exp_plugin_color_scanCTA"].value == "logo-cta") {
      matchBtn.classList.add(`rd-match-btn-logo-cta`, `rd-match-btn-logo-cta-${host}`);
      if (!window.LINKEDIN_ACCOUNT && host == "linkedin") {
        matchBtn.classList.add(`rd-match-btn-logo-cta-linkedin-disconnected`);
      }
      const reduceFont = ctaText !== chrome.i18n.getMessage("extNameShort");
      window.matchBtnInnerHTML = `${logoIcon} <span style="padding-left: 10px; max-width: 120px${
        reduceFont ? "; font-size: 15px !important" : ""
      }">${ctaText}</span>`;
    } else {
      matchBtn.classList.add("rd-match-btn", `rd-match-btn-${host}`);
      if (!window.LINKEDIN_ACCOUNT && host == "linkedin") {
        matchBtn.classList.add("rd-match-btn-linkedin-disconnected");
      }
      const vValue = variant["exp_plugin_color_scanCTA"].value;
      const vClassName = vValue == "native" ? `${vValue}-${host}` : vValue;
      matchBtn.classList.add(`rd-match-btn-${vClassName}`);
      window.matchBtnInnerHTML = `${matchIcon} <span style="padding-left: 10px; max-width: 165px">${ctaText}</span>`;
    }

    matchBtn.innerHTML = window.matchBtnInnerHTML;
    matchBtn.addEventListener("click", () => {
      if (window.rdIsScaning) return;
      Session.mkLoader("#rd-match-btn>svg", true);
      Session.mkLoader(".rd-score-banner__kw-count span");
      Session.mkLoader("#rd-score-banner-score-cnt span#rd-banner__perc");
      window.rdIsScaning = true;

      let property = { date: new Date(), domain: CURRENT_URL.origin, scan_from: window.RD_LIST_SCAN ? "list" : "detail", ...jobDetail };
      Indicative.track(Indicative.optimiseResumeCvScan, property);
      Session.analyseResume(jobDetail, jobId);
      window.RD_LIST_SCAN = false;
    });

    parent.classList.add(`rd-bookmark-parent-${host}`);
    let property = { date: new Date(), domain: CURRENT_URL.origin };
    Indicative.track(Indicative.renderedCvScan, property);
    Indicative.track(Indicative.viewJob, property);
    return matchBtn;

    function removeMatchBtn() {
      const _matchBtns = document.querySelectorAll("#rd-match-btn");
      _matchBtns.forEach((_matchBtn) => _matchBtn.remove());
    }
  }

  /**
   * createScoreBanner
   * ------------------------------------------
   * Injects a small banner (with a progress disk 
   * and # matched skills) after/before certain DOM elements.
   * Also triggers `analyseResume()` if not in scanning mode.
   */
  function createScoreBanner(parent, jobHash) {
    if (document.querySelector(`#rd-score-banner[data-id="${jobHash}"]`)) return;
    removeScoreBanner();

    let bannerDesign = scoreBanner;
    if (window.RD_VARIANTS && window.RD_VARIANTS["exp_plugin_score_banner_design"].value == "black") {
      bannerDesign = scoreBanner2;
    }
    window.matchBtnInnerHTML = `${whitelogoIcon}`;

    // Adjust insertion logic by domain
    if (host == "naukri" || host == "bebee") {
      parent = _parent.parentElement;
    } else if (host == "shine" || host == "bayt") {
      parent = _parent.parentElement.parentElement;
    } else if (host == "indeed" && !/cmp/.test(window.location.pathname)) {
      parent = _parent.parentElement.parentElement.parentElement;
    } else if (host == "indeed") {
      parent.style = "gap: 2px !important;";
    }

    // Insert banner
    if (host == "bebee") {
      parent.insertAdjacentHTML("beforebegin", bannerDesign);
    } else if (window.location.host.indexOf("glassdoor") > -1) {
      if (window.GLASSDOOR_JD_EL) {
        window.GLASSDOOR_JD_EL.insertAdjacentHTML("beforebegin", bannerDesign);
      } else {
        const bannerElCnt = document.createElement("div");
        bannerElCnt.innerHTML = bannerDesign;
        const bannerEl = bannerElCnt.querySelector("#rd-score-banner");
        parent.appendChild(bannerEl);
      }
    } else {
      parent.insertAdjacentHTML("afterend", bannerDesign);
    }

    const scoreBannerEl = document.getElementById("rd-score-banner");
    scoreBannerEl.setAttribute("data-id", jobHash);
    scoreBannerEl.addEventListener("click", scoreBannerEL);
    host == "bayt" && (scoreBannerEl.style = "margin: 8px 4px !important;");
    host == "indeed" && (scoreBannerEl.style = "margin: 12px !important;");
    return scoreBannerEl;

    function removeScoreBanner() {
      const _scoreBanners = document.querySelectorAll("#rd-score-banner");
      _scoreBanners.forEach((_scoreBanner) => _scoreBanner.remove());
    }
    function scoreBannerEL(ev, retry = 5) {
      Session.log("Banner event fired :", jobHash);
      let pending = window.RD_MATCH_RESULTS && window.RD_MATCH_RESULTS[jobHash] && window.RD_MATCH_RESULTS[jobHash].isPending;

      if (pending) {
        if (retry == 5) {
          Session.mkLoader("#rd-match-btn>svg", true);
          Session.mkLoader(".rd-score-banner__kw-count span");
          Session.mkLoader("#rd-score-banner-score-cnt span#rd-banner__perc");
        }
        setTimeout(() => {
          return retry > 1 && scoreBannerEL(ev, retry - 1);
        }, 500);
      } else {
        Session.analyseResume(jobDetail, jobHash, true);
      }
      let property = { date: new Date(), domain: CURRENT_URL.origin, scan_from: window.RD_LIST_SCAN ? "list" : "detail", ...jobDetail };
      Indicative.track(Indicative.optimiseResumeCvScan, property);
    }
  }

  /**
   * createOptimiseCta
   * ------------------------------------------
   * Adds an “Optimize my CV” CTA for job detail pages,
   * linking to your skill-adder flow.
   */
  function createOptimiseCta(parent, jobHash) {
    if (document.querySelector(`#rd-jd-optimise-btn[data-id="${jobHash}"]`)) return;
    removeOptimseCta();

    let optimiseCta = document.createElement("button");
    optimiseCta.type = "button";
    optimiseCta.setAttribute("data-id", jobHash);
    optimiseCta.id = "rd-jd-optimise-btn";

    if (window.location.host.indexOf("jooble.org") > -1) {
      parent.style = "position: relative !important;";
      optimiseCta.classList.add("rd-match-btn");
    }

    let optimiseCTATextExp = "control";
    if (window.RD_VARIANTS && "exp_plugin_adapt_cta_text" in window.RD_VARIANTS) {
      optimiseCTATextExp = window.RD_VARIANTS["exp_plugin_adapt_cta_text"].value;
    }
    let ctaText =
      optimiseCTATextExp == "control"
        ? chrome.i18n.getMessage("extViewResumeOptimizeCvN2")
        : chrome.i18n.getMessage("extViewResumeOptimizeCvN");

    optimiseCta.classList.add("rd-match-btn", `rd-match-btn-${host}`);
    if (!window.LINKEDIN_ACCOUNT && host == "linkedin") {
      optimiseCta.classList.add("rd-match-btn-linkedin-disconnected");
    }
    const vValue = variant["exp_plugin_color_scanCTA"].value;
    const vClassName = vValue == "native" ? `${vValue}-${host}` : vValue;
    optimiseCta.classList.add(`rd-match-btn-${vClassName}`);
    optimiseCta.innerHTML = `<span style="padding: 0px 5px; max-width: 145px">${ctaText}</span> ${arrowRight}`;

    optimiseCta.addEventListener("click", async () => {
      let property = { date: new Date(), domain: CURRENT_URL.origin };
      if (window.savedPayload) {
        property = { date: new Date(), domain: CURRENT_URL.origin, ...window.savedPayload };
      }
      Indicative.track(Indicative.optimiseResume, property);

      if (optimiseCta.querySelector(".rd-loader")) {
        return;
      }
      let resumeUrl = await Session.mkAddSkillUrl();
      window.skipMountJobView = true;
      resumeUrl && window.open(resumeUrl, "_blank");
    });
    parent.appendChild(optimiseCta);
    return optimiseCta;

    function removeOptimseCta() {
      const _optimiseBtns = document.querySelectorAll("#rd-jd-optimise-btn");
      _optimiseBtns.forEach((_optimiseBtn) => _optimiseBtn.remove());
    }
  }
}

/**
 * createOnbMatchBtn
 * -------------------------------------------------------
 * Creates a “Match” button for a special “Onboarding” 
 * version on LinkedIn, tying into 
 * `analyseResume()` with faked/placeholder logic.
 */
export async function createOnbMatchBtn(parent, jobDetail, CURRENT_URL) {
  let host = "linkedin";
  window.LINKEDIN_ACCOUNT = true;
  const orginalMatchBtn = document.querySelector(".job-list-layout-container__item__current__details--adapt--button");
  if (!parent || !orginalMatchBtn) return;

  let variant = window.RD_VARIANTS;
  if (!variant) variant = await Session.getVariant();

  let _property = { date: new Date(), domain: CURRENT_URL.origin, fakeLinkedin: true };
  Indicative.trackView("scan_hint_popup", _property);

  const _matchBtns = parent.querySelectorAll("#rd-match-btn");
  if (_matchBtns.length) return;

  let matchBtn = orginalMatchBtn;
  matchBtn.type = "button";
  matchBtn.id = "rd-match-btn";
  const ctaText = orginalMatchBtn.innerText;

  matchBtn.classList.add("rd-match-btn", "rd-match-btn-onboarding", `rd-match-btn-${host}`);
  if (!window.LINKEDIN_ACCOUNT && host == "linkedin") {
    matchBtn.classList.add("rd-match-btn-linkedin-disconnected");
  }
  const vValue = variant["exp_plugin_color_scanCTA"].value;
  const vClassName = vValue == "native" ? `${vValue}-${host}` : vValue;
  matchBtn.classList.add(`rd-match-btn-${vClassName}`);
  window.matchBtnInnerHTML = `${matchIcon} <span style="max-width: 165px; font-weight: 400;">${ctaText}</span>`;
  matchBtn.innerHTML = window.matchBtnInnerHTML;

  const onbChoices = document.querySelectorAll(".fauxZK");
  onbChoices.forEach((onbChoice) => {
    onbChoice.addEventListener("click", () => {
      chrome.storage.local.set({ rd_show_onboarding: "false" });
    });
  });

  matchBtn.addEventListener("click", () => {
    chrome.storage.local.set({ rd_show_onboarding: "false", rd_show_hint: "false" });
    if (window.rdIsScaning) return;

    Session.mkLoader("#rd-match-btn>svg", true);
    Session.mkLoader(".rd-score-banner__kw-count span");
    Session.mkLoader("#rd-score-banner-score-cnt span#rd-banner__perc");

    const hintPopups = document.querySelectorAll(".pop-up-hint-backdrop");
    hintPopups.forEach((el) => el.remove());

    window.rdIsScaning = true;
    let property = { date: new Date(), domain: CURRENT_URL.origin, scan_from: window.RD_LIST_SCAN ? "list" : "detail", fakeLinkedin: true, ...jobDetail };
    Indicative.track(Indicative.optimiseResumeCvScan, property);
    Indicative.track(Indicative.hintCtaClick, property);
    Session.analyseResume(jobDetail, jobHash);
    window.RD_LIST_SCAN = false;
  });

  parent.classList.add(`rd-bookmark-parent-${host}`);
  let property = { date: new Date(), domain: CURRENT_URL.origin };
  Indicative.track(Indicative.renderedCvScan, property);
  Indicative.track(Indicative.viewJob, property);
  if (window.rdIsScaning) {
    Session.mkLoader("#rd-match-btn>svg", true);
    Session.mkLoader(".rd-score-banner__kw-count span");
    Session.mkLoader("#rd-score-banner-score-cnt span#rd-banner__perc");
  }
}
