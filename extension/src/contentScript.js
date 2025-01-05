// Improved job description extraction with site-specific selectors
const SITE_SELECTORS = {
  'linkedin.com': {
    description: '.jobs-description',
    title: '.jobs-unified-top-card__job-title',
    company: '.jobs-unified-top-card__company-name'
  },
  'indeed.com': {
    description: '#jobDescriptionText',
    title: '.jobsearch-JobInfoHeader-title',
    company: '.jobsearch-CompanyInfoContainer'
  },
  'glassdoor.com': {
    description: '.jobDescriptionContent',
    title: '.job-title',
    company: '.employer-name'
  }
};

function getSiteSpecificSelectors() {
  const hostname = window.location.hostname;
  return Object.entries(SITE_SELECTORS).find(([domain]) => 
    hostname.includes(domain)
  )?.[1] || null;
}

function extractJobDetails() {
  const selectors = getSiteSpecificSelectors();
  if (!selectors) {
    return extractGenericJobDetails();
  }

  return {
    description: document.querySelector(selectors.description)?.innerText?.trim(),
    title: document.querySelector(selectors.title)?.innerText?.trim(),
    company: document.querySelector(selectors.company)?.innerText?.trim()
  };
}

function extractGenericJobDetails() {
  // Fallback for unsupported sites
  const mainContent = document.querySelector('main') || document.body;
  return {
    description: mainContent.innerText,
    title: document.title,
    company: ''
  };
}

// Listen for messages from the popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'EXTRACT_JOB_DESCRIPTION') {
    const jobDetails = extractJobDetails();
    sendResponse({ jobDetails });
  }
  return true;
}); 