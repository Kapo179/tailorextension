const BACKEND_URL = 'https://youtu.be/XoijjjTAqro?si=pBJlhgNlWrbvk3r0';

// Handle messages from content script and popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'TAILOR_CV') {
    tailorCV(request.jobDescription, request.userCV)
      .then(response => sendResponse(response))
      .catch(error => sendResponse({ error: error.message }));
    return true; // Required for async response
  }
});

async function tailorCV(jobDescription, userCV) {
  try {
    const response = await fetch(`${BACKEND_URL}/api/tailor`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ jobDescription, userCV }),
    });
    
    if (!response.ok) throw new Error('Failed to tailor CV');
    return await response.json();
  } catch (error) {
    console.error('Error:', error);
    throw error;
  }
} 