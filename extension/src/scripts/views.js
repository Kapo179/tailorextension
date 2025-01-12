/*******************************************************
 * views.js
 *
 * PURPOSE:
 *  - Dynamically loads and manages HTML templates 
 *    (popups, resume previews, onboarding screens, etc.).
 *  - Wires up event handlers for each view (buttons, inputs).
 *  - Coordinates with session.js (e.g., for uploading resumes).
 *******************************************************/

const BASE_PLUGIN_URL = chrome.runtime.getURL('/');

// Dynamic imports (session, track, utils)
const session = BASE_PLUGIN_URL + 'src/scripts/session.js';
const Session = await import(session);

const indicative = BASE_PLUGIN_URL + 'src/scripts/track.js';
const Indicative = await import(indicative);

const utils = BASE_PLUGIN_URL + 'src/scripts/utils.js';
const Utils = await import(utils);

// Fetch and cache SVG icons, HTML templates, etc.
const arrowRight = await (await fetch(BASE_PLUGIN_URL + 'src/assets/arrow_right_white.svg')).text();
const checkIcon = await (await fetch(BASE_PLUGIN_URL + 'src/assets/check.svg')).text();
const checkIconD2 = await (await fetch(BASE_PLUGIN_URL + 'src/assets/check_design_2.html')).text();
const eCheckIconD2 = await (await fetch(BASE_PLUGIN_URL + 'src/assets/empty_check_design_2.html')).text();

// Loader icon from session.js
const loaderIcon = Session.loaderIcon;

// Score banner templates (standard, design 2)
let _scoreBanner = await (await fetch(BASE_PLUGIN_URL + 'src/component/score-banner.html')).text();
let _scoreBanner2 = await (await fetch(BASE_PLUGIN_URL + 'src/component/score-banner_design_2.html')).text();
let scoreBannerTemplate = _scoreBanner;

// Resume preview templates for each style
let ResumeTemplates = {
  budapest:    BASE_PLUGIN_URL + 'src/component/resume-previews/budapest.html',
  chicago:     BASE_PLUGIN_URL + 'src/component/resume-previews/chicago.html',
  perth:       BASE_PLUGIN_URL + 'src/component/resume-previews/perth.html',
  prague:      BASE_PLUGIN_URL + 'src/component/resume-previews/prague.html',
  riga:        BASE_PLUGIN_URL + 'src/component/resume-previews/riga.html',
  rotterdam:   BASE_PLUGIN_URL + 'src/component/resume-previews/rotterdam.html',
  sydney:      BASE_PLUGIN_URL + 'src/component/resume-previews/sydney.html',
};

// Popup templates
let PopupViews = {
  CREATE_UPLOAD_POPUP: BASE_PLUGIN_URL + 'src/component/popup_create_upload.html',
  NO_RESUME_POPUP:     BASE_PLUGIN_URL + 'src/component/popup_no_resume.html',
  NO_RESUME_POPUP_DESING_2:  BASE_PLUGIN_URL + 'src/component/popup_no_resume_new_design.html',
  SELECT_RESUME_POPUP:       BASE_PLUGIN_URL + 'src/component/popup_select_resume.html',
  SELECT_RESUME_POPUP_DESING_2: BASE_PLUGIN_URL + 'src/component/popup_select_resume_new_design.html',
  UPLOAD_RESUME_POPUP:       BASE_PLUGIN_URL + 'src/component/popup_upload_resume.html',
  UPLOAD_RESUME_CTA_POPUP:   BASE_PLUGIN_URL + 'src/component/popup_upload_resume_cta.html',
  UPLOAD_RESUME_CTA_FILE_POPUP: BASE_PLUGIN_URL + 'src/component/popup_upload_resume_cta_file.html',
  APPLY_TEMPLATE_POPUP:      BASE_PLUGIN_URL + 'src/component/popup_apply_template.html',
  SCAN_HINT_POPUP:           BASE_PLUGIN_URL + 'src/component/popup_scan_hint.html',
  ONBOARDING_POPUP:          BASE_PLUGIN_URL + 'src/component/popup_onboarding.html',
  SCAN_HINT_POPUP_FANCY:     BASE_PLUGIN_URL + 'src/component/popup_scan_hint_fancy.html',
  SCAN_HINT_POPUP_FANCY_B:   BASE_PLUGIN_URL + 'src/component/popup_scan_hint_fancy_banner.html',
};

// Adjust for RTL if needed
if (Session.getBidiDir() == 'rtl') {
  PopupViews.SCAN_HINT_POPUP_FANCY  = BASE_PLUGIN_URL + 'src/component/popup_scan_hint_fancy_rtl.html';
  PopupViews.SCAN_HINT_POPUP_FANCY_B = BASE_PLUGIN_URL + 'src/component/popup_scan_hint_fancy_banner_rtl.html';
}

// Standard card views
let Views = {
  WELCOME:          BASE_PLUGIN_URL + 'src/component/welcome.html',
  JOB_VIEW:         BASE_PLUGIN_URL + 'src/component/job.html',
  SCAN_VIEW:        BASE_PLUGIN_URL + 'src/component/scan.html',
  SCAN_VIEW_NEW_DESIGN:  BASE_PLUGIN_URL + 'src/component/scan_new_design.html',
  SCAN_VIEW_NEW_DESIGN_2:BASE_PLUGIN_URL + 'src/component/scan_new_design_2.html',
  ADD_RESUME_VIEW:  BASE_PLUGIN_URL + 'src/component/no_resume.html',
  BOARDSELECT:      BASE_PLUGIN_URL + 'src/component/boardselect.html',
  SETTINGS:         BASE_PLUGIN_URL + 'src/component/settings.html',
  SELECT_USER:      BASE_PLUGIN_URL + 'src/component/select_user.html',
  EDITOR:           BASE_PLUGIN_URL + 'src/component/editor.html',
  LOGIN:            BASE_PLUGIN_URL + 'src/component/login.html',
  SAVED_VIEW:       BASE_PLUGIN_URL + 'src/component/saved.html',
  AUTO_FILL:        BASE_PLUGIN_URL + 'src/component/autofill.html',
  AUTO_FILL_DESING_2:BASE_PLUGIN_URL + 'src/component/autofill_design_2.html',
  TIPS:             BASE_PLUGIN_URL + 'src/component/tips.html',
};

// Allowed file extensions
const allowedUploadExt = ['pdf','dot','doc','text','txt','shtml','html','ehtml','shtm','docx','odt','rtf'];

/**
 * createResumePreviews
 * ---------------------------------------
 * Renders small “preview” skeletons of each resume 
 * in a user’s list, handling events for selecting resumes.
 */
function createResumePreviews() {
  const resumeListParent = document.querySelector('#rd-select-resume-content');
  if (!resumeListParent) return;

  let resumeDesignVariant = 'control';
  if (window.RD_VARIANTS && window.RD_VARIANTS.exp_resume_popup_design) {
    resumeDesignVariant = window.RD_VARIANTS.exp_resume_popup_design.value;
  }

  // Retrieve user’s resumes from global window object
  const resumeList = window.RD_RESUMES;
  if (!resumeList || !resumeList.length) {
    mountPopupView('no_resume');
    return;
  }

  // Loop and create each preview
  for (let i = 0; i < resumeList.length; i++) {
    const resume = resumeList[i];
    const resumeCtn = document.createElement('div');
    resumeCtn.classList.add('rd-resume-prev-ctn');

    const resumePreview = document.createElement('div');
    resumePreview.classList.add(
      resumeDesignVariant == 'control' ? 'rd-resume-prev' : 'rd-resume-prev-design-2'
    );

    const resumeTitleEl = document.createElement('div');
    resumeTitleEl.classList.add(
      resumeDesignVariant == 'control' ? 'rd--resume-title' : 'rd--resume-title-design-2'
    );

    const resumeId = resume.resumeId || '';
    let resumeName = `<span>${resume.name}</span>` || `<span>Untitled</span>`;
    let resumeTemplate = resume.settings.template || 'budapest';

    if (!(resumeTemplate in ResumeTemplates)) {
      resumeTemplate = 'sydney';
    }

    // Insert name, handle avatar, skeleton sections, etc.
    resumeTitleEl.innerHTML = resumeName;
    resumePreview.innerHTML = ResumeTemplates[resumeTemplate];
    setName(resumePreview, `${resume.details.firstName}${
      (resumeTemplate == 'budapest' || resumeTemplate == 'perth') ? '<br/>' : ' '
    }${resume.details.lastName}`);
    setPic(resumePreview, resume.details.userPic);

    const leftCol = resumePreview.querySelector('#rd--prev-left-col');
    const rightCol = resumePreview.querySelector('#rd--prev-right-col');
    const sections = parseSections(resume);

    // Build left column
    for (let n = 0; n < sections.left.length; n++) {
      const item = sections.left[n];
      if (item.type == 'skills') {
        addSkillSection(leftCol, item.title, item.count, false, resumeTemplate == 'budapest');
      } else {
        let t = '';
        for (let c = 0; c < item.count; c++) {
          t += ' div full full full quarter';
        }
        addTextSection(leftCol, item.title, t, resumeTemplate == 'budapest');
      }
    }
    // Build right column
    for (let n = 0; n < sections.right.length; n++) {
      const item = sections.right[n];
      if (item.type == 'skills') {
        addSkillSection(rightCol, item.title, item.count, true, false);
      } else {
        let t = '';
        for (let c = 0; c < item.count; c++) {
          t += ' div full full full quarter';
        }
        addTextSection(rightCol, item.title, t, false);
      }
    }

    // Click -> select resume
    resumePreview.addEventListener('click', () => {
      window.RD_SELECTED_RESUME = resumeId;
      window.RD_HAD_SELECTED_RESUME = true;
      chrome.storage.local.set({ rd_selected_resume: window.RD_SELECTED_RESUME });
      closePopup();
    });

    // Show checkmark if this resume is currently selected
    if (window.RD_SELECTED_RESUME === resumeId) {
      const checkEl = document.createElement('div');
      checkEl.classList.add(
        resumeDesignVariant == 'control' ? 'rd-checked-resume-icon' : 'rd-checked-resume-icon-design-2'
      );
      checkEl.innerHTML = resumeDesignVariant == 'control' ? checkIcon : checkIconD2;
      resumeCtn.appendChild(checkEl);
    } else if (resumeDesignVariant == 'design-2') {
      // “Empty” check icon for unselected in design 2
      const checkEl = document.createElement('div');
      checkEl.classList.add('rd-checked-resume-icon-design-2');
      checkEl.innerHTML = eCheckIconD2;
      resumeCtn.appendChild(checkEl);
    }

    if (resumeDesignVariant == 'control') {
      resumeCtn.appendChild(resumeTitleEl);
      resumeCtn.appendChild(resumePreview);
    } else {
      resumeCtn.appendChild(resumePreview);
      resumeCtn.appendChild(resumeTitleEl);
    }
    resumeListParent.appendChild(resumeCtn);
  }

  // Helper: parse the resume’s blocks for left/right columns
  function parseSections(resume) {
    const res = { left: [], right: [] };
    if (!('blocks' in resume)) return res;
    resume.blocks.forEach((block) => {
      let type = (block.type == 'LANGUAGES' || block.type == 'SKILLS') ? 'skills' : 'text';
      const el = {
        type:   type,
        title:  block.title || '',
        count:  block.items?.length ? block.items.length : 1,
        order:  block.position.length && block.position[1],
      };
      if (block.position[0] == 0) {
        res.left.push(el);
      } else {
        res.right.push(el);
      }
    });
    res.left.sort((a, b) => a.order - b.order);
    res.right.sort((a, b) => a.order - b.order);
    return res;
  }

  function setPic(parent, url) {
    const avatar = parent.querySelector('#rd--resume-preview-avatar');
    if (!url && avatar) {
      avatar.remove();
    }
  }
  function setName(parent, name) {
    const nameEl = parent.querySelector('#rd--prev-user-name');
    nameEl.innerHTML = name;
  }

  // Adds dummy text skeleton
  function addTextSection(parent, title, template = 'full full full quarter', dark = false) {
    const titleEl = document.createElement('div');
    titleEl.classList.add('rd--prev-section-title');
    titleEl.innerText = title;
    parent.appendChild(titleEl);

    const _t = template.trim().split(' ');
    for (let i = 0; i < _t.length; i++) {
      const elType = _t[i];
      const el = document.createElement('div');
      if (elType === 'div') {
        el.classList.add('rd--prev-divider');
      } else {
        dark ? el.classList.add('rd--prev-skeleton-dark') : el.classList.add('rd--prev-skeleton');
        el.classList.add(`rd--prev--${elType}-width`);
      }
      parent.appendChild(el);
    }
    const dividerEl = document.createElement('div');
    dividerEl.classList.add('rd--prev-divider-lg');
    parent.appendChild(dividerEl);
  }

  // Adds dummy skill rows
  function addSkillSection(parent, title, count = 5, double = false, dark = false) {
    const titleEl = document.createElement('div');
    titleEl.classList.add('rd--prev-section-title');
    titleEl.innerText = title;
    parent.appendChild(titleEl);

    if (double) {
      const row = document.createElement('div');
      row.classList.add('rd--prev-row');
      const leftCol = document.createElement('div');
      const rightCol = document.createElement('div');
      leftCol.classList.add('rd--prev-col');
      rightCol.classList.add('rd--prev-col');
      for (let i = 0; i < count; i++) {
        const el = document.createElement('div');
        dark ? el.classList.add('rd--prev-skeleton-dark') : el.classList.add('rd--prev-skeleton');
        el.classList.add('rd--prev--full-width');
        i % 2 == 0 ? leftCol.appendChild(el) : rightCol.appendChild(el);
      }
      row.appendChild(leftCol);
      row.appendChild(rightCol);
      parent.appendChild(row);
    } else {
      for (let i = 0; i < count; i++) {
        const el = document.createElement('div');
        dark ? el.classList.add('rd--prev-skeleton-dark') : el.classList.add('rd--prev-skeleton');
        el.classList.add('rd--prev--full-width');
        parent.appendChild(el);
      }
    }

    const dividerEl = document.createElement('div');
    dividerEl.classList.add('rd--prev-divider-lg');
    parent.appendChild(dividerEl);
  }
}

/**
 * loadView
 * ---------------------------------------
 * Generic helper: fetch a template (HTML) from a URL
 * and return {key, template}.
 */
async function loadView(obj, key) {
  let _innerHTML = await fetch(obj[key]);
  let _template = await _innerHTML.text();
  return { key: key, template: _template };
}

/**
 * createPopupViews
 * ---------------------------------------
 * Dynamically loads all popup templates, 
 * then returns an object mapping view IDs to 
 * their HTML + event handlers (“actions”).
 */
export async function createPopupViews(popup, CURRENT_URL) {
  // Pre-load resume preview HTML
  const _templates = [];
  for (const key in ResumeTemplates) {
    _templates.push(loadView(ResumeTemplates, key));
  }
  const resumePreviews = await Promise.all(_templates);
  resumePreviews.forEach((el) => {
    ResumeTemplates[el.key] = el.template;
  });

  // Pre-load all popup HTML
  const _popups = [];
  for (const key in PopupViews) {
    _popups.push(loadView(PopupViews, key));
  }
  const _popupTemplates = await Promise.all(_popups);
  _popupTemplates.forEach((el) => {
    PopupViews[el.key] = el.template;
  });

  // Prepare an object of views, each containing:
  //   - template
  //   - optional "mods" function to do DOM manip
  //   - "actions" array binding event callbacks
  let views = {};

  // Example: create_upload popup
  views['create_upload'] = {
    props: {},
    template: PopupViews['CREATE_UPLOAD_POPUP'],
    actions: [
      // ... button event definitions ...
      // e.g. skipping, uploading resume, creating resume, etc.
    ],
  };

  // Example: no_resume popup
  let resumeDesignVariant = 'control';
  if (window.RD_VARIANTS && window.RD_VARIANTS.exp_resume_popup_design) {
    resumeDesignVariant = window.RD_VARIANTS.exp_resume_popup_design.value;
  }
  views['no_resume'] = {
    props: { width: 500 },
    template:
      resumeDesignVariant == 'design-2'
        ? PopupViews['NO_RESUME_POPUP_DESING_2']
        : PopupViews['NO_RESUME_POPUP'],
    mods: async function() {
      window.RD_PREVENT_POPUP_CLOSE = false;
    },
    actions: [
      // ... e.g. #rd-close-popup => closePopup('force'), etc.
    ],
  };

  // Example: select_resume popup
  views['select_resume'] = {
    props: {},
    template:
      resumeDesignVariant == 'design-2'
        ? PopupViews['SELECT_RESUME_POPUP_DESING_2']
        : PopupViews['SELECT_RESUME_POPUP'],
    mods: async function() {
      window.RD_PREVENT_POPUP_CLOSE = false;
      createResumePreviews();
    },
    actions: [
      // ... e.g. #rd-close-popup => closePopup('force'), etc.
    ],
  };

  // Similar definitions for other popups...
  // (upload_resume, apply_template, scan_hint, etc.)

  // Return the entire object
  return views;
}

/**
 * createViews
 * ---------------------------------------
 * Dynamically loads main card/page views, 
 * returns an object mapping each named view 
 * to its HTML + event actions.
 */
export async function createViews(card, CURRENT_URL, fill = null) {
  // Fetch all standard card templates
  const _views = [];
  for (const key in Views) {
    _views.push(loadView(Views, key));
  }
  const _viewTemplates = await Promise.all(_views);
  _viewTemplates.forEach((el) => {
    Views[el.key] = el.template;
  });

  let views = {};

  // Example: login view
  views['login'] = {
    props: { width: 350 },
    template: Views['LOGIN'],
    actions: [
      {
        id: '#rd-login-btn',
        type: 'click',
        callback: (e) => {
          e.preventDefault();
          Session.removeMessage('#rd-login-message-slot', '#rd-login-message');
          Session.login();
        },
      },
      // ...
    ],
  };

  // Example: welcome view
  views['welcome'] = {
    props: { width: 0 },
    template: Views['WELCOME'],
    mods: async function() {
      // e.g., track usage, hide after 2s
      chrome.storage.local.set({ rd_show_welcome: 'false' });
      setTimeout(() => {
        closeCard(false);
      }, 2000);
    },
    actions: [
      // ...
    ],
  };

  // Example: autofill view
  views['autofill'] = {
    props: { width: 320 },
    template:
      window.RD_VARIANTS && window.RD_VARIANTS['exp_plugin_design'].value == 'design-2'
        ? Views['AUTO_FILL_DESING_2']
        : Views['AUTO_FILL'],
    mods: async function () {
      // e.g. retrieve resume list, populate <select> ...
    },
    actions: [
      // ...
    ],
  };

  // Example: job view
  let w = await Session.weScan();
  views['job'] = {
    props: {
      width: w ? 0 : 300,
      'max-height': w ? 0 : 'unset',
    },
    template: Views['JOB_VIEW'],
    actions: [
      // ...
    ],
  };

  // Example: scan view
  let scanCTA = 'control';
  if (window.RD_VARIANTS && 'exp_plugin_scan_result_design' in window.RD_VARIANTS) {
    scanCTA = window.RD_VARIANTS['exp_plugin_scan_result_design'].value;
  }
  views['scan'] = {
    props: { width: scanCTA == 'control' ? 300 : scanCTA == 'new-design' ? 375 : 420 },
    template:
      scanCTA == 'control'
        ? Views['SCAN_VIEW']
        : scanCTA == 'new-design'
          ? Views['SCAN_VIEW_NEW_DESIGN']
          : Views['SCAN_VIEW_NEW_DESIGN_2'],
    mods: async function () {
      // e.g., set up skills accordion...
    },
    actions: [
      // ...
    ],
  };

  // Example: no_resume card
  views['no_resume'] = {
    props: { width: 300 },
    template: Views['ADD_RESUME_VIEW'],
    actions: [
      // ...
    ],
  };

  // Example: boardselect, settings, tips, select_user, etc.
  // ...
  
  // Helpers for board list updates
  async function mkBoardLists() {
    const { success } = await Session.loadToken();
    if (!success) {
      mountView('login');
      return;
    }
    const SELECTED_BOARD = await Session.checkSelectedBoard();
    if (!SELECTED_BOARD) {
      // e.g., show message "Create a board on the main site"
    } else {
      // e.g., populate <select> with boards
    }
  }

  // Return all compiled views
  return views;
}

/**
 * mountView
 * ---------------------------------------
 * Dispatches a custom event used by the rest 
 * of the extension to switch the main card’s content.
 */
export function mountView(view, forceMount = false) {
  const event = new CustomEvent('rdmountview', {
    detail: { message: view, force: forceMount },
  });
  window.dispatchEvent(event);
}

/**
 * mountPopupView
 * ---------------------------------------
 * Dispatches a custom event to switch 
 * popup content (upload resumes, etc.)
 */
export function mountPopupView(view) {
  const event = new CustomEvent('rdmountpopupview', {
    detail: { message: view },
  });
  window.dispatchEvent(event);
}

/**
 * closeCard, showPopup, closePopup, closeSettingCard
 * ---------------------------------------
 * Additional event dispatchers for 
 * controlling UI states and overlays.
 */
export function closeCard(showSettingCard = true) {
  const event = new CustomEvent('rdclosecard', {
    detail: { message: showSettingCard },
  });
  window.dispatchEvent(event);
}

export function showPopup(payload) {
  const event = new CustomEvent('rdshowpopup', {
    detail: { message: payload },
  });
  window.dispatchEvent(event);
}

export function closePopup(payload) {
  const event = new CustomEvent('rdclosepopup', {
    detail: { message: payload },
  });
  window.dispatchEvent(event);
}

export function closeSettingCard() {
  const event = new CustomEvent('rdclosesett', {
    detail: { message: closeSettingCard },
  });
  window.dispatchEvent(event);
}
