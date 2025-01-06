import React, { useState, useEffect } from 'react';

function Popup() {
  const [jobDescription, setJobDescription] = useState('');
  const [tailoredCV, setTailoredCV] = useState('');
  const [loading, setLoading] = useState(false);
  const [userCV, setUserCV] = useState('');
  const [cvName, setCvName] = useState('My CV');
  const [savedCVs, setSavedCVs] = useState([]);
  const [showCVInput, setShowCVInput] = useState(false);

  // Load saved CVs on component mount
  useEffect(() => {
    chrome.storage.local.get(['savedCVs'], (result) => {
      if (result.savedCVs) {
        setSavedCVs(result.savedCVs);
        // Load the first CV if available
        if (result.savedCVs.length > 0) {
          setUserCV(result.savedCVs[0].content);
          setCvName(result.savedCVs[0].name);
        }
      }
    });
  }, []);

  const saveCV = async () => {
    if (!userCV.trim()) return;

    const newCV = {
      id: Date.now(),
      name: cvName,
      content: userCV,
      dateModified: new Date().toISOString()
    };

    const updatedCVs = [...savedCVs, newCV];
    setSavedCVs(updatedCVs);
    
    await chrome.storage.local.set({ savedCVs: updatedCVs });
    setShowCVInput(false);
  };

  const selectCV = (cv) => {
    setUserCV(cv.content);
    setCvName(cv.name);
  };

  const deleteCV = async (cvId) => {
    const updatedCVs = savedCVs.filter(cv => cv.id !== cvId);
    setSavedCVs(updatedCVs);
    await chrome.storage.local.set({ savedCVs: updatedCVs });
  };

  const extractJobDescription = async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const response = await chrome.tabs.sendMessage(tab.id, {
      action: 'EXTRACT_JOB_DESCRIPTION'
    });
    setJobDescription(response.jobDescription);
  };

  const tailorCV = async () => {
    if (!userCV) {
      alert('Please add your CV first');
      return;
    }

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
      alert('Failed to tailor CV. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const downloadCV = () => {
    const blob = new Blob([tailoredCV], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tailored-${cvName}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="popup">
      <h1>CV Tailor</h1>
      
      {/* CV Management Section */}
      <div className="cv-management">
        <button onClick={() => setShowCVInput(!showCVInput)}>
          {showCVInput ? 'Cancel' : 'Add New CV'}
        </button>
        
        {showCVInput && (
          <div className="cv-input">
            <input
              type="text"
              value={cvName}
              onChange={(e) => setCvName(e.target.value)}
              placeholder="CV Name"
            />
            <textarea
              value={userCV}
              onChange={(e) => setUserCV(e.target.value)}
              placeholder="Paste your CV content here..."
              rows={5}
            />
            <button onClick={saveCV}>Save CV</button>
          </div>
        )}

        {savedCVs.length > 0 && (
          <div className="saved-cvs">
            <h3>Saved CVs:</h3>
            {savedCVs.map(cv => (
              <div key={cv.id} className="cv-item">
                <span onClick={() => selectCV(cv)}>{cv.name}</span>
                <button onClick={() => deleteCV(cv.id)}>Delete</button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Job Description and Tailoring Section */}
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