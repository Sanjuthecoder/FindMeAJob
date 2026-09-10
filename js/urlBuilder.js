/**
 * @file urlBuilder.js
 * @description Constructs pre-filled search URLs for each job platform.
 *              DRY: each platform has one builder function; shared logic is in helpers.
 *              These URLs open in a new tab, bypassing CORS/scraping restrictions.
 * @module urlBuilder
 */

'use strict';

// ─── Private Helpers ──────────────────────────────────────────────────────────

/**
 * Builds a query string from an object, omitting empty/null values.
 * @param {Object} params
 * @returns {string} URL query string (without leading '?')
 */
function _buildQuery(params) {
  return Object.entries(params)
    .filter(([, val]) => val !== null && val !== undefined && val !== '')
    .map(([key, val]) => `${encodeURIComponent(key)}=${encodeURIComponent(val)}`)
    .join('&');
}

/**
 * Formats a job title for use in a URL path segment (URL-friendly slug).
 * @param {string} title
 * @returns {string} e.g. "Frontend Developer" → "frontend-developer"
 */
function _titleSlug(title) {
  return StringUtils.slugify(title || 'jobs');
}

/**
 * Formats a location for use in URL paths (lowercase hyphenated).
 * @param {string} location
 * @returns {string}
 */
function _locationSlug(loc) {
  if (!loc || StringUtils.normalize(loc) === 'remote') return 'india';
  return StringUtils.slugify(loc);
}

/**
 * Maps the app's experience value to LinkedIn's experience level code.
 * @param {string} experience - from CONFIG.EXPERIENCE_OPTIONS
 * @returns {string} LinkedIn exp level code (1-6)
 */
function _linkedInExpCode(experience) {
  return CONFIG.PLATFORMS.LINKEDIN.EXP_CODES[experience] || '2';
}

/**
 * Maps the app's work mode value to LinkedIn's work type code.
 * @param {string} workMode
 * @returns {string}
 */
function _linkedInWorkType(workMode) {
  return CONFIG.PLATFORMS.LINKEDIN.WORK_TYPE_CODES[StringUtils.normalize(workMode)] || '';
}

// ─── Platform URL Builders ────────────────────────────────────────────────────

/**
 * Builds a Naukri.com pre-filled search URL.
 * Naukri uses path-based URL structure for SEO.
 * @param {Object} profile - user job search profile
 * @param {string} profile.jobTitle
 * @param {string} [profile.location]
 * @param {string} [profile.experience]
 * @param {string[]} [profile.skills]
 * @returns {string} full URL
 */
function buildNaukriURL(profile) {
  const { jobTitle = 'jobs', location, experience, skills = [] } = profile;
  const titleSlug = _titleSlug(jobTitle);
  const locSlug   = _locationSlug(location);

  // Naukri experience filter: value is min years
  const expMap = { 'fresher': '0', '0-1': '0', '1-3': '1', '3-5': '3', '5-10': '5', '10+': '10', 'internship': '0' };
  const expParam = expMap[experience] || '0';

  // Naukri path format: /title-jobs-in-location
  const path = `/${titleSlug}-jobs-in-${locSlug}`;
  const query = _buildQuery({
    k: skills.slice(0, 3).join('%20') || jobTitle, // top 3 skills or title
    experience: expParam,
  });

  return `${CONFIG.PLATFORMS.NAUKRI.baseUrl}${path}?${query}`;
}

/**
 * Builds a LinkedIn Jobs pre-filled search URL.
 * Uses LinkedIn's filter parameters for experience level and work type.
 * @param {Object} profile
 * @returns {string}
 */
function buildLinkedInURL(profile) {
  const { jobTitle = '', location, experience, workMode, jobType } = profile;

  // LinkedIn job type codes
  const jtMap = { full_time: 'F', part_time: 'P', internship: 'I', contract: 'C' };

  const query = _buildQuery({
    keywords:       jobTitle,
    location:       location && StringUtils.normalize(location) !== 'remote' ? location : 'India',
    f_E:            _linkedInExpCode(experience),
    f_WT:           _linkedInWorkType(workMode || 'any'),
    f_JT:           jtMap[jobType] || '',
    sortBy:         'DD',    // Date Descending — most recent jobs first
    f_TPR:          'r604800', // Posted in last 7 days
  });

  return `${CONFIG.PLATFORMS.LINKEDIN.baseUrl}/?${query}`;
}

/**
 * Builds an Indeed India pre-filled search URL.
 * @param {Object} profile
 * @returns {string}
 */
function buildIndeedURL(profile) {
  const { jobTitle = '', location, experience, jobType, workMode } = profile;

  const isRemote = StringUtils.normalize(workMode) === 'remote';
  const expLevelMap = {
    fresher: 'entry_level', '0-1': 'entry_level', '1-3': 'entry_level',
    '3-5': 'mid_level', '5-10': 'senior_level', '10+': 'senior_level',
    internship: 'internship',
  };
  const jtMap = { full_time: 'fulltime', part_time: 'parttime', internship: 'internship', contract: 'contract' };

  const query = _buildQuery({
    q:       jobTitle,
    l:       location && !isRemote ? location : 'India',
    explvl:  expLevelMap[experience] || '',
    jt:      jtMap[jobType] || '',
    remotejob: isRemote ? 1 : undefined,
    fromage: 14, // jobs posted in last 14 days
  });

  return `${CONFIG.PLATFORMS.INDEED.baseUrl}?${query}`;
}

/**
 * Builds an Internshala search URL (best for freshers/students).
 * Internshala uses path-based URLs: /internships/keyword-internship-in-city
 * @param {Object} profile
 * @returns {string}
 */
function buildInternshalaURL(profile) {
  const { jobTitle = '', location, jobType } = profile;

  // Internshala path-based format
  const isJob = jobType === 'full_time' || jobType === 'part_time';
  const section = isJob ? 'jobs' : 'internships';
  const titleSlug = _titleSlug(jobTitle);
  const locSlug   = _locationSlug(location);

  const path = isJob
    ? `/jobs/${titleSlug}-jobs-in-${locSlug}`
    : `/internships/${titleSlug}-internship-in-${locSlug}`;

  return `${CONFIG.PLATFORMS.INTERNSHALA.baseUrl}${path}/`;
}

/**
 * Builds a Shine.com search URL.
 * @param {Object} profile
 * @returns {string}
 */
function buildShineURL(profile) {
  const { jobTitle = '', location } = profile;
  const titleSlug = _titleSlug(jobTitle);
  const locSlug   = _locationSlug(location);
  return `${CONFIG.PLATFORMS.SHINE.baseUrl}/${titleSlug}-jobs-in-${locSlug}`;
}

/**
 * Builds a Glassdoor search URL.
 * @param {Object} profile
 * @returns {string}
 */
function buildGlassdoorURL(profile) {
  const { jobTitle = '', location } = profile;
  const query = _buildQuery({
    suggestCount: 0,
    suggestChosen: false,
    clickSource: 'searchBtn',
    typedKeyword: jobTitle,
    sc_crit: `KO0,${jobTitle.length}`,
    locT: location ? 'C' : '',
    loc: location || '',
  });
  return `${CONFIG.PLATFORMS.GLASSDOOR.baseUrl}?${query}`;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Generates deep-link search URLs for ALL configured platforms.
 * @param {Object} profile - user job search profile
 * @returns {Array<{ key: string, name: string, url: string, color: string, logo: string, description: string }>}
 */
function buildAllPlatformURLs(profile) {
  const builders = [
    { key: 'NAUKRI',     fn: buildNaukriURL     },
    { key: 'LINKEDIN',   fn: buildLinkedInURL   },
    { key: 'INDEED',     fn: buildIndeedURL     },
    { key: 'INTERNSHALA',fn: buildInternshalaURL},
    { key: 'SHINE',      fn: buildShineURL      },
    { key: 'GLASSDOOR',  fn: buildGlassdoorURL  },
  ];

  return builders.map(({ key, fn }) => {
    const platform = CONFIG.PLATFORMS[key];
    let url = '#';
    try {
      url = fn(profile);
    } catch (err) {
      console.warn(`[URLBuilder] Failed to build URL for ${key}:`, err);
    }
    return {
      key,
      name:        platform.name,
      url,
      color:       platform.color,
      logo:        platform.logo,
      description: platform.description,
    };
  });
}
