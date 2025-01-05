const BACKEND_URL = 'https://cv-extension-461e802f9c0c.herokuapp.com';

// Handle messages from content script and popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'TAILOR_CV') {
    // Validate input before processing
    if (!validateInput(request.jobDescription, request.userCV)) {
      sendResponse({ error: 'Invalid input data' });
      return true;
    }

    tailorCV(request.jobDescription, request.userCV)
      .then(response => sendResponse(response))
      .catch(error => sendResponse({ error: error.message }));
    return true;
  }
});

function validateInput(jobDescription, userCV) {
  return (
    typeof jobDescription === 'string' &&
    typeof userCV === 'string' &&
    jobDescription.length > 0 &&
    userCV.length > 0 &&
    jobDescription.length < 50000 && // Reasonable size limit
    userCV.length < 50000
  );
}

async function tailorCV(jobDescription, userCV) {
  try {
    const response = await fetch(`${BACKEND_URL}/api/tailor`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Client-Version': chrome.runtime.getManifest().version
      },
      body: JSON.stringify({ 
        jobDescription: sanitizeInput(jobDescription),
        userCV: sanitizeInput(userCV)
      })
    });
    
    if (!response.ok) {
      const error = await response.text();
      throw new Error(error || 'Failed to tailor CV');
    }

    const result = await response.json();
    return {
      ...result,
      feedback: analyzeMatch(result)
    };
  } catch (error) {
    console.error('Error:', error);
    throw error;
  }
}

function sanitizeInput(text) {
  // Basic input sanitization
  return text
    .trim()
    .replace(/[<>]/g, '') // Remove potential HTML tags
    .slice(0, 50000); // Enforce size limit
}

function analyzeMatch(result) {
  const matchedSkills = result.matchedSkills || [];
  const missingSkills = result.missingSkills || [];
  
  return {
    matched: matchedSkills,
    missing: missingSkills,
    score: calculateMatchScore(matchedSkills, missingSkills),
    recommendations: generateRecommendations(matchedSkills, missingSkills)
  };
}

function calculateMatchScore(matched, missing) {
  const total = matched.length + missing.length;
  return total > 0 ? (matched.length / total) * 100 : 0;
}

function generateRecommendations(matched, missing) {
  const recommendations = [];
  
  if (missing.length > 0) {
    recommendations.push({
      type: 'skills_gap',
      message: `Consider adding these skills: ${missing.slice(0, 3).join(', ')}`,
      priority: 'high'
    });
  }

  if (matched.length < 5) {
    recommendations.push({
      type: 'emphasis_needed',
      message: 'Your CV could benefit from emphasizing more relevant skills',
      priority: 'medium'
    });
  }

  return recommendations;
} 