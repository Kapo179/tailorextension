import React, { useState, useEffect } from 'react';

function Popup() {
  const [jobDescription, setJobDescription] = useState('');
  const [tailoredCV, setTailoredCV] = useState('');
  const [loading, setLoading] = useState(false);

  // Example CV - In production, this should come from user input/storage
  const userCV = `
    John Doe
    Software Engineer
    Experience: ...
  `;

  const extractJobDescription = async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const response = await chrome.tabs.sendMessage(tab.id, {
      action: 'EXTRACT_JOB_DESCRIPTION'
    });
    setJobDescription(response.jobDescription);
  };

  const tailorCV = async () => {
    setLoading(true);
    try {
      const response = await chrome.runtime.sendMessage({
        action: 'TAILOR_CV',
        jobDescription,
        userCV
      });
      setTailoredCV(response.tailoredCV);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const downloadCV = () => {
    const blob = new Blob([tailoredCV], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'tailored-cv.txt';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="popup">
      <h1>CV Tailor</h1>
      <button onClick={extractJobDescription}>
        Extract Job Description
      </button>
      {jobDescription && (
        <div>
          <h2>Job Description Preview:</h2>
          <p>{jobDescription.substring(0, 200)}...</p>
          <button onClick={tailorCV} disabled={loading}>
            {loading ? 'Tailoring...' : 'Tailor CV'}
          </button>
        </div>
      )}
      {tailoredCV && (
        <div>
          <h2>Tailored CV:</h2>
          <pre>{tailoredCV}</pre>
          <button onClick={downloadCV}>
            Download CV
          </button>
        </div>
      )}
    </div>
  );
}

export default Popup; 