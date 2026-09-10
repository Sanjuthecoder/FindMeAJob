/**
 * @file results-app.js
 * @description Results page controller (Phase 2).
 *              Orchestrates: job fetching, tab switching, filter/sort/pagination,
 *              bookmark management, skill gap analysis, mobile drawer, export.
 * @module results-app
 */

'use strict';

// ─── Page State ───────────────────────────────────────────────────────────────
const resultsState = {
  allJobs:      [],       // Full unfiltered result set
  filteredJobs: [],       // After filters + sort
  profile:      null,     // Loaded from localStorage
  bookmarkedIds:new Set(), // Fast O(1) bookmark lookup
  activeTab:    'all-jobs',
  filters: { platform: 'All', jobType: 'All', minScore: 0 },
  sortBy:       'matchScore',
  currentPage:  1,
  jobsPerPage:  CONFIG.PAGINATION.JOBS_PER_PAGE,
};

// ─── Guard: Redirect if No Profile ───────────────────────────────────────────
function _guardProfile() {
  if (!hasProfile()) {
    showToast('Please fill your profile first!', 'warning');
    setTimeout(() => { window.location.href = 'index.html'; }, 1500);
    return false;
  }
  return true;
}

// ─── Filter + Sort Logic ──────────────────────────────────────────────────────
/**
 * Applies active filters + sort order to allJobs.
 * Writes result to filteredJobs and resets to page 1.
 */
function _applyFiltersAndSort() {
  const { platform, jobType, minScore } = resultsState.filters;
  let jobs = [...resultsState.allJobs];

  if (platform !== 'All') jobs = jobs.filter((j) => j.platform === platform);
  if (jobType  !== 'All') {
    const jtMap = {
      'Full-time':  'full_time',
      'Part-time':  'part_time',
      'Contract':   'contract',
      'Internship': 'internship',
      'Freelance':  'freelance',
    };
    const jtVal = jtMap[jobType];
    if (jtVal === 'internship') {
      jobs = jobs.filter((j) => j.jobType === 'internship' || StringUtils.normalize(`${j.title} ${j.tags.join(' ')}`).includes('intern'));
    } else if (jtVal) {
      jobs = jobs.filter((j) => j.jobType === jtVal);
    }
  }
  if (minScore > 0) jobs = jobs.filter((j) => j.matchScore >= minScore);

  const sortFns = {
    matchScore: (a, b) => b.matchScore - a.matchScore,
    postedAt:   (a, b) => new Date(b.postedAt) - new Date(a.postedAt),
    company:    (a, b) => a.company.localeCompare(b.company),
  };
  jobs.sort(sortFns[resultsState.sortBy] || sortFns.matchScore);

  resultsState.filteredJobs = jobs;
  resultsState.currentPage  = 1;
}

// ─── Pagination Helpers ───────────────────────────────────────────────────────
function _currentPageJobs() {
  const { filteredJobs, currentPage, jobsPerPage } = resultsState;
  return filteredJobs.slice((currentPage - 1) * jobsPerPage, currentPage * jobsPerPage);
}
function _totalPages() {
  return Math.ceil(resultsState.filteredJobs.length / resultsState.jobsPerPage);
}

// ─── Active Filter Count (for FAB badge) ─────────────────────────────────────
function _activeFilterCount() {
  const { platform, jobType, minScore } = resultsState.filters;
  return (platform !== 'All' ? 1 : 0) + (jobType !== 'All' ? 1 : 0) + (minScore > 0 ? 1 : 0);
}

// ─── Full Render Cycle ────────────────────────────────────────────────────────
/**
 * Re-renders the job grid, header counts, and pagination.
 * Called after every filter/sort/page/bookmark change.
 */
function _renderCycle() {
  const pageJobs    = _currentPageJobs();
  const userSkills  = resultsState.profile?.skills || [];

  renderJobsGrid(pageJobs, userSkills, resultsState.bookmarkedIds, _handleBookmarkToggle);
  updateResultsHeader(
    resultsState.allJobs.length,
    resultsState.filteredJobs.length,
    resultsState.profile?.jobTitle
  );
  renderPagination(resultsState.currentPage, _totalPages(), _onPageChange);

  // Update FAB badge
  const badge = DOM.get('.filter-fab__badge');
  const count = _activeFilterCount();
  if (badge) {
    badge.textContent = count;
    badge.style.display = count > 0 ? 'flex' : 'none';
  }

  DOM.get('#jobs-grid')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ─── Bookmark Handler ─────────────────────────────────────────────────────────
/**
 * Toggles a job's bookmark state. Updates state + re-renders saved count.
 * @param {Job} job
 * @returns {Promise<boolean>} true if now bookmarked
 */
async function _handleBookmarkToggle(job) {
  const nowBookmarked = await toggleBookmark(job);
  if (nowBookmarked) {
    resultsState.bookmarkedIds.add(job.id);
    showToast(`Saved: ${StringUtils.truncate(job.title, 35)}`, 'success', 2000);
  } else {
    resultsState.bookmarkedIds.delete(job.id);
    showToast('Removed from saved jobs', 'info', 2000);
  }
  // Update tab badge count
  updateSavedTabCount(resultsState.bookmarkedIds.size);
  // If on saved tab, re-render it
  if (resultsState.activeTab === 'saved-jobs') await _loadSavedTab();
  return nowBookmarked;
}

// ─── Tab Management ───────────────────────────────────────────────────────────
/**
 * Switches to a given tab. Hides all panels, shows the target.
 * @param {string} tabId - 'all-jobs' | 'saved-jobs' | 'skill-gap'
 */
async function _switchTab(tabId) {
  resultsState.activeTab = tabId;

  // Update tab button states
  DOM.getAll('.tab-btn').forEach((btn) => {
    const isActive = btn.dataset.tab === tabId;
    btn.classList.toggle('active', isActive);
    btn.setAttribute('aria-selected', isActive ? 'true' : 'false');
  });

  // Show/hide panels
  DOM.getAll('.tab-panel').forEach((panel) => {
    panel.classList.toggle('active', panel.id === `tab-${tabId}`);
  });

  // Load tab-specific content
  if (tabId === 'saved-jobs') await _loadSavedTab();
  if (tabId === 'skill-gap')  _loadSkillGapTab();
}

/** Loads and renders the saved jobs tab. */
async function _loadSavedTab() {
  const saved      = await getAllBookmarks();
  const userSkills = resultsState.profile?.skills || [];
  renderSavedJobsGrid(saved, userSkills, _handleBookmarkToggle);
  updateSavedTabCount(saved.length);
  resultsState.bookmarkedIds = new Set(saved.map((j) => j.id));
}

/** Loads and renders the skill gap tab. */
function _loadSkillGapTab() {
  const userSkills = resultsState.profile?.skills || [];
  const analysis   = analyzeSkillGap(userSkills, resultsState.allJobs);
  renderSkillGapPanel(analysis);
}

// ─── Filter + Sort Event Handlers ────────────────────────────────────────────
function _onFilterChange() {
  // Read from SIDEBAR chips (canonical state); drawer mirrors these
  const platform = DOM.get('#filter-platforms .filter-chip.active')?.dataset?.filter   || 'All';
  const jobType  = DOM.get('#filter-job-types  .filter-chip.active')?.dataset?.filter  || 'All';
  const minScore = parseInt(DOM.get('#filter-match .filter-chip.active')?.dataset?.minScore || '0', 10);
  resultsState.filters = { platform, jobType, minScore };
  _applyFiltersAndSort();
  _renderCycle();
  // Sync drawer chips to sidebar state (DRY)
  _syncDrawerChipsToSidebar();
}

function _onSortChange(e) {
  resultsState.sortBy = e.target.value;
  _applyFiltersAndSort();
  _renderCycle();
}

function _onPageChange(page) {
  resultsState.currentPage = page;
  _renderCycle();
}

function _onResetFilters() {
  resultsState.filters = { platform: 'All', jobType: 'All', minScore: 0 };
  resultsState.sortBy  = 'matchScore';
  DOM.getAll('.filter-chip').forEach((chip) => {
    const isAll = chip.dataset.filter === 'All' || chip.dataset.minScore === '0';
    chip.classList.toggle('active', isAll);
    chip.setAttribute('aria-checked', isAll ? 'true' : 'false');
  });
  const sortSel = DOM.get('#sort-select');
  if (sortSel) sortSel.value = 'matchScore';
  _applyFiltersAndSort();
  _renderCycle();
}

// ─── Mobile Drawer ────────────────────────────────────────────────────────────
/**
 * Syncs drawer filter chips to match the sidebar state.
 * Called after every filter change so both stay in sync (DRY).
 */
function _syncDrawerChipsToSidebar() {
  const { platform, jobType, minScore } = resultsState.filters;
  // Platform chips in drawer
  DOM.getAll('#drawer-filter-platforms .filter-chip').forEach((chip) => {
    const active = chip.dataset.filter === platform;
    chip.classList.toggle('active', active);
    chip.setAttribute('aria-checked', active ? 'true' : 'false');
  });
  // Job type chips in drawer
  DOM.getAll('#drawer-filter-job-types .filter-chip').forEach((chip) => {
    const active = chip.dataset.filter === jobType;
    chip.classList.toggle('active', active);
    chip.setAttribute('aria-checked', active ? 'true' : 'false');
  });
  // Match score chips in drawer
  DOM.getAll('#drawer-filter-match .filter-chip').forEach((chip) => {
    const active = parseInt(chip.dataset.minScore || '0', 10) === minScore;
    chip.classList.toggle('active', active);
    chip.setAttribute('aria-checked', active ? 'true' : 'false');
  });
}

/**
 * Opens the mobile filter drawer.
 */
function _openDrawer() {
  const drawer  = DOM.get('#filter-drawer');
  const overlay = DOM.get('#drawer-overlay');
  drawer?.classList.add('open');
  overlay?.classList.add('open');
  document.body.style.overflow = 'hidden'; // prevent background scroll
  _syncDrawerChipsToSidebar();
}

/**
 * Closes the mobile filter drawer.
 */
function _closeDrawer() {
  const drawer  = DOM.get('#filter-drawer');
  const overlay = DOM.get('#drawer-overlay');
  drawer?.classList.remove('open');
  overlay?.classList.remove('open');
  document.body.style.overflow = '';
}

/**
 * Wires all drawer interaction events.
 */
function _initDrawer() {
  DOM.on('#drawer-overlay',  'click',  _closeDrawer);
  DOM.on('#drawer-close-btn','click',  _closeDrawer);
  DOM.on('#filter-fab',      'click',  _openDrawer);
  DOM.on('#mobile-filter-btn','click', _openDrawer);

  // Drawer "Apply" button: close and trigger filter
  DOM.on('#drawer-apply', 'click', () => {
    // Read from drawer chips and apply as if sidebar chips were clicked
    const platform = DOM.get('#drawer-filter-platforms .filter-chip.active')?.dataset?.filter || 'All';
    const jobType  = DOM.get('#drawer-filter-job-types  .filter-chip.active')?.dataset?.filter || 'All';
    const minScore = parseInt(DOM.get('#drawer-filter-match .filter-chip.active')?.dataset?.minScore || '0', 10);
    resultsState.filters = { platform, jobType, minScore };
    _applyFiltersAndSort();
    _renderCycle();
    _closeDrawer();
  });

  // Drawer "Reset" button
  DOM.on('#drawer-reset', 'click', () => { _onResetFilters(); _closeDrawer(); });
}

// ─── Mobile Nav Hamburger ─────────────────────────────────────────────────────
function _initMobileNav() {
  const hamburger = DOM.get('#nav-hamburger');
  const overlay   = DOM.get('#mobile-nav-overlay');
  if (!hamburger || !overlay) return;

  hamburger.addEventListener('click', () => {
    const isOpen = overlay.classList.toggle('open');
    hamburger.classList.toggle('open', isOpen);
    hamburger.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    document.body.style.overflow = isOpen ? 'hidden' : '';
  });

  // Close on link click inside overlay
  DOM.getAll('.nav__link', overlay).forEach((link) => {
    link.addEventListener('click', () => {
      overlay.classList.remove('open');
      hamburger.classList.remove('open');
      document.body.style.overflow = '';
    });
  });
}

// ─── Export Wiring ────────────────────────────────────────────────────────────
function _initExportButtons() {
  const jobs    = () => resultsState.filteredJobs;
  const profile = () => resultsState.profile;
  const csvFn   = () => exportToCSV(jobs());
  const pdfFn   = () => exportToPDF(jobs(), profile());

  ['#btn-export-csv', '#btn-export-csv-side', '#mobile-export-csv'].forEach((id) => DOM.on(id, 'click', csvFn));
  ['#btn-export-pdf', '#btn-export-pdf-side', '#mobile-export-pdf'].forEach((id) => DOM.on(id, 'click', pdfFn));
}

// ─── Main Fetch ───────────────────────────────────────────────────────────────
async function _fetchAndRender() {
  showLoading();
  try {
    let jobs;

    // Use cache if fresh (< 24 hours) and matches current query and experience level
    if (areResultsFresh(resultsState.profile?.jobTitle, resultsState.profile?.experience)) {
      jobs = await getAllJobs();
      const hasOutdatedUrls = (jobs || []).some((j) => j.url && j.url.includes('google.com/search'));
      const hasAdzunaJobs   = (jobs || []).some((j) => j.platform === 'Adzuna');
      const adzunaMissing   = CONFIG.APIS.ADZUNA?.ENABLED && !hasAdzunaJobs;

      if (jobs && jobs.length > 0 && !hasOutdatedUrls && !adzunaMissing) {
        showToast('Showing cached results (< 24h old)', 'info', 2000);
      } else {
        jobs = null;
      }
    }

    // Fetch fresh if cache is stale / empty
    if (!jobs || jobs.length === 0) {
      jobs = await searchJobs(resultsState.profile);
      if (jobs.length > 0) {
        await saveJobs(jobs);
        saveResultMeta({
          count: jobs.length,
          query: resultsState.profile.jobTitle,
          experience: resultsState.profile.experience,
        });
      }
    }

    resultsState.allJobs = jobs;
    _applyFiltersAndSort();

    if (jobs.length === 0) { showEmpty(); return; }

    // Load bookmark state for current jobs
    resultsState.bookmarkedIds = await getBookmarkedIds();
    updateSavedTabCount(resultsState.bookmarkedIds.size);

    // Render filter chips into sidebar + drawer
    renderFilterChips(jobs, _onFilterChange, resultsState.filters);
    // Wire sidebar match score chips
    DOM.getAll('#filter-match .filter-chip').forEach((chip) => {
      chip.addEventListener('click', () => {
        DOM.getAll('#filter-match .filter-chip').forEach(c => {
          c.classList.remove('active');
          c.setAttribute('aria-checked', 'false');
        });
        chip.classList.add('active');
        chip.setAttribute('aria-checked', 'true');
        _onFilterChange();
      });
    });

    _renderCycle();
    showToast(`Found ${jobs.length} jobs for you!`, 'success');

  } catch (err) {
    showEmpty();
    console.error('[ResultsApp] Fetch error:', err);
    showToast('Could not fetch jobs. Check your connection.', 'error');
  }
}

// ─── App Initialization ───────────────────────────────────────────────────────
async function initResultsApp() {
  if (!_guardProfile()) return;

  cacheResultsElements();
  resultsState.profile = loadProfile();

  const profile = resultsState.profile;

  // Initialize jobType filter from user profile preferences if set
  const jtLabels = {
    full_time:  'Full-time',
    part_time:  'Part-time',
    internship: 'Internship',
    contract:   'Contract',
    freelance:  'Freelance',
  };
  if (profile?.jobType && jtLabels[profile.jobType]) {
    resultsState.filters.jobType = jtLabels[profile.jobType];
  }

  renderNavContext(profile.jobTitle);
  renderSidebarProfile(profile);
  renderPlatformLinks(buildAllPlatformURLs(profile));

  // Tab buttons
  DOM.getAll('.tab-btn').forEach((btn) => {
    btn.addEventListener('click', () => _switchTab(btn.dataset.tab));
  });

  DOM.on('#sort-select',       'change', _onSortChange);
  DOM.on('#btn-reset-filters', 'click',  _onResetFilters);
  DOM.on('#sidebar-reset',     'click',  _onResetFilters);

  _initDrawer();
  _initMobileNav();
  _initExportButtons();

  await _fetchAndRender();
}

document.addEventListener('DOMContentLoaded', initResultsApp);
