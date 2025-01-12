/*******************************************************
 * default.js
 *
 * PURPOSE:
 *   - Serves as a fallback auto-fill script for certain
 *     job sites not handled by specialized site-specific
 *     modules.
 *   - Consolidates basic form-filling or job application 
 *     actions for domains in `listRunWithDefault`.
 *******************************************************/

/**
 * default
 * -----------------------------------------------
 * Entry point function. Called when certain conditions
 * (e.g., domain matches or user actions) warrant using
 * a default fill approach rather than a site-specific one.
 *
 * @param {boolean} isSaVersion - Flag indicating 
 *   whether the extension is running in "SA" (Special Agent?)
 *   version mode. Used if you have certain logic that 
 *   only runs when in SA mode.
 */
export async function def(isSaVersion = false) {
    try {
      console.log('[Default Fill] Running default auto-fill logic...');
  
      // Example: Possibly load user data or resume info
      const userData = await chrome.storage.local.get(['rd_selected_resume', 'token']);
      // If you have a “Session” or “ResumeInfo” import, fetch 
      // relevant data here.
  
      // Example: Attempt to find forms or fields to fill
      const forms = document.querySelectorAll('form');
      if (!forms.length) {
        console.log('[Default Fill] No forms detected. Aborting.');
        return;
      }
  
      // For each form, do some basic fill logic
      forms.forEach((form) => {
        // Simple example: if there's an Email field
        const emailField = form.querySelector('input[type="email"]');
        if (emailField) {
          // Optionally fill with user’s email from storage
          emailField.value = userData?.token ? `user@example.com` : '';
          console.log('[Default Fill] Filled email field.');
        }
  
        // Similarly fill phone, name, or other inputs
        const phoneField = form.querySelector('input[type="tel"]');
        if (phoneField) {
          phoneField.value = '+1234567890';
          console.log('[Default Fill] Filled phone field.');
        }
  
        // If we detect a “resume upload” input, etc.
        const fileInput = form.querySelector('input[type="file"]');
        if (fileInput) {
          // Possibly attach a local or blob file if your code 
          // already has logic for it.
          console.log('[Default Fill] Found file input. Skipped attach in default mode.');
        }
  
        // If SA mode triggers unique behavior
        if (isSaVersion) {
          console.log('[Default Fill] Detected SA version - running extra logic...');
          // Additional steps for SA mode
        }
      });
  
      console.log('[Default Fill] Finished default auto-fill steps.');
    } catch (error) {
      console.error('[Default Fill] An error occurred:', error);
    }
  }
  