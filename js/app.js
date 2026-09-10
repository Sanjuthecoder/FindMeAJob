/**
 * @file app.js
 * @description Landing page bootstrap and controller.
 *              Orchestrates: form state management, resume upload/parsing,
 *              skills tag input, location autocomplete, localStorage restore,
 *              platform badge rendering, and form submission.
 * @module app (landing)
 */

'use strict';

// ─── PDF.js worker setup (must be done before any parsing call) ───────────────
if (typeof pdfjsLib !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc =
    'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
}

// ─── Module-level State ───────────────────────────────────────────────────────
/**
 * Tracks the current form state in memory.
 * Synced to localStorage on every meaningful change.
 * @type {Object}
 */
const formState = {
  jobTitle:    '',
  experience:  '',
  workMode:    '',
  jobType:     '',
  location:    '',
  skills:      [],    // string[]
  resumeText:  '',    // raw text extracted from resume
  resumeFile:  null,  // File object (not persisted to localStorage)
};

// ─── DOM Element References ───────────────────────────────────────────────────
// Gathered once at init — never queried inside event handlers (performance best practice)
const EL = {};

function _cacheElements() {
  EL.resumeZone     = DOM.get('#resume-zone');
  EL.resumeInput    = DOM.get('#resume-input');
  EL.resumeFilename = DOM.get('#resume-filename');
  EL.form           = DOM.get('#job-search-form');
  EL.jobTitle       = DOM.get('#input-job-title');
  EL.experience     = DOM.get('#select-experience');
  EL.workMode       = DOM.get('#select-work-mode');
  EL.jobType        = DOM.get('#select-job-type');
  EL.location       = DOM.get('#input-location');
  EL.tagsWrapper    = DOM.get('#tags-wrapper');
  EL.tagInput       = DOM.get('#skills-tag-input');
  EL.skillsAC       = DOM.get('#skills-autocomplete');
  EL.locationAC     = DOM.get('#location-autocomplete');
  EL.submitBtn      = DOM.get('#btn-find-jobs');
  EL.platformsGrid  = DOM.get('.platforms-grid');
  EL.clearDataBtn   = DOM.get('#btn-clear-data');
}

// ─── Select Dropdown Population ───────────────────────────────────────────────

/**
 * Populates a <select> element from a CONFIG options array.
 * DRY: reused for experience, workMode, and jobType selects.
 * @param {HTMLSelectElement} selectEl
 * @param {Array<{value:string, label:string}>} options
 */
function _populateSelect(selectEl, options) {
  options.forEach(({ value, label }) => {
    const opt = DOM.create('option', { value }, label);
    selectEl.appendChild(opt);
  });
}

// ─── Platform Badges (Landing Page) ──────────────────────────────────────────

/**
 * Renders platform name badges in the hero section.
 */
function _renderPlatformBadges() {
  Object.values(CONFIG.PLATFORMS).forEach(({ name, logo }) => {
    const badge = DOM.create('div', { class: 'platform-badge', role: 'listitem' },
      `<span aria-hidden="true">${logo}</span> ${name}`
    );
    EL.platformsGrid.appendChild(badge);
  });
}

// ─── Resume Upload ─────────────────────────────────────────────────────────────

/**
 * Sets up drag-and-drop and click events on the resume upload zone.
 */
function _initResumeUpload() {
  // Click → trigger file input
  EL.resumeZone.addEventListener('click', () => EL.resumeInput.click());
  EL.resumeZone.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); EL.resumeInput.click(); }
  });

  // File selected via dialog
  EL.resumeInput.addEventListener('change', (e) => {
    const file = e.target.files?.[0];
    if (file) _handleResumeFile(file);
  });

  // Drag over — visual feedback
  EL.resumeZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    EL.resumeZone.classList.add('drag-over');
  });
  EL.resumeZone.addEventListener('dragleave', () => {
    EL.resumeZone.classList.remove('drag-over');
  });

  // Drop
  EL.resumeZone.addEventListener('drop', (e) => {
    e.preventDefault();
    EL.resumeZone.classList.remove('drag-over');
    const file = e.dataTransfer?.files?.[0];
    if (file) _handleResumeFile(file);
  });
}

/**
 * Processes an uploaded resume file:
 * 1. Shows uploading state
 * 2. Parses the file via resumeParser
 * 3. Auto-fills form fields from extracted data
 * 4. Updates formState and shows success
 * @param {File} file
 */
async function _handleResumeFile(file) {
  // Validate file before processing
  if (!Validator.isValidFile(file)) {
    showToast('Please upload a PDF or DOCX file.', 'error');
    return;
  }
  if (!Validator.isValidFileSize(file, 5)) {
    showToast('File too large. Max size is 5 MB.', 'error');
    return;
  }

  // Show uploading state
  EL.resumeZone.classList.add('resume-zone--uploading');
  EL.resumeZone.querySelector('.resume-zone__title').textContent = 'Parsing resume…';

  try {
    const parsed = await parseResume(file);

    // Auto-fill form fields from parsed data (only if the field is currently empty)
    // Note: Experience is deliberately left for the user to select manually.
    if (parsed.skills?.length) {
      parsed.skills.forEach((skill) => _addSkillTag(skill));
    }
    if (parsed.jobTitle && !EL.jobTitle.value) {
      EL.jobTitle.value = parsed.jobTitle;
      formState.jobTitle = parsed.jobTitle;
    }
    if (parsed.location && !EL.location.value) {
      EL.location.value = parsed.location;
      formState.location = parsed.location;
    }

    // Store raw text for match scoring later
    formState.resumeText = parsed.rawText || '';
    formState.resumeFile = file;

    // Show success state
    EL.resumeZone.classList.remove('resume-zone--uploading');
    EL.resumeZone.classList.add('success');
    EL.resumeZone.querySelector('.resume-zone__icon').innerHTML = '<i class="fa-solid fa-check-circle"></i>';
    EL.resumeZone.querySelector('.resume-zone__title').innerHTML = '<i class="fa-solid fa-check-circle"></i> Resume uploaded';
    EL.resumeFilename.innerHTML = `<i class="fa-solid fa-file-pdf"></i> ${file.name}`;

    const skillCount = parsed.skills?.length || 0;
    showToast(`Resume parsed! Auto-filled ${skillCount} skills.`, 'success');

  } catch (err) {
    EL.resumeZone.classList.remove('resume-zone--uploading');
    EL.resumeZone.querySelector('.resume-zone__title').textContent = 'Drop your resume here';
    showToast(err.message || 'Could not parse resume. Try a different file.', 'error');
    console.error('[ResumeUpload] Parse error:', err);
  }
}

// ─── Skills Tag Input ─────────────────────────────────────────────────────────

/**
 * Adds a skill tag to the UI and formState.
 * DRY: called by both the tag input handler and the resume auto-fill.
 * @param {string} skill
 */
function _addSkillTag(skill) {
  const normalized = skill.trim();
  if (!normalized) return;

  // Prevent duplicate tags (case-insensitive check)
  const exists = formState.skills.some(
    (s) => StringUtils.normalize(s) === StringUtils.normalize(normalized)
  );
  if (exists) return;

  formState.skills.push(normalized);

  // Create chip element
  const chip = DOM.create('div', { class: 'tag-chip', role: 'listitem' }, `
    <span>${normalized}</span>
    <span class="tag-chip__remove" title="Remove ${normalized}" aria-label="Remove skill ${normalized}">✕</span>
  `);

  // Remove on click
  chip.querySelector('.tag-chip__remove').addEventListener('click', () => {
    formState.skills = formState.skills.filter(
      (s) => StringUtils.normalize(s) !== StringUtils.normalize(normalized)
    );
    chip.remove();
  });

  // Insert before the text input
  EL.tagsWrapper.insertBefore(chip, EL.tagInput);
}

/**
 * Sets up the skills tag input: Enter/comma to add tags, backspace to remove last.
 */
function _initSkillsTagInput() {
  EL.tagInput.addEventListener('keydown', (e) => {
    const val = EL.tagInput.value.trim();

    if ((e.key === 'Enter' || e.key === ',') && val) {
      e.preventDefault();
      _addSkillTag(val.replace(/,$/, '')); // strip trailing comma
      EL.tagInput.value = '';
      _closeAutocomplete(EL.skillsAC);
    }

    // Backspace on empty input → remove last tag
    if (e.key === 'Backspace' && !EL.tagInput.value) {
      const chips = EL.tagsWrapper.querySelectorAll('.tag-chip');
      if (chips.length > 0) {
        const lastChip = chips[chips.length - 1];
        const removed  = formState.skills.pop();
        lastChip.remove();
        if (removed) EL.tagInput.value = removed; // restore to input
      }
    }
  });

  // Click on wrapper → focus input
  EL.tagsWrapper.addEventListener('click', () => EL.tagInput.focus());

  // Autocomplete for skills
  EL.tagInput.addEventListener('input', AsyncUtils.debounce(() => {
    _showAutocomplete(EL.tagInput, EL.skillsAC, CONFIG.SKILL_SUGGESTIONS, _addSkillTag);
  }, 200));
}

// ─── Autocomplete ─────────────────────────────────────────────────────────────

/**
 * Renders an autocomplete dropdown for a text input.
 * DRY: shared by both skills tag input and location input.
 * @param {HTMLInputElement} inputEl
 * @param {HTMLElement}      listEl    - the dropdown container
 * @param {string[]}         suggestions - full list of suggestions
 * @param {Function}         onSelect  - callback(selectedValue)
 */
function _showAutocomplete(inputEl, listEl, suggestions, onSelect) {
  const query = inputEl.value.trim().toLowerCase();
  DOM.empty(listEl);

  if (!query || query.length < 1) {
    listEl.classList.remove('open');
    return;
  }

  const matches = suggestions
    .filter((s) => s.toLowerCase().includes(query))
    .slice(0, 8); // cap at 8 suggestions

  if (!matches.length) {
    listEl.classList.remove('open');
    return;
  }

  matches.forEach((match) => {
    const item = DOM.create('div', {
      class: 'autocomplete-item',
      role:  'option',
      tabindex: '0',
    }, match);

    const selectFn = () => {
      onSelect(match);
      inputEl.value = '';
      _closeAutocomplete(listEl);
    };

    item.addEventListener('click',   selectFn);
    item.addEventListener('keydown', (e) => { if (e.key === 'Enter') selectFn(); });
    listEl.appendChild(item);
  });

  listEl.classList.add('open');
}

/**
 * Closes an autocomplete dropdown.
 * @param {HTMLElement} listEl
 */
function _closeAutocomplete(listEl) {
  listEl.classList.remove('open');
  DOM.empty(listEl);
}

/**
 * Sets up the location field with autocomplete suggestions.
 */
function _initLocationAutocomplete() {
  EL.location.addEventListener('input', AsyncUtils.debounce(() => {
    _showAutocomplete(EL.location, EL.locationAC, CONFIG.LOCATION_SUGGESTIONS, (val) => {
      EL.location.value = val;
      formState.location = val;
      _closeAutocomplete(EL.locationAC);
    });
  }, 200));

  // Close dropdown on outside click
  document.addEventListener('click', (e) => {
    if (!EL.location.contains(e.target)) _closeAutocomplete(EL.locationAC);
    if (!EL.tagsWrapper.contains(e.target)) _closeAutocomplete(EL.skillsAC);
  });
}

// ─── Form Validation ──────────────────────────────────────────────────────────

/**
 * Validates the form and returns an error message or null if valid.
 * @returns {string|null} error message, or null if valid
 */
function _validateForm() {
  const title = EL.jobTitle.value.trim();
  if (Validator.isEmpty(title)) {
    EL.jobTitle.classList.add('form-input--error');
    EL.jobTitle.focus();
    return 'Please enter a job title or role.';
  }
  EL.jobTitle.classList.remove('form-input--error');
  return null;
}

// ─── Form State Sync ──────────────────────────────────────────────────────────

/**
 * Reads all form inputs into formState object and saves to localStorage.
 * Called on submit.
 */
function _syncFormStateAndSave() {
  formState.jobTitle   = EL.jobTitle.value.trim();
  formState.experience = EL.experience.value;
  formState.workMode   = EL.workMode.value;
  formState.jobType    = EL.jobType.value;
  formState.location   = EL.location.value.trim();
  // formState.skills is already maintained by _addSkillTag / tag removal
  saveProfile(formState);
}

// ─── Restore Saved Profile ────────────────────────────────────────────────────

/**
 * Restores a previously saved user profile from localStorage into the form.
 * Called on page load so users don't have to re-fill everything each visit.
 */
function _restoreSavedProfile() {
  const saved = loadProfile();
  if (!saved) return;

  if (saved.jobTitle)   EL.jobTitle.value   = saved.jobTitle;
  if (saved.experience) EL.experience.value = saved.experience;
  if (saved.workMode)   EL.workMode.value   = saved.workMode;
  if (saved.jobType)    EL.jobType.value    = saved.jobType;
  if (saved.location)   EL.location.value   = saved.location;

  // Restore skills tags
  if (Array.isArray(saved.skills)) {
    saved.skills.forEach(_addSkillTag);
  }

  // Copy into in-memory state
  Object.assign(formState, {
    jobTitle:   saved.jobTitle   || '',
    experience: saved.experience || '',
    workMode:   saved.workMode   || '',
    jobType:    saved.jobType    || '',
    location:   saved.location   || '',
    skills:     saved.skills     || [],
    resumeText: saved.resumeText || '',
  });
}

// ─── Clear Data Button ────────────────────────────────────────────────────────

function _initClearDataButton() {
  EL.clearDataBtn?.addEventListener('click', async () => {
    await clearAllData();
    // Reset form
    EL.form?.reset();
    formState.skills = [];
    DOM.getAll('.tag-chip').forEach((c) => c.remove());
    
    // Reset resume zone visually
    if (EL.resumeZone) {
      EL.resumeZone.classList.remove('success', 'resume-zone--uploading');
      const icon = EL.resumeZone.querySelector('.resume-zone__icon');
      const title = EL.resumeZone.querySelector('.resume-zone__title');
      if (icon) icon.innerHTML = '<i class="fa-solid fa-file-pdf"></i>';
      if (title) title.textContent = 'Drop your resume here';
    }
    if (EL.resumeFilename) {
      EL.resumeFilename.classList.add('hidden');
      EL.resumeFilename.innerHTML = '';
    }
    
    showToast('All data cleared. Your privacy is protected! 🔒', 'success');
  });
}

// ─── Form Submission ──────────────────────────────────────────────────────────

/**
 * Handles form submit: validates, saves profile, navigates to results page.
 * @param {Event} e
 */
async function _handleFormSubmit(e) {
  e.preventDefault();

  const error = _validateForm();
  if (error) {
    showToast(error, 'error');
    return;
  }

  _syncFormStateAndSave();

  // Clear previous search results so fresh jobs are fetched for the new search
  try {
    if (typeof clearJobs === 'function') await clearJobs();
    localStorage.removeItem(CONFIG.STORAGE.JOB_RESULTS_KEY);
  } catch (_) {}

  // Navigate to results page — pass nothing in URL (profile is in localStorage)
  window.location.href = 'results.html';
}

// ─── App Initialization ───────────────────────────────────────────────────────

// ─── Mobile Nav (Landing Page) ────────────────────────────────────────────────

/**
 * Wires the hamburger menu open/close for the landing page.
 * Shared with results page via results-app.js._initMobileNav().
 */
function _initLandingMobileNav() {
  const hamburger = DOM.get('#nav-hamburger');
  const overlay   = DOM.get('#mobile-nav-overlay');
  if (!hamburger || !overlay) return;

  hamburger.addEventListener('click', () => {
    const isOpen = overlay.classList.toggle('open');
    hamburger.classList.toggle('open', isOpen);
    hamburger.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    document.body.style.overflow = isOpen ? 'hidden' : '';
  });

  // Close overlay when a link inside it is clicked
  DOM.getAll('a, button', overlay).forEach((el) => {
    el.addEventListener('click', () => {
      overlay.classList.remove('open');
      hamburger.classList.remove('open');
      hamburger.setAttribute('aria-expanded', 'false');
      document.body.style.overflow = '';
    });
  });

  // Wire the mobile "Clear My Data" button to the same handler
  DOM.get('#btn-clear-data-mobile')?.addEventListener('click', async () => {
    await clearAllData();
    DOM.getAll('.tag-chip').forEach((c) => c.remove());
    formState.skills = [];
    EL.form?.reset();
    
    // Reset resume zone visually
    if (EL.resumeZone) {
      EL.resumeZone.classList.remove('success', 'resume-zone--uploading');
      const icon = EL.resumeZone.querySelector('.resume-zone__icon');
      const title = EL.resumeZone.querySelector('.resume-zone__title');
      if (icon) icon.innerHTML = '<i class="fa-solid fa-file-pdf"></i>';
      if (title) title.textContent = 'Drop your resume here';
    }
    if (EL.resumeFilename) {
      EL.resumeFilename.classList.add('hidden');
      EL.resumeFilename.innerHTML = '';
    }
    
    showToast('All data cleared! <i class="fa-solid fa-lock"></i>', 'success');
  });
}

/**
 * Main entry point — called once DOM is ready.
 * Orchestrates all feature module initialization.
 */
function initLandingApp() {
  _cacheElements();

  // Populate select dropdowns from config
  _populateSelect(EL.experience, CONFIG.EXPERIENCE_OPTIONS);
  _populateSelect(EL.workMode,   CONFIG.WORK_MODE_OPTIONS);
  _populateSelect(EL.jobType,    CONFIG.JOB_TYPE_OPTIONS);

  // Render platform badges in hero
  _renderPlatformBadges();

  // Feature inits
  _initResumeUpload();
  _initSkillsTagInput();
  _initLocationAutocomplete();
  _initClearDataButton();
  _initLandingMobileNav();      // Phase 2: mobile hamburger nav

  // Restore saved profile from previous visit
  _restoreSavedProfile();

  // Wire form submit
  EL.form.addEventListener('submit', _handleFormSubmit);

  // Input validation: clear error on typing
  EL.jobTitle.addEventListener('input', () => {
    EL.jobTitle.classList.remove('form-input--error');
  });
}

// ─── Bootstrap ────────────────────────────────────────────────────────────────
// Wait for full DOM parse before initializing
document.addEventListener('DOMContentLoaded', initLandingApp);
