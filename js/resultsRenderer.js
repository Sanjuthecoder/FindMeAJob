/**
 * @file resultsRenderer.js
 * @description Pure DOM rendering for the results page.
 *              Handles: job cards (with bookmark buttons), platform links,
 *              filter chips, pagination, tabs, saved jobs grid, skill gap panel.
 *              Zero data-fetching or business logic — only rendering.
 * @module resultsRenderer
 */

'use strict';

// ─── DOM Element Cache ────────────────────────────────────────────────────────
const RESULTS_EL = {};

const JOB_TYPE_LABELS = {
  full_time:  'Full-time',
  part_time:  'Part-time',
  internship: 'Internship',
  contract:   'Contract',
  freelance:  'Freelance',
};

/**
 * Caches all results page DOM elements.
 * Called once at app startup — avoids repeated querySelector calls.
 */
function cacheResultsElements() {
  RESULTS_EL.jobsGrid         = DOM.get('#jobs-grid');
  RESULTS_EL.savedGrid        = DOM.get('#saved-jobs-grid');
  RESULTS_EL.loadingState     = DOM.get('#loading-state');
  RESULTS_EL.emptyState       = DOM.get('#empty-state');
  RESULTS_EL.pagination       = DOM.get('#pagination');
  RESULTS_EL.countText        = DOM.get('#results-count-text');
  RESULTS_EL.subtitle         = DOM.get('#results-subtitle');
  RESULTS_EL.sortSelect       = DOM.get('#sort-select');
  RESULTS_EL.platformGrid     = DOM.get('#platform-links-grid');
  RESULTS_EL.navTitle         = DOM.get('#nav-job-title');
  RESULTS_EL.navContext       = DOM.get('#nav-search-context');
  RESULTS_EL.filterPlatforms  = DOM.get('#filter-platforms');
  RESULTS_EL.filterJobTypes   = DOM.get('#filter-job-types');
  RESULTS_EL.filterMatch      = DOM.get('#filter-match');
  RESULTS_EL.sidebarTitle     = DOM.get('#sidebar-profile-title');
  RESULTS_EL.sidebarExp       = DOM.get('#sidebar-detail-exp');
  RESULTS_EL.sidebarLoc       = DOM.get('#sidebar-detail-loc');
  RESULTS_EL.sidebarMode      = DOM.get('#sidebar-detail-mode');
  RESULTS_EL.tabAllCount      = DOM.get('#tab-all-count');
  RESULTS_EL.tabSavedCount    = DOM.get('#tab-saved-count');
  RESULTS_EL.skillGapPanel    = DOM.get('#skill-gap-content');
  // Drawer mirrors (same filter chips, populated separately)
  RESULTS_EL.drawerPlatforms  = DOM.get('#drawer-filter-platforms');
  RESULTS_EL.drawerJobTypes   = DOM.get('#drawer-filter-job-types');
  RESULTS_EL.drawerMatch      = DOM.get('#drawer-filter-match');
}

// ─── State Transitions ────────────────────────────────────────────────────────

/** Shows loading skeletons, hides grid and empty state */
function showLoading() {
  DOM.show(RESULTS_EL.loadingState);
  DOM.hide(RESULTS_EL.jobsGrid);
  DOM.hide(RESULTS_EL.emptyState);
  DOM.hide(RESULTS_EL.pagination);
}

/** Shows empty-state message, hides everything else */
function showEmpty() {
  DOM.hide(RESULTS_EL.loadingState);
  DOM.hide(RESULTS_EL.jobsGrid);
  DOM.show(RESULTS_EL.emptyState);
  DOM.hide(RESULTS_EL.pagination);
}

/** Shows the job grid after a successful fetch */
function showResults() {
  DOM.hide(RESULTS_EL.loadingState);
  DOM.show(RESULTS_EL.jobsGrid);
  DOM.hide(RESULTS_EL.emptyState);
}

// ─── Header + Nav ─────────────────────────────────────────────────────────────

/**
 * Updates the results count header text.
 * @param {number} total    - total jobs fetched from APIs
 * @param {number} showing  - jobs currently visible after filters
 * @param {string} jobTitle - user's search title (for subtitle)
 */
function updateResultsHeader(total, showing, jobTitle) {
  if (RESULTS_EL.countText) {
    RESULTS_EL.countText.innerHTML =
      `<span>${showing}</span> of <span>${total}</span> jobs found`;
  }
  if (RESULTS_EL.subtitle) {
    RESULTS_EL.subtitle.textContent =
      `Best matches for "${jobTitle || 'your search'}"`;
  }
  // Update tab count badge
  if (RESULTS_EL.tabAllCount) RESULTS_EL.tabAllCount.textContent = showing;
}

/**
 * Displays the search context (job title) in the nav bar.
 * @param {string} jobTitle
 */
function renderNavContext(jobTitle) {
  if (!jobTitle || !RESULTS_EL.navTitle) return;
  RESULTS_EL.navTitle.textContent = jobTitle;
  DOM.show(RESULTS_EL.navContext);
}

// ─── Sidebar Profile Summary ──────────────────────────────────────────────────

/**
 * Fills the sidebar with the user's search profile details.
 * @param {Object} profile
 */
function renderSidebarProfile(profile) {
  const expLabel = CONFIG.EXPERIENCE_OPTIONS.find((o) => o.value === profile.experience)?.label;
  const modeLabel = CONFIG.WORK_MODE_OPTIONS.find((o) => o.value === profile.workMode)?.label;

  if (RESULTS_EL.sidebarTitle) RESULTS_EL.sidebarTitle.textContent = profile.jobTitle || 'Your Profile';
  if (RESULTS_EL.sidebarExp  && expLabel)   RESULTS_EL.sidebarExp.innerHTML  = `<i class="fa-solid fa-chart-bar"></i> ${expLabel}`;
  if (RESULTS_EL.sidebarLoc  && profile.location) RESULTS_EL.sidebarLoc.innerHTML = `<i class="fa-solid fa-location-dot"></i> ${profile.location}`;
  if (RESULTS_EL.sidebarMode && modeLabel)  RESULTS_EL.sidebarMode.innerHTML = `<i class="fa-solid fa-briefcase"></i> ` + modeLabel;
}

// ─── Platform Deep-Links ──────────────────────────────────────────────────────

/**
 * Renders the platform deep-link cards strip.
 * @param {Array<{key,name,url,color,logo,description}>} platforms
 */
function renderPlatformLinks(platforms) {
  if (!RESULTS_EL.platformGrid) return;
  DOM.empty(RESULTS_EL.platformGrid);

  platforms.forEach(({ name, url, color, logo, description }) => {
    const card = DOM.create('a', {
      href:   url,
      target: '_blank',
      rel:    'noopener noreferrer',
      class:  'platform-link-card',
      role:   'listitem',
      title:  description,
      'aria-label': `Search on ${name} (opens in new tab)`,
    }, `
      <span class="platform-link-card__logo" aria-hidden="true">${logo}</span>
      <span style="font-weight:600;color:${color};">${name}</span>
      <span class="platform-link-card__arrow" aria-hidden="true">→</span>
    `);
    RESULTS_EL.platformGrid.appendChild(card);
  });
}

// ─── Match Score Badge ─────────────────────────────────────────────────────────

/**
 * Returns CSS class + label for a match score.
 * DRY: used by card renderer AND PDF export.
 * @param {number} score
 * @returns {{ cls: string, label: string }}
 */
function getMatchBadgeProps(score) {
  if (score >= 70) return { cls: 'match-badge--high',   label: '<i class="fa-solid fa-fire"></i> Great'   };
  if (score >= 40) return { cls: 'match-badge--medium', label: '<i class="fa-solid fa-check"></i> Good'     };
  return             { cls: 'match-badge--low',    label: '<i class="fa-solid fa-circle-half-stroke"></i> Partial'   };
}

// ─── Bookmark Button ──────────────────────────────────────────────────────────

/**
 * Builds the bookmark toggle button element for a job card.
 * @param {string}  jobId        - unique job ID
 * @param {boolean} isBookmarked - initial state
 * @param {Function} onToggle    - async callback(job)
 * @param {Object}  job          - full job object (passed to callback)
 * @returns {HTMLButtonElement}
 */
function buildBookmarkButton(jobId, isBookmarked, onToggle, job) {
  const btn = DOM.create('button', {
    class:       `bookmark-btn ${isBookmarked ? 'bookmarked' : ''}`,
    title:       isBookmarked ? 'Remove bookmark' : 'Save this job',
    'aria-label':isBookmarked ? 'Remove from saved jobs' : 'Save job',
    'data-job-id': jobId,
  }, isBookmarked ? '<i class="fa-solid fa-star"></i>' : '<i class="fa-regular fa-star"></i>');

  btn.addEventListener('click', async (e) => {
    e.preventDefault();
    e.stopPropagation();
    const nowBookmarked = await onToggle(job);
    btn.innerHTML       = nowBookmarked ? '<i class="fa-solid fa-star"></i>' : '<i class="fa-regular fa-star"></i>';
    btn.title           = nowBookmarked ? 'Remove bookmark' : 'Save this job';
    btn.setAttribute('aria-label', nowBookmarked ? 'Remove from saved jobs' : 'Save job');
    btn.classList.toggle('bookmarked', nowBookmarked);
    // Pulse animation
    btn.classList.add('pulse');
    btn.addEventListener('animationend', () => btn.classList.remove('pulse'), { once: true });
  });

  return btn;
}

// ─── Job Card Builder ─────────────────────────────────────────────────────────

/**
 * Builds a single job card article element.
 * @param {Job}      job
 * @param {string[]} userSkills     - for skill match highlighting
 * @param {boolean}  isBookmarked   - initial bookmark state
 * @param {Function} onBookmark     - async toggle callback
 * @param {number}   animDelay      - CSS animation delay in ms (for staggering)
 * @returns {HTMLElement}
 */
function buildJobCard(job, userSkills = [], isBookmarked = false, onBookmark = null, animDelay = 0) {
  const { cls: badgeCls }  = getMatchBadgeProps(job.matchScore);
  const isHighMatch         = job.matchScore >= 70;
  const normalizedUser      = userSkills.map(StringUtils.normalize);

  // Build skill tags — highlight those the user has
  const tagHTML = (job.tags || []).slice(0, 6).map((tag) => {
    const matched = normalizedUser.some((us) =>
      StringUtils.normalize(tag).includes(us) || us.includes(StringUtils.normalize(tag))
    );
    return `<span class="skill-tag ${matched ? 'skill-tag--matched' : ''}">${tag}</span>`;
  }).join('');

  // Company logo: img if URL, else emoji fallback
  const logoHTML = job.logo
    ? `<img src="${job.logo}" alt="${job.company} logo" loading="lazy"
           onerror="this.parentElement.innerHTML='<i class=\\'fa-solid fa-building\\' style=\\'font-size:24px;color:var(--text-muted)\\'></i>'" />`
    : '<i class="fa-solid fa-building" style="font-size:24px;color:var(--text-muted)"></i>';

  const jtLabels = { full_time: 'Full-time', part_time: 'Part-time', contract: 'Contract', internship: 'Internship' };

  // Experience level badge
  let expChipHTML = '';
  if (job.experienceLevel === 'fresher') {
    expChipHTML = '<span class="meta-chip meta-chip--exp" role="listitem"><i class="fa-solid fa-graduation-cap"></i> Fresher / Entry</span>';
  } else if (job.experienceLevel === 'internship') {
    expChipHTML = '<span class="meta-chip meta-chip--exp" role="listitem"><i class="fa-solid fa-user-graduate"></i> Internship</span>';
  } else if (job.experienceLevel === 'senior') {
    expChipHTML = '<span class="meta-chip meta-chip--exp-senior" role="listitem"><i class="fa-solid fa-award"></i> Senior</span>';
  }

  const card = DOM.create('article', {
    class:         `job-card ${isHighMatch ? 'job-card--high-match' : ''}`,
    role:          'listitem',
    'data-id':     job.id,
    'data-platform':job.platform,
    'data-job-type':job.jobType,
    'data-score':  job.matchScore,
    style:         `animation-delay:${animDelay}ms`,
  }, `
    <div class="job-card__header">
      <div class="job-card__logo" aria-hidden="true">${logoHTML}</div>
      <div class="job-card__title-group">
        <h3 class="job-card__title" title="${job.title}">${job.title}</h3>
        <p class="job-card__company">${job.company}</p>
      </div>
      <div class="match-badge ${badgeCls}" title="Match score: ${job.matchScore}%"
           aria-label="${job.matchScore}% match">${job.matchScore}%</div>
    </div>

    <div class="job-card__meta" role="list">
      <span class="meta-chip" role="listitem"><i class="fa-solid fa-location-dot"></i> ${job.location}</span>
      <span class="meta-chip meta-chip--platform" role="listitem"><i class="fa-solid fa-bolt"></i> ${job.platform}</span>
      ${job.jobType ? `<span class="meta-chip" role="listitem"><i class="fa-solid fa-briefcase"></i> ${JOB_TYPE_LABELS[job.jobType] || job.jobType}</span>` : ''}
      ${expChipHTML}
    </div>

    ${job.description ? `<p class="job-card__desc">${job.description}</p>` : ''}
    ${tagHTML ? `<div class="job-card__tags" role="list">${tagHTML}</div>` : ''}

    <div class="job-card__footer">
      <div>
        <div class="job-card__salary">${job.salary || ''}</div>
        <div class="job-card__date">${DateUtils.timeAgo(job.postedAt)}</div>
      </div>
      <div style="display:flex;align-items:center;gap:0.5rem;">
        <!-- Bookmark button injected here by JS -->
        <a href="${job.url}" target="_blank" rel="noopener noreferrer"
           class="apply-btn"
           aria-label="Apply for ${job.title} at ${job.company}">
          Apply →
        </a>
      </div>
    </div>
  `);

  // Inject bookmark button into footer actions div
  if (onBookmark) {
    const footerActions = card.querySelector('.job-card__footer > div:last-child');
    footerActions.prepend(buildBookmarkButton(job.id, isBookmarked, onBookmark, job));
  }

  return card;
}

// ─── Jobs Grid Renderer ───────────────────────────────────────────────────────

/**
 * Renders a page of jobs into the jobs grid.
 * @param {Job[]}    jobs
 * @param {string[]} userSkills
 * @param {Set<string>} bookmarkedIds - set of currently bookmarked job IDs
 * @param {Function} onBookmark
 */
function renderJobsGrid(jobs, userSkills = [], bookmarkedIds = new Set(), onBookmark = null) {
  DOM.empty(RESULTS_EL.jobsGrid);
  if (!jobs.length) { showEmpty(); return; }

  showResults();
  const frag = document.createDocumentFragment();
  jobs.forEach((job, i) => {
    const delay = Math.min(i * 50, 600);
    frag.appendChild(
      buildJobCard(job, userSkills, bookmarkedIds.has(job.id), onBookmark, delay)
    );
  });
  RESULTS_EL.jobsGrid.appendChild(frag);
}

// ─── Saved Jobs Grid ──────────────────────────────────────────────────────────

/**
 * Renders the saved/bookmarked jobs tab content.
 * @param {Job[]}    jobs
 * @param {string[]} userSkills
 * @param {Function} onBookmark
 */
function renderSavedJobsGrid(jobs, userSkills = [], onBookmark = null) {
  const container = RESULTS_EL.savedGrid;
  if (!container) return;
  DOM.empty(container);

  if (!jobs.length) {
    container.innerHTML = `
      <div class="saved-empty">
        <div class="saved-empty__icon" aria-hidden="true"><i class="fa-solid fa-bookmark"></i></div>
        <h2 class="saved-empty__title">No Saved Jobs</h2>
        <p class="saved-empty__desc">
          Tap the <strong><i class="fa-solid fa-star"></i></strong> on any job card to save it here for later.
        </p>
      </div>`;
    return;
  }

  // All saved jobs are "bookmarked" by definition
  const allBookmarked = new Set(jobs.map((j) => j.id));
  const frag = document.createDocumentFragment();
  jobs.forEach((job, i) => {
    frag.appendChild(buildJobCard(job, userSkills, true, onBookmark, i * 50));
  });
  container.appendChild(frag);
}

// ─── Filter Chips ─────────────────────────────────────────────────────────────

/**
 * Renders dynamic filter chip buttons into a container.
 * Generates chips from actual data — only shows options that exist.
 * @param {Job[]}    allJobs
 * @param {Function} onFilterChange
 */
function renderFilterChips(allJobs, onFilterChange, activeFilters = { platform: 'All', jobType: 'All' }) {
  const defaultPlatforms = ['Remotive', 'RemoteOK'];
  if (CONFIG.APIS.ADZUNA?.ENABLED) defaultPlatforms.push('Adzuna');
  if (CONFIG.APIS.JSEARCH?.ENABLED) defaultPlatforms.push('JSearch');

  const platforms = ArrayUtils.unique([...defaultPlatforms, ...allJobs.map((j) => j.platform)]).filter(Boolean);
  const allJobTypes = CONFIG.JOB_TYPE_OPTIONS.map((opt) => opt.label);

  const activePlatform = activeFilters?.platform || 'All';
  const activeJobType  = activeFilters?.jobType  || 'All';

  // DRY: render into BOTH sidebar and mobile drawer containers
  const platformContainers = [RESULTS_EL.filterPlatforms, RESULTS_EL.drawerPlatforms].filter(Boolean);
  const jobTypeContainers  = [RESULTS_EL.filterJobTypes,  RESULTS_EL.drawerJobTypes ].filter(Boolean);

  platformContainers.forEach((container) => {
    DOM.empty(container);
    _createFilterChip(container, 'All', activePlatform === 'All', onFilterChange);
    platforms.forEach((p) => _createFilterChip(container, p, activePlatform === p, onFilterChange));
  });

  jobTypeContainers.forEach((container) => {
    DOM.empty(container);
    _createFilterChip(container, 'All', activeJobType === 'All', onFilterChange);
    allJobTypes.forEach((label) => _createFilterChip(container, label, activeJobType === label, onFilterChange));
  });

  // Wire match score chips in drawer (pre-rendered in HTML)
  if (RESULTS_EL.drawerMatch) {
    DOM.getAll('.filter-chip', RESULTS_EL.drawerMatch).forEach((chip) => {
      // Remove old listeners if any (by replacing node or just relying on single init)
      chip.addEventListener('click', () => {
        DOM.getAll('.filter-chip', RESULTS_EL.drawerMatch).forEach((c) => {
          c.classList.remove('active');
          c.setAttribute('aria-checked', 'false');
        });
        chip.classList.add('active');
        chip.setAttribute('aria-checked', 'true');
        // Do NOT call onFilterChange here, drawer applies via Apply button
      });
    });
  }
}

/**
 * Builds a single filter chip button.
 * DRY: called for each chip in platform + job type groups.
 * @param {HTMLElement} container
 * @param {string}      label
 * @param {boolean}     isActive
 * @param {Function}    onFilterChange
 */
function _createFilterChip(container, label, isActive, onFilterChange) {
  const chip = DOM.create('button', {
    class:         `filter-chip ${isActive ? 'active' : ''}`,
    'data-filter': label,
    role:          'radio',
    'aria-checked':isActive ? 'true' : 'false',
  }, label);

  chip.addEventListener('click', () => {
    // Single-select within group
    DOM.getAll('.filter-chip', container).forEach((c) => {
      c.classList.remove('active');
      c.setAttribute('aria-checked', 'false');
    });
    chip.classList.add('active');
    chip.setAttribute('aria-checked', 'true');
    onFilterChange();
  });

  container.appendChild(chip);
}

// ─── Tab Count Badge ──────────────────────────────────────────────────────────

/**
 * Updates the saved-jobs tab badge count.
 * @param {number} count
 */
function updateSavedTabCount(count) {
  if (RESULTS_EL.tabSavedCount) {
    RESULTS_EL.tabSavedCount.textContent = count;
  }
}

// ─── Skill Gap Panel ──────────────────────────────────────────────────────────

/**
 * Renders the skill gap analysis panel.
 * @param {import('./skillGapAnalyzer.js').SkillGapAnalysis} analysis
 * @param {string[]} userSkills - for "your strengths" section
 */
function renderSkillGapPanel(analysis) {
  const container = RESULTS_EL.skillGapPanel;
  if (!container) return;

  if (!analysis || analysis.totalJobsAnalyzed === 0) {
    container.innerHTML = `
      <div class="saved-empty">
        <div class="saved-empty__icon"><i class="fa-solid fa-chart-pie"></i></div>
        <h2 class="saved-empty__title">No Data Yet</h2>
        <p class="saved-empty__desc">Fetch some job results first, then come back here for your skill gap analysis.</p>
      </div>`;
    return;
  }

  const { averageCoverage, totalJobsAnalyzed, topMissingSkills, topMatchingSkills, jobCoverages } = analysis;

  // Coverage circle color class
  const coverageClass = averageCoverage >= 70 ? 'high' : averageCoverage >= 40 ? 'medium' : 'low';
  // SVG circle math: circumference = 2π×45 ≈ 283
  const dashOffset = Math.round(283 - (283 * averageCoverage) / 100);

  container.innerHTML = `
    <div class="skill-gap-panel">

      <!-- Coverage Hero -->
      <div class="coverage-hero">
        <div class="coverage-circle coverage-circle--${coverageClass}" aria-label="${averageCoverage}% skill coverage">
          <svg viewBox="0 0 100 100" width="100" height="100">
            <circle class="coverage-circle__track" cx="50" cy="50" r="45"/>
            <circle class="coverage-circle__fill" cx="50" cy="50" r="45"
                    style="stroke-dashoffset:${dashOffset}"/>
          </svg>
          <div class="coverage-circle__label">
            ${averageCoverage}%
            <span class="coverage-circle__sub">match</span>
          </div>
        </div>
        <div class="coverage-info">
          <h3>Your Skill Coverage</h3>
          <p>
            On average, your skills match <strong>${averageCoverage}%</strong> of the requirements
            across <strong>${totalJobsAnalyzed}</strong> jobs analyzed.
            ${averageCoverage >= 70 ? "You're a strong candidate! 🎉" :
              averageCoverage >= 40 ? 'A few more skills could make you highly competitive.' :
              'Consider upskilling in the areas listed below.'}
          </p>
        </div>
      </div>

      <!-- Two-column grid: missing skills + your strengths -->
      <div class="gap-grid">

        <!-- Missing Skills -->
        <div class="gap-card">
          <h4 class="gap-card__title">
            <span aria-hidden="true"><i class="fa-solid fa-ban"></i></span> Top Missing Skills
          </h4>
          ${topMissingSkills.length === 0
            ? '<p style="color:var(--text-muted);font-size:0.85rem;">No skill gaps found — great job! <i class="fa-solid fa-check"></i></p>'
            : topMissingSkills.map((item) => `
              <div class="skill-freq-item">
                <span class="skill-freq-item__name" title="${item.skill}">${item.skill}</span>
                <div class="skill-freq-bar-track">
                  <div class="skill-freq-bar-fill" style="width:${item.percentage}%"></div>
                </div>
                <span class="skill-freq-item__pct">${item.percentage}%</span>
              </div>`).join('')
          }
        </div>

        <!-- Your Strengths -->
        <div class="gap-card">
          <h4 class="gap-card__title">
            <span aria-hidden="true"><i class="fa-solid fa-check-circle"></i></span> Your Strengths
          </h4>
          ${topMatchingSkills.length === 0
            ? '<p style="color:var(--text-muted);font-size:0.85rem;">Add skills to your profile to see your strengths.</p>'
            : topMatchingSkills.map((item) => `
              <div class="skill-freq-item">
                <span class="skill-freq-item__name" title="${item.skill}">${item.skill}</span>
                <div class="skill-freq-bar-track">
                  <div class="skill-freq-bar-fill skill-freq-bar-fill--match" style="width:${item.percentage}%"></div>
                </div>
                <span class="skill-freq-item__pct">${item.percentage}%</span>
              </div>`).join('')
          }
        </div>
      </div>

      <!-- Per-Job Coverage List -->
      <div class="gap-card">
        <h4 class="gap-card__title"><span aria-hidden="true"><i class="fa-solid fa-clipboard-list"></i></span> Job Coverage Breakdown</h4>
        ${jobCoverages.map((j) => {
          const cls = j.coverage >= 70 ? 'high' : j.coverage >= 40 ? 'medium' : 'low';
          return `
            <div class="job-coverage-item">
              <div class="job-coverage-item__info">
                <p class="job-coverage-item__title" title="${j.title}">${j.title}</p>
                <p class="job-coverage-item__company">${j.company} · ${j.platform}</p>
                ${j.missing.length ? `<p style="font-size:0.7rem;color:var(--text-muted);margin-top:2px;">Missing: ${j.missing.join(', ')}</p>` : ''}
              </div>
              <span class="job-coverage-badge job-coverage-badge--${cls}">${j.coverage}%</span>
            </div>`;
        }).join('')}
      </div>
    </div>
  `;

  // Animate the SVG fill after render (requires a tick for CSS transition to work)
  requestAnimationFrame(() => {
    const fill = container.querySelector('.coverage-circle__fill');
    if (fill) fill.style.strokeDashoffset = dashOffset;
  });
}

// ─── Pagination ───────────────────────────────────────────────────────────────

/**
 * Renders pagination buttons.
 * @param {number}   currentPage
 * @param {number}   totalPages
 * @param {Function} onPageChange
 */
function renderPagination(currentPage, totalPages, onPageChange) {
  DOM.empty(RESULTS_EL.pagination);
  if (totalPages <= 1) { DOM.hide(RESULTS_EL.pagination); return; }

  DOM.show(RESULTS_EL.pagination);

  // Previous
  const prevBtn = DOM.create('button', {
    class:    'page-btn page-btn--prev',
    disabled: currentPage === 1 ? '' : null,
    'aria-label': 'Previous page',
  }, '<span>← Prev</span>');
  prevBtn.addEventListener('click', () => onPageChange(currentPage - 1));
  RESULTS_EL.pagination.appendChild(prevBtn);

  // Page numbers (max 5 around current)
  const start = Math.max(1, currentPage - 2);
  const end   = Math.min(totalPages, start + 4);
  for (let p = start; p <= end; p++) {
    const btn = DOM.create('button', {
      class:         `page-btn ${p === currentPage ? 'active' : ''}`,
      'aria-label':  `Page ${p}`,
      'aria-current':p === currentPage ? 'page' : '',
    }, String(p));
    btn.addEventListener('click', () => onPageChange(p));
    RESULTS_EL.pagination.appendChild(btn);
  }

  // Next
  const nextBtn = DOM.create('button', {
    class:    'page-btn page-btn--next',
    disabled: currentPage === totalPages ? '' : null,
    'aria-label': 'Next page',
  }, '<span>Next →</span>');
  nextBtn.addEventListener('click', () => onPageChange(currentPage + 1));
  RESULTS_EL.pagination.appendChild(nextBtn);
}
