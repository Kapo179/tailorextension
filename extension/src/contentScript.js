// Function to extract job description from the current page
function extractJobDescription() {
  // TODO: Implement proper job description extraction logic
  // This is a basic example that needs to be customized based on target job sites
  const mainContent = document.querySelector('main') || document.body;
  return mainContent.innerText;
}

// Listen for messages from the popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'EXTRACT_JOB_DESCRIPTION') {
    const jobDescription = extractJobDescription();
    sendResponse({ jobDescription });
  }
}); 