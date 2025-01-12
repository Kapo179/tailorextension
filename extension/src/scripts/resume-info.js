/*******************************************************
 * resume-info.js
 *
 * PURPOSE:
 *   Extracts key information (name, phone, email,
 *   social links, etc.) from a given resume object.
 * 
 * EXAMPLE USAGE:
 *   import { getInfo } from './resume-info.js';
 *   const resumeData = getInfo(someResumeObject);
 *******************************************************/

/**
 * getInfo
 * -----------------------------------------------
 * Takes a `resume` object (likely the structure
 * from your backend) and returns a simplified
 * info object with details, experiences, etc.
 */
export function getInfo(resume) {
    // Basic fields from 'resume'
    const details   = resume['details'];
    const socBlock  = resume['blocks'].find((block) => block.type === 'SOCIAL_LINKS');
    const expBlock  = resume['blocks'].find((block) => block.type === 'EMPLOYMENT');
    const educBlock = resume['blocks'].find((block) => block.type === 'EDUCATION');
    const skilBlock = resume['blocks'].find((block) => block.type === 'SKILLS');
    const proSummary = resume['blocks'].find((block) => block.type === 'PROFESSIONAL_SUMMARY');
  
    // Items extracted from each block
    const experiences = expBlock?.items;
    const socials     = socBlock?.items;
    const educations  = educBlock?.items;
    const skills      = skilBlock?.items;
    const proSummarys = proSummary?.items;
  
    /**
     * getSocialLink
     * ------------------------------------------------
     * Looks for a social link labeled `network`
     * in the 'SOCIAL_LINKS' block, returns its URL.
     */
    function getSocialLink(network = 'Linkedin') {
      if (!socials) return '';
      for (const item of socials) {
        if (
          item &&
          'fields' in item &&
          'label' in item.fields &&
          item.fields.label === network
        ) {
          return item.fields.url;
        }
      }
      return '';
    }
  
    /**
     * getFields
     * ------------------------------------------------
     * Helper for turning each item’s `.fields` 
     * into an array of field objects.
     */
    function getFields(items) {
      if (items) {
        return items.map((item) => item.fields);
      }
      return null;
    }
  
    /**
     * getTotal
     * ------------------------------------------------
     * Calculates total years of experience by summing
     * date ranges across each experience entry.
     */
    function getTotal(items) {
      let totalYears = 0;
      if (!items || !items.length) {
        return 0;
      }
      items.forEach((item) => {
        const { startDate, endDate } = item.fields;
        let duration = 0;
  
        if (endDate) {
          const start = new Date(startDate);
          const end   = new Date(endDate);
          duration    = (end - start) / (1000 * 60 * 60 * 24 * 365.25);
        } else {
          // If no end date, consider it "current"
          const start = new Date(startDate);
          const now   = new Date();
          duration    = (now - start) / (1000 * 60 * 60 * 24 * 365.25);
        }
        totalYears += duration;
      });
      return parseInt(totalYears);
    }
  
    /**
     * stripAndExtractCountryCode
     * ------------------------------------------------
     * Splits a phone string into (countryCode, strippedPhone).
     * If no match is found, returns empty strings.
     */
    function stripAndExtractCountryCode(phone) {
      if (!phone) {
        return { strippedPhone: null, countryCode: null };
      }
      const countryCodeRegex = /^\+(\d{1,3})/;
      const match = phone.match(countryCodeRegex);
      const code  = match ? match[1] : '';
      // Remove all non-digit characters
      const stripped = phone.replace(/\D/g, '');
      return { strippedPhone: stripped, countryCode: code };
    }
  
    // Extract phone details
    const { strippedPhone, countryCode } = stripAndExtractCountryCode(details?.phone);
  
    // Return consolidated info
    return {
      // Basic personal info
      FullName:       `${details?.firstName ?? ''} ${details?.lastName ?? ''}`,
      FirstName:      details?.firstName,
      PreferedName:   details?.firstName,
      LastName:       details?.lastName,
      Phone:          details?.phone,
      Email:          details?.email,
      EmailConfirm:   details?.email,
  
      // Location
      City:           details?.city ?? '',
      State:          details?.country ?? '',
      Country:        details?.country ?? '',
      Citizen:        details?.country ?? '',
      Location:       `${details?.city ?? ''} ${details?.country ?? ''}`,
      Residence:      `${details?.city ?? ''} ${details?.country ?? ''}`,
      Address:        `${details?.city ?? ''} ${details?.country ?? ''}`,
      CurrentLocation:`${details?.city ?? ''} ${details?.country ?? ''}`,
  
      // Phone details
      PhoneStripped:  strippedPhone,
      PhoneNationCode:countryCode,
  
      // Socials
      Website:   getSocialLink('Website'),
      Linkedin:  getSocialLink('Linkedin'),
      GitHub:    getSocialLink('Github'),
      Portfolio: getSocialLink('Portfolio'),
      Twitter:   getSocialLink('Twitter'),
      Dribbble:  getSocialLink('Dribbble'),
      Behance:   getSocialLink('Behance'),
  
      // Resume blocks
      Experiences:     getFields(experiences),
      Educations:      getFields(educations),
      Company:         (experiences && experiences[0]?.fields?.employer) || '',
      CurrentCompany:  (experiences && experiences[0]?.fields?.employer) || '',
      HighestEducation:(educations && educations[0]?.fields?.degree) || '',
      ProSummary:      (proSummarys && proSummarys[0]?.fields?.description) || '',
      TotalExp:        getTotal(experiences),
      Skills:          getFields(skills),
  
      // Hardcoded placeholders (adjust if needed)
      PostalCode:        '1001',
      Gender:            'Male',
      Age:               21,
      CountryCode:       'IN',
      DisabilityLever:   'No, I do not have a disability and have not had one in the past',
      VeteranLever:      'I am not a Protected Veteran',
      Referrer:          'Resumedone',
    };
  }
  