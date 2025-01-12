/*******************************************************
 * auto-fill.js
 *
 * PURPOSE:
 *   - Collects/filters forms on a page, preparing them 
 *     for AI-based autofill.
 *   - Dynamically identifies fields, attaches IDs, 
 *     and builds a cleaned HTML string for each form.
 *   - Handles site-specific tweaks (like simulating button 
 *     clicks on Workable or Paylocity to reveal extra fields).
 *******************************************************/

/**
 * getForms
 * -----------------------------------------------
 * Main entry point. Finds or initializes forms that 
 * could be auto-filled, returning an array of form objects 
 * (each with a `form` HTML string and `fieldCount`).
 */
export async function getForms() {
    let formObjs = [];
    // fixBySite often returns a specialized form or modifies the DOM
    const _Form = await fixBySite();
  
    // If we found a special form for, say, "jobs.abbott"
    if (_Form) {
      if (_Form === 'jobs.abbott') {
        // Special case: Abbott job site
        let input = document.querySelector('div.resume-upload-wrapper input');
        input.setAttribute('id', 'resume-file');
        const jobsAbbottForm = `
          <form id="resume-gpt-form">
            <input type="file" id="resume-file" aria-label="resume pdf">
          </form>`;
        return [{ form: jobsAbbottForm, fieldCount: 1 }];
      }
  
      // Otherwise, standard approach:
      const { formElement, formId } = initGptForm(_Form);
      const formObj = {};
      formObj[formId] = { formType: 'resume-gpt-form', fields: [] };
  
      // Collect relevant fields
      const fieldElements = _Form.querySelectorAll('input, textarea, select, radio, select');
      fieldElements.forEach((field, index) => {
        const fieldType = field.nodeName.toLowerCase();
        let label = null;
  
        // Decide how to get 'label' for this field
        if (fieldType === 'input' || fieldType === 'textarea' || fieldType === 'checkbox') {
          label =
            field.getAttribute('placeholder') ||
            field.getAttribute('aria-label') ||
            field.getAttribute('autocomplete') ||
            field.getAttribute('name') ||
            field.getAttribute('data-test') ||
            '';
          // If it's a file input with no label, use parent text
          if (fieldType === 'input' && field.getAttribute('type') == 'file' && !label) {
            const parentInnerText = field.parentElement.innerText.trim();
            if (parentInnerText.length > 3) label = parentInnerText;
          }
        } else if (fieldType === 'select') {
          label = field.getAttribute('aria-label') || '';
        }
  
        // Only build an <input> in the new form if we have a decent label
        if (label && label.trim().length > 3) {
          let fieldId = field.getAttribute('id');
          // Fix if ID references “remote/url”
          if (
            fieldId &&
            fieldType === 'input' &&
            field.getAttribute('type') == 'file' &&
            /remote|url/.test(fieldId)
          ) {
            fieldId = fieldId.replace(/remote|url/g, '');
            field.setAttribute('id', fieldId);
          }
          // If no ID, create one
          if (!fieldId) {
            fieldId = `${formId}-input-${index}`;
            field.setAttribute('id', fieldId);
          }
          let inputElement = document.createElement(fieldType);
          inputElement.setAttribute('id', fieldId);
          inputElement.setAttribute('label', label.trim());
          inputElement.setAttribute('type', field.getAttribute('type'));
          if (field.getAttribute('name')) {
            inputElement.setAttribute('name', field.getAttribute('name'));
          }
          // If it’s a cover letter field, store in a global var
          if (label === 'hiring-manager-message-text') {
            window.COVER_SELECTOR = '#' + fieldId;
          }
          formElement.appendChild(inputElement);
        }
      });
  
      // Next, find all <label> elements & pair them with inputs
      const labelElements = _Form.querySelectorAll('label');
      let index = 0;
      if (labelElements.length > 0) {
        for (const labelElement of labelElements) {
          const divParent = labelElement.parentElement;
          if (!divParent) continue;
          const inputElements = divParent.querySelectorAll('input, select, textarea');
          inputElements.forEach((inputElement) => {
            const fieldType = inputElement.nodeName.toLowerCase();
            const labelText = labelElement?.innerText.trim();
            const inputId = inputElement.getAttribute('id') || 'rd-labeled';
  
            const newInputElement = document.createElement(fieldType);
            if (inputId) newInputElement.setAttribute('id', `${inputId}`);
            else newInputElement.setAttribute('id', `${inputId}-input-${index}`);
            newInputElement.setAttribute('label', labelText);
            newInputElement.setAttribute('type', inputElement.getAttribute('type'));
  
            formElement.appendChild(newInputElement);
            index++;
          });
          index++;
        }
      }
  
      // Clean up HTML + measure fieldCount
      let { cleanForm, fieldCount } = cleanHtml(formElement.outerHTML);
      if (fieldCount >= 4) {
        formObjs.push({ form: cleanForm, fieldCount: fieldCount });
      }
  
    } else {
      // If fixBySite returned null => gather forms from DOM
      const filteredForms = [];
      let allForms = document.querySelectorAll(`
        form:not(#formabe), 
        form:not(#rd-cnt-job-form),
        div[data-automation-id='contactInformationPage'],
        div[data-automation-id='myExperiencePage'], 
        div.bubble-element,
        div.p-gridlayout
      `);
  
      // Filter out login or search forms
      allForms.forEach(async (form) => {
        const formText = form.innerText.toLowerCase();
        const containsSignInOrLogin =
          formText.includes('sign-in') || formText.includes('login') || formText.includes('sign in');
        const searchElements = form.querySelectorAll('button, input, textarea');
        const containsSearchElement = Array.from(searchElements).some((element) => {
          const elementType = element.nodeName.toLowerCase();
          if (elementType === 'button') {
            return (
              element.getAttribute('aria-label')?.toLowerCase().includes('rechercher') ||
              element.innerText.toLowerCase().includes('search')
            );
          } else if (elementType === 'input') {
            return (
              element.getAttribute('aria-label')?.toLowerCase().includes('search') ||
              element.getAttribute('placeholder')?.toLowerCase().includes('search')
            );
          } else if (elementType === 'textarea') {
            return element.getAttribute('aria-label')?.toLowerCase().includes('search');
          }
          return false;
        });
        if (!containsSignInOrLogin && !containsSearchElement) {
          filteredForms.push(form);
        }
      });
  
      let formHandler = {};
      const forms = filteredForms;
  
      // For each form in the filtered array
      for (let i = 0; i < forms.length; i++) {
        let form = forms[i];
        const { formElement, formId } = initGptForm(form, i);
        formHandler[formId] = {}; 
  
        // Attempt to add fields to the new form
        for (let n = 0; n < form.length; n++) {
          const field = form[n];
          if (field.getAttribute('type') === 'hidden' || field.getAttribute('type') === 'password') continue;
          if (field.nodeName == 'INPUT' || field.nodeName == 'TEXTAREA' || field.nodeName == 'SELECT') {
            let fieldId = field.getAttribute('id');
            let label = getFieldLabel(field, field.getAttribute('type'));
            if (!label || label.length <= 3) continue;
  
            const type = field.getAttribute('type') || 'text';
            if (!fieldId) {
              fieldId = `${formId}-input-${n}`;
              field.setAttribute('id', fieldId);
            }
            if (fieldId.includes('undefined')) continue;
  
            let inputObj = document.createElement(field.nodeName);
            inputObj.setAttribute('id', fieldId);
            inputObj.setAttribute('name', field.getAttribute('name'));
  
            const placeholder = field.getAttribute('placeholder');
            if (placeholder) inputObj.setAttribute('placeholder', placeholder);
  
            // Distinguish between input vs. select vs. radio
            if (field.nodeName == 'INPUT' || field.nodeName == 'TEXTAREA') {
              inputObj.setAttribute('type', type);
              inputObj.setAttribute('aria-label', label);
              formHandler[formId][fieldId] = { label: label, type: type, formType: 'input' };
              if (field.nodeName == 'INPUT' && field.getAttribute('type') == 'radio') {
                // Additional logic if radio
                let fieldId = field.getAttribute('id');
                if (fieldId.includes('undefined')) continue;
                let radioLabel = getFieldLabel(field, field.getAttribute('type'));
                if (!radioLabel || radioLabel.length <= 3) continue;
                if (!fieldId) {
                  fieldId = `${formId}-input-${n}`;
                  field.setAttribute('id', fieldId);
                }
                if (fieldId.includes('undefined')) continue;
                let inputObj = document.createElement('input');
                setObj(inputObj, fieldId, field, radioLabel);
                formHandler[formId][fieldId] = { label: radioLabel, type: 'radio', formType: 'radio' };
              }
              if (field.nodeName == 'TEXTAREA') {
                const ariaLabel = field.getAttribute('aria-label');
                if (
                  (ariaLabel && ariaLabel.toLowerCase().includes('cover letter')) ||
                  (placeholder && placeholder.toLowerCase().includes('cover letter'))
                ) {
                  window.COVER_SELECTOR = '#' + fieldId;
                }
              }
  
            } else if (field.nodeName == 'SELECT') {
              // Build <select> with all <option> entries
              inputObj.setAttribute('aria-label', label);
              const options = field.querySelectorAll('option');
              options.forEach((option) => {
                const optionValue = option.getAttribute('value');
                const optionText = option.innerText.trim();
                let optionElem = document.createElement('option');
                optionElem.setAttribute('value', optionValue);
                optionElem.innerText = optionText;
                inputObj.appendChild(optionElem);
              });
              formHandler[formId][fieldId] = { label: label, type: 'select', formType: 'select' };
            }
            formElement.appendChild(inputObj);
  
          } else if (field.nodeName === 'FIELDSET') {
            // Additional handling for <fieldset>
            let fieldsetId = field.getAttribute('id');
            if (!fieldsetId) {
              fieldsetId = `${formId}-fieldset-${n}`;
              field.setAttribute('id', fieldsetId);
            }
            if (fieldsetId.includes('undefined')) continue;
            let fieldsetObj = document.createElement('fieldset');
            fieldsetObj.setAttribute('id', fieldsetId);
  
            const legend = field.querySelector('legend');
            if (legend) {
              const legendText = legend.innerText.trim();
              fieldsetObj.innerHTML = `<legend>${legendText}</legend>`;
            }
            // Process children of the fieldset
            const fieldsetChildren = field.children;
            for (let m = 0; m < fieldsetChildren.length; m++) {
              const fieldsetChild = fieldsetChildren[m];
              if (
                fieldsetChild.getAttribute('type') === 'hidden' ||
                fieldsetChild.getAttribute('type') === 'password'
              ) continue;
  
              const childNodeName = fieldsetChild.nodeName.toUpperCase();
              if (childNodeName === 'INPUT') {
                // etc. (similar logic)
              } else if (childNodeName === 'SELECT') {
                // etc.
              }
            }
            formElement.appendChild(fieldsetObj);
  
          } else if (field.nodeName == 'INPUT' && field.getAttribute('type') == 'radio') {
            // Additional radio logic
            let fieldId = field.getAttribute('id');
            if (fieldId.includes('undefined')) continue;
            let label = getFieldLabel(field, field.getAttribute('type'));
            if (!label || label.length <= 3) continue;
            if (!fieldId) {
              fieldId = `${formId}-input-${n}`;
              field.setAttribute('id', fieldId);
            }
            if (fieldId.includes('undefined')) continue;
  
            let inputObj = document.createElement('input');
            setObj(inputObj, fieldId, field, label);
            formHandler[formId][fieldId] = { label: label, type: 'radio', formType: 'radio' };
            formElement.appendChild(inputObj);
          }
        }
        // Clean and store if enough fields
        let { cleanForm, fieldCount } = cleanHtml(formElement.outerHTML);
        if (fieldCount >= 4) {
          formObjs.push({ form: cleanForm, fieldCount: fieldCount });
        }
      }
    }
  
    return formObjs;
  
    /**
     * initGptForm
     * -----------------------------------------------
     * Helper: ensures the target form has an ID, then 
     * creates a new <form> element to store the discovered fields.
     */
    function initGptForm(_Form, i = 0) {
      let formId = _Form.getAttribute('id');
      if (!formId) {
        formId = `form-${i}`;
        _Form.setAttribute('id', formId);
      }
      const formElement = document.createElement('form');
      formElement.setAttribute('id', formId);
  
      // Some job boards use “dz-hidden-input” or “file-upload-input”
      // for resume uploads. We replicate it here with a clearer label.
      if (document.querySelector('input.file-upload-input')) {
        document.querySelector('input.file-upload-input')?.setAttribute('aria-label', 'resume file pdf');
      }
      if (document.querySelector('input[type="file"].dz-hidden-input')) {
        const resumeInput = document.querySelector('input[type="file"].dz-hidden-input');
        let resumeInputId = resumeInput.getAttribute('id');
        if (/remote|url/.test(resumeInputId)) {
          resumeInputId = resumeInputId.replace(/remote|url/g, '');
        }
        resumeInputId || resumeInput.setAttribute('id', (resumeInputId = 'resume-file'));
        resumeInput.setAttribute('rd-field-added', 'true');
  
        const newInputElement = document.createElement('input');
        newInputElement.setAttribute('type', 'file');
        newInputElement.setAttribute('aria-label', 'resume file pdf');
        newInputElement.setAttribute('id', resumeInputId);
        formElement.appendChild(newInputElement);
      }
      return { formElement, formId };
    }
  }
  
  /**
   * setObj
   * -----------------------------------------------
   * Utility for setting attributes on newly created
   * input/radio elements (ID, type, label).
   */
  export function setObj(fieldObj, fieldId, field, label) {
    fieldObj.id = fieldId;
    fieldObj.type = field.getAttribute('type');
    fieldObj.value = field.getAttribute('value');
    fieldObj.setAttribute('aria-label', label);
    return fieldObj;
  }
  
  /**
   * getFieldLabel
   * -----------------------------------------------
   * Attempts to find a “label” for an input by looking 
   * at labels, placeholders, aria-labels, or parent text.
   */
  function getFieldLabel(field, fieldType) {
    const fieldLabels = field.labels;
    let label = fieldLabels.length ? fieldLabels[0].innerText.trim() : null;
    if (!label) label = field.getAttribute('aria-label');
    if (!label) label = field.getAttribute('placeholder');
    if (!label) label = field.getAttribute('autocomplete');
    if (!label) label = field.getAttribute('data-test');
    if (!label) label = field.getAttribute('name');
    if (fieldType === 'file' || fieldType === 'radio' || fieldType === 'checkbox' || fieldType === 'textarea') {
      if (!label) label = '';
      const parentInnerText = field.parentElement.innerText.trim();
      if (parentInnerText.length > 3) label = label + ' ' + parentInnerText;
    }
    return label;
  }
  
  /**
   * cleanHtml
   * -----------------------------------------------
   * Removes empty <legend>/<fieldset>, counts how many 
   * direct child nodes in <form>, returning cleaned HTML 
   * plus the field count.
   */
  export function cleanHtml(html) {
    const tempElement = document.createElement('div');
    let fieldCount = 0;
    tempElement.innerHTML = html;
  
    // Remove empty legends
    const legends = tempElement.querySelectorAll('legend');
    legends.forEach((legend) => {
      legend.remove();
    });
    // Remove unused or empty fieldsets
    const fieldsets = tempElement.querySelectorAll('fieldset');
    fieldsets.forEach((fieldset) => {
      if (!fieldset.hasChildNodes() || (fieldset.children.length === 1 && !fieldset.children[0].textContent.trim())) {
        fieldset.remove();
      }
    });
    // Identify actual form
    const form = tempElement.querySelector('form');
    if (!form || !form.hasChildNodes()) {
      form?.remove();
    } else {
      fieldCount = form.childNodes.length;
    }
    return { cleanForm: tempElement.innerHTML, fieldCount: fieldCount };
  }
  
  /**
   * clickButton
   * -----------------------------------------------
   * Sometimes we simulate clicks to reveal hidden 
   * sections in a form (like Workable “Add Experience”).
   */
  async function clickButton(selector, times) {
    if (times == 'x') {
      const button = document.querySelectorAll(selector);
      let xtimes = button?.length;
      if (button) {
        for (let i = 0; i < xtimes; i++) {
          button[i].click();
        }
      }
    } else {
      const button = document.querySelector(selector);
      if (button) {
        for (let i = 0; i < times; i++) {
          button.click();
        }
      }
    }
  }
  
  /**
   * fixBySite
   * -----------------------------------------------
   * Applies site-specific logic (Workable, Paylocity, etc.) 
   * to unhide or load forms. Returns either a special form 
   * or null if not found.
   */
  async function fixBySite() {
    let applyForm = null;
    try {
      let educLength = 2;
      let expLength = 2;
  
      // If we have a resume with certain blocks, 
      // use the block item count
      if (window && window.RD_SELECTED_RESUME_CONTENT) {
        const resumeContent = window.RD_SELECTED_RESUME_CONTENT;
        const blocks = resumeContent['blocks'];
        if (blocks) {
          educLength = blocks[1]['items'].length;
          expLength = blocks[0]['items'].length;
        }
      }
  
      // Site-specific behavior:
      if (window.location.host.indexOf('jobaffinity.fr') > 0) {
        const autoCompleteInput = document.getElementById('form_cv');
        if (autoCompleteInput) autoCompleteInput.setAttribute('aria-label', 'resume.pdf');
      } else if (window.location.host.indexOf('workable.com') > 0) {
        await clickButton("button[data-ui='cancel-section']", 'x');
        await clickButton("button[aria-label='Add Experience']", expLength);
        await clickButton("button[aria-label='Add Education']", educLength);
      } else if (window.location.host.indexOf('metacareers.com') > 0) {
        applyForm = document.querySelector('#careersContentContainer');
      } else if (window.location.host.indexOf('jobs.abbott') > 0) {
        applyForm = 'jobs.abbott';
      } else if (window.location.host.indexOf('paycomonline.net') > 0) {
        applyForm = document.querySelector('#quickApplyDesktop');
      } else if (window.location.host.indexOf('csod.com') > 0) {
        applyForm = document.querySelector('.p-view-applicationworkflowtemplate');
      } else if (window.location.host.indexOf('monday.com') > 0) {
        applyForm = document.querySelector('#surveyModeScrollElement');
      } else if (window.location.host.indexOf('adp.com') > 0) {
        applyForm = document.querySelector('.recruitment-style-container');
      } else if (window.location.host.indexOf('paylocity.com') > 0) {
        await clickButton("button[data-automation-id='btnAddWorkHistory']", 2);
        await clickButton("button[data-automation-id='btnAddEducationHistory']", 2);
        applyForm = document.querySelector('#appDetailDiv');
      } else if (window.location.host.indexOf('eightfold.ai') > 0) {
        applyForm =
          document.querySelector('#apply-form-main-content') ||
          document.querySelector('div#EFSmartApplyContainer div div.apply-form');
      } else if (window.location.host.indexOf('careers-page.com') > 0) {
        applyForm = document.querySelector('form');
      } else if (window.location.host.indexOf('wink-lab.com') > 0) {
        applyForm = document.querySelector('#sticky-top');
      } else if (window.location.host.indexOf('clickup.com') > 0) {
        applyForm = document.querySelector('div.cu-form__body');
      } else if (window.location.host.indexOf('comeet.co') > 0) {
        applyForm = document.querySelector('form#applyForm');
      } else if (window.location.href.indexOf('ashbyhq.com/wander') > 0) {
        applyForm = document.querySelector('div.ashby-application-form-container');
      } else if (window.location.href.indexOf('apply.airrecruit.ai/') > 0) {
        applyForm = document.querySelector('div._form_1mtk8_11');
      } else if (
        window.location.host.indexOf('enterprisedb.com') > 0 ||
        window.location.host.includes('vestmark.com') ||
        window.location.host.includes('consensys.io') ||
        window.location.host.includes('grin.co') ||
        window.location.host.includes('grayling.com')
      ) {
        // Some of these embed greenhouse iframes
        applyForm = fixIframe('#grnhse_iframe');
      }
    } catch (error) {
      // console.log(error);
    } finally {
      return applyForm;
    }
  }
  
  /**
   * fixIframe
   * -----------------------------------------------
   * If we find an embedded iframe for the job form
   * (like Greenhouse), we can redirect to the iframe’s src.
   */
  function fixIframe(selector) {
    const iframe = document.querySelector(selector);
    if (iframe) window.location.href = iframe.src;
    return null;
  }
  