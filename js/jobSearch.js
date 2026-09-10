/**
 * @file jobSearch.js
 * @description Fetches job listings from CORS-friendly public APIs (Phase 1)
 *              and optionally from Adzuna + JSearch APIs (Phase 2, require keys).
 *              Normalizes every source into a unified Job schema.
 *              Computes relevance match scores against the user's profile.
 * @module jobSearch
 */

'use strict';

// ─── Unified Job Schema ───────────────────────────────────────────────────────
/**
 * @typedef {Object} Job
 * @property {string}   id          - Unique job ID (platform-prefixed)
 * @property {string}   title       - Job title
 * @property {string}   company     - Company name
 * @property {string}   location    - Job location
 * @property {string}   platform    - Source platform name
 * @property {string}   url         - Direct apply link
 * @property {string}   description - Stripped plain-text description (max 200 chars)
 * @property {string[]} tags        - Skill/tech tags
 * @property {string}   salary      - Human-readable salary string (empty if N/A)
 * @property {string}   postedAt    - ISO date string
 * @property {string}   jobType     - 'full_time'|'part_time'|'contract'|'internship'
 * @property {number}   matchScore  - 0–100 relevance score (computed after fetch)
 * @property {string}   logo        - Company logo URL (empty if unavailable)
 */

// ─── Response Normalizers ─────────────────────────────────────────────────────

/**
 * Maps various raw job type strings to our standard set.
 * DRY: used by ALL normalizers below.
 * @param {string} raw
 * @returns {string}
 */
function _normalizeJobType(raw) {
  if (!raw) return 'full_time';
  const t = raw.toLowerCase();
  if (t.includes('intern') || t.includes('trainee') || t.includes('apprentice')) return 'internship';
  if (t.includes('part'))      return 'part_time';
  if (t.includes('freelance')) return 'freelance';
  if (t.includes('contract'))  return 'contract';
  return 'full_time';
}

/**
 * Detects the experience level required for a job based on title, tags, and description.
 * @param {string} title
 * @param {string} description
 * @param {string[]} [tags=[]]
 * @returns {'internship'|'fresher'|'mid'|'senior'}
 */
function _detectJobExperienceLevel(title, description, tags = []) {
  const titleLower = (title || '').toLowerCase();
  const descLower  = (description || '').toLowerCase();
  const tagList    = (tags || []).map((t) => (t || '').toLowerCase());
  const combined   = `${titleLower} ${tagList.join(' ')} ${descLower}`;

  // 1. Senior indicators (check title first)
  if (/\b(senior|sr\.?|lead|principal|staff|architect|director|chief|head\b|vp|manager|mgr|exec|executive)\b/i.test(titleLower)) {
    return 'senior';
  }
  if (/\b([5-9]|\d{2})\+?\s*(?:years?|yrs?)(?:\s*(?:of)?\s*(?:relevant|work|professional)?\s*(?:experience|exp))\b/i.test(combined)) {
    return 'senior';
  }

  // 2. Internship indicators
  if (/\b(intern|interns|internship|internships|trainee|apprentice|co-?op)\b/i.test(titleLower) ||
      tagList.some((t) => /\b(intern|internship|trainee|apprentice)\b/i.test(t))) {
    return 'internship';
  }

  // 3. Fresher / Entry-Level indicators
  if (/\b(fresher|entry[\s-]level|junior|jr\.?|associate|graduate)\b/i.test(titleLower) ||
      tagList.some((t) => /\b(junior|fresher|entry-level|graduate)\b/i.test(t)) ||
      /\b(?:0-1|0 to 1|no prior|freshers?)\s*(?:years?|yrs?)(?:\s*(?:of)?\s*(?:relevant|work|professional)?\s*(?:experience|exp))?\b/i.test(combined)) {
    return 'fresher';
  }

  return 'mid';
}

/**
 * Normalizes a Remotive API job object to the unified Job schema.
 * @param {Object} raw
 * @returns {Job}
 */
function _normalizeRemotive(raw) {
  const combinedTypeStr = `${raw.job_type || ''} ${raw.title || ''} ${(raw.tags || []).join(' ')}`;
  const tags = Array.isArray(raw.tags) ? raw.tags.slice(0, 8) : [];
  const description = StringUtils.truncate(StringUtils.stripHTML(raw.description || ''), 200);
  return {
    id:              `remotive-${raw.id}`,
    title:           raw.title         || 'Untitled Role',
    company:         raw.company_name  || 'Unknown Company',
    location:        raw.candidate_required_location || 'Remote',
    platform:        'Remotive',
    url:             raw.url           || `https://remotive.com/remote-jobs`,
    description,
    tags,
    salary:          raw.salary        || '',
    postedAt:        raw.publication_date || new Date().toISOString(),
    jobType:         _normalizeJobType(combinedTypeStr),
    experienceLevel: _detectJobExperienceLevel(raw.title, raw.description, tags),
    matchScore:      0,
    logo:            '', // Omit Remotive logo due to strict CORS 403 Forbidden errors
  };
}

/**
 * Normalizes a RemoteOK API job object to the unified Job schema.
 * @param {Object} raw
 * @returns {Job}
 */
function _normalizeRemoteOK(raw) {
  // RemoteOK tags can be an array or a {tag: bool} object
  const tags = Array.isArray(raw.tags)
    ? raw.tags
    : Object.keys(raw.tags || {}).filter((k) => raw.tags[k]);

  const combinedTypeStr = `${tags.join(' ')} ${raw.position || ''}`;
  const slicedTags = tags.slice(0, 8);
  const description = StringUtils.truncate(StringUtils.stripHTML(raw.description || ''), 200);

  return {
    id:              `remoteok-${raw.id}`,
    title:           raw.position      || 'Untitled Role',
    company:         raw.company       || 'Unknown Company',
    location:        raw.location      || 'Remote Worldwide',
    platform:        'RemoteOK',
    url:             raw.url           || raw.apply_url || 'https://remoteok.com',
    description,
    tags:            slicedTags,
    salary:          _formatSalaryRange(raw.salary_min, raw.salary_max, '$'),
    postedAt:        raw.epoch ? new Date(raw.epoch * 1000).toISOString() : new Date().toISOString(),
    jobType:         _normalizeJobType(combinedTypeStr),
    experienceLevel: _detectJobExperienceLevel(raw.position, raw.description, slicedTags),
    matchScore:      0,
    logo:            raw.company_logo  || '',
  };
}

/**
 * Normalizes an Adzuna API job object to the unified Job schema.
 * Adzuna returns India-specific jobs with INR salaries.
 * @param {Object} raw - Adzuna job result object
 * @returns {Job}
 */
function _normalizeAdzuna(raw) {
  // Adzuna salary is in annual INR
  const salary = _formatSalaryRange(raw.salary_min, raw.salary_max, '₹');
  // Extract tags from category label and title keywords
  const tags = [
    raw.category?.label,
    ...(raw.title || '').split(/[\s,/-]+/).filter((w) => w.length > 2).slice(0, 4),
  ].filter(Boolean);
  const uniqueTags = ArrayUtils.unique(tags).slice(0, 8);
  const description = StringUtils.truncate(StringUtils.stripHTML(raw.description || ''), 200);

  return {
    id:              `adzuna-${raw.id}`,
    title:           raw.title                       || 'Untitled Role',
    company:         raw.company?.display_name       || 'Unknown Company',
    location:        raw.location?.display_name      || 'India',
    platform:        'Adzuna',
    url:             raw.redirect_url                || '#',
    description,
    tags:            uniqueTags,
    salary,
    postedAt:        raw.created                     || new Date().toISOString(),
    jobType:         _normalizeJobType(raw.contract_type),
    experienceLevel: _detectJobExperienceLevel(raw.title, raw.description, uniqueTags),
    matchScore:      0,
    logo:            '',
  };
}

/**
 * Normalizes a JSearch (RapidAPI) job object to the unified Job schema.
 * JSearch aggregates LinkedIn, Indeed, Glassdoor data.
 * @param {Object} raw - JSearch job result object
 * @returns {Job}
 */
function _normalizeJSearch(raw) {
  const location = [raw.job_city, raw.job_state, raw.job_country]
    .filter(Boolean)
    .join(', ');
  const tags = (raw.job_required_skills || []).slice(0, 8);
  const description = StringUtils.truncate(StringUtils.stripHTML(raw.job_description || ''), 200);

  return {
    id:              `jsearch-${raw.job_id}`,
    title:           raw.job_title                   || 'Untitled Role',
    company:         raw.employer_name               || 'Unknown Company',
    location:        location                        || 'India',
    platform:        raw.job_publisher               || 'JSearch',
    url:             raw.job_apply_link              || raw.job_google_link || '#',
    description,
    tags,
    salary:          raw.job_salary_period ? `${raw.job_min_salary || ''}–${raw.job_max_salary || ''} ${raw.job_salary_currency || ''}` : '',
    postedAt:        raw.job_posted_at_datetime_utc  || new Date().toISOString(),
    jobType:         _normalizeJobType(raw.job_employment_type),
    experienceLevel: _detectJobExperienceLevel(raw.job_title, raw.job_description, tags),
    matchScore:      0,
    logo:            raw.employer_logo               || '',
  };
}

// ─── Salary Formatter ─────────────────────────────────────────────────────────

/**
 * Formats a min/max salary pair into a readable range string.
 * DRY: used by RemoteOK and Adzuna normalizers.
 * @param {number|null} min
 * @param {number|null} max
 * @param {string} [symbol='₹']
 * @returns {string}
 */
function _formatSalaryRange(min, max, symbol = '₹') {
  if (!min && !max) return '';
  // Adzuna returns annual INR — convert to lakhs for readability
  const fmt = (n) => symbol === '₹' && n >= 100000
    ? `${(n / 100000).toFixed(1)}L`
    : symbol === '$' && n >= 1000
      ? `$${(n / 1000).toFixed(0)}k`
      : `${symbol}${n?.toLocaleString()}`;

  if (min && max) return `${fmt(min)}–${fmt(max)}/yr`;
  if (min)        return `From ${fmt(min)}/yr`;
  return            `Up to ${fmt(max)}/yr`;
}

// ─── Category Mapper ──────────────────────────────────────────────────────────

/**
 * Maps a job title to the best Remotive API category slug.
 * Defaults to 'software-dev' for any unrecognized tech role.
 * @param {string} jobTitle
 * @returns {string}
 */
function _mapTitleToRemotiveCategory(jobTitle) {
  const t = StringUtils.normalize(jobTitle);
  const map = [
    { keywords: ['design', 'ui', 'ux', 'figma', 'graphic'],        cat: 'design'    },
    { keywords: ['data', 'analyst', 'scientist', 'ml', 'ai'],       cat: 'data'      },
    { keywords: ['devops', 'infra', 'cloud', 'sre', 'ops'],         cat: 'devops'    },
    { keywords: ['qa', 'test', 'quality', 'automation'],             cat: 'qa'        },
    { keywords: ['product', 'pm', 'manager', 'owner'],               cat: 'product'   },
    { keywords: ['market', 'seo', 'content', 'growth', 'brand'],    cat: 'marketing' },
    { keywords: ['finance', 'account', 'banking', 'fintech'],        cat: 'finance'   },
  ];
  for (const { keywords, cat } of map) {
    if (keywords.some((kw) => t.includes(kw))) return cat;
  }
  return 'software-dev';
}

// ─── Relevance Pre-filter ─────────────────────────────────────────────────────

/**
 * Quick relevance pre-filter — discards jobs with zero title/tag word overlap.
 * Runs before full match scoring to skip obviously irrelevant results.
 * @param {Job}    job
 * @param {Object} profile
 * @returns {boolean}
 */
function _isRelevantJob(job, profile) {
  if (!profile) return true;
  if (!profile.jobTitle && (!profile.skills || profile.skills.length === 0) && !profile.jobType && !profile.experience) return true;

  const jobText = StringUtils.normalize(`${job.title} ${job.tags.join(' ')} ${job.description || ''}`);

  // 1. Strict experience level enforcement
  const exp = profile.experience;
  const isSeniorTitle = /\b(senior|sr\.?|lead|principal|staff|architect|director|chief|head\b|vp|manager|mgr|exec|executive)\b/i.test(job.title);
  const requiresHighExp = /\b([3-9]|\d{2})(?:\s*-\s*\d+)?\+?\s*(?:years?|yrs?)(?:\s*(?:of)?\s*(?:relevant|work|professional)?\s*(?:experience|exp))\b/i.test(`${job.description || ''} ${(job.tags || []).join(' ')}`) ||
    /\b(?:experience|exp)\s*:\s*([3-9]|\d{2})/i.test(job.description || '');
  const isInternRole = job.jobType === 'internship' || /\b(intern|interns|internship|internships|trainee|apprentice|co-?op)\b/i.test(`${job.title} ${(job.tags || []).join(' ')}`);
  const isJuniorRole = /\b(junior|jr\.?|fresher|entry[\s-]level|associate|graduate)\b/i.test(`${job.title} ${(job.tags || []).join(' ')}`);

  if (exp === 'internship') {
    if (isSeniorTitle || job.experienceLevel === 'senior') return false;
    if (!isInternRole && job.jobType !== 'internship') return false;
  } else if (exp === '0-1' || exp === 'fresher') {
    // Freshers must NOT get senior or lead roles, nor roles requiring 3+ years experience
    if (isSeniorTitle || job.experienceLevel === 'senior') return false;
    if (requiresHighExp) return false;
    const hasSeniorTag = (job.tags || []).some((t) => /\b(senior|lead|principal|architect|director)\b/i.test(t));
    if (hasSeniorTag && !isJuniorRole) return false;
  } else if (exp === '5-10' || exp === '10+') {
    if (isInternRole && !isSeniorTitle) return false;
  } else if (exp === '1-3') {
    const isExecutive = /\b(principal|staff|architect|director|chief|head\b|vp|exec)\b/i.test(job.title);
    const requires5Plus = /\b([5-9]|\d{2})\+?\s*(?:years?|yrs?)/i.test(`${job.description || ''}`);
    if (isExecutive || requires5Plus) return false;
  }

  // 2. Strict job type enforcement if user explicitly picked a specific type
  if (profile.jobType) {
    if (profile.jobType === 'internship') {
      if (isSeniorTitle || !isInternRole) return false;
    } else if (profile.jobType === 'part_time') {
      const isPart = job.jobType === 'part_time' || /\b(part[\s-]time)\b/i.test(`${job.title} ${(job.tags || []).join(' ')}`);
      if (!isPart) return false;
    } else if (profile.jobType === 'contract' || profile.jobType === 'freelance') {
      const isContract = job.jobType === 'contract' || job.jobType === 'freelance' || /\b(contract|contractor|freelance|freelancer)\b/i.test(`${job.title} ${(job.tags || []).join(' ')}`);
      if (!isContract) return false;
    }
  }

  // 3. Title / role matching with common abbreviations and stems (e.g. developer <-> dev)
  const userWords = StringUtils.normalize(profile.jobTitle || '')
    .split(/\s+/)
    .filter((w) => w.length > 2);

  const titleMatch = userWords.some((w) => {
    if (jobText.includes(w)) return true;
    if (w === 'developer' && jobText.includes('dev')) return true;
    if (w === 'software' && (jobText.includes('dev') || jobText.includes('tech'))) return true;
    if (w.length >= 4) {
      return jobText.split(/\s+/).some((tw) => tw.length >= 3 && (w.startsWith(tw) || tw.startsWith(w)));
    }
    return false;
  });

  if (titleMatch) return true;

  // 4. Skills overlap fallback
  const userSkills = (profile.skills || []).map(StringUtils.normalize).filter((s) => s.length > 1);
  if (userSkills.length > 0 && userSkills.some((s) => jobText.includes(s))) {
    return true;
  }

  // If user provided no job title words > 2 chars, accept all that passed experience/jobType filters
  return userWords.length === 0;
}

// ─── Match Scoring ────────────────────────────────────────────────────────────

/**
 * Computes a 0–100 match score between a job and user profile.
 * Weight breakdown (from CONFIG.MATCH_WEIGHTS):
 *   35% — Title word overlap
 *   40% — Skill keyword coverage in tags + description
 *   15% — Location match (remote bonus included)
 *   10% — Job type match
 * @param {Job}    job
 * @param {Object} profile
 * @returns {number} integer 0–100
 */
function computeMatchScore(job, profile) {
  const w = CONFIG.MATCH_WEIGHTS;
  let score = 0;

  // ── Title match (35 pts) ─────────────────────────────────────────────────
  const jobTitle  = StringUtils.normalize(job.title);
  const userWords = StringUtils.normalize(profile.jobTitle || '').split(/\s+/);
  const titleHits = userWords.filter((w) => w.length > 2 && jobTitle.includes(w));
  score += userWords.length > 0
    ? Math.min((titleHits.length / userWords.length) * w.TITLE_MATCH, w.TITLE_MATCH)
    : 0;

  // ── Skills overlap (40 pts) ──────────────────────────────────────────────
  const userSkills  = (profile.skills || []).map(StringUtils.normalize);
  const jobText     = StringUtils.normalize(`${job.title} ${job.description} ${job.tags.join(' ')}`);
  const skillHits   = userSkills.filter((s) => jobText.includes(s));
  score += userSkills.length > 0
    ? Math.min((skillHits.length / userSkills.length) * w.SKILLS_OVERLAP, w.SKILLS_OVERLAP)
    : w.SKILLS_OVERLAP * 0.3; // baseline when no skills provided

  // ── Location match (15 pts) ──────────────────────────────────────────────
  const userLoc = StringUtils.normalize(profile.location || '');
  const jobLoc  = StringUtils.normalize(job.location || '');
  const isRemote = jobLoc.includes('remote') || jobLoc.includes('worldwide');
  if      (userLoc === 'remote' && isRemote)   score += w.LOCATION_MATCH;
  else if (userLoc && jobLoc.includes(userLoc)) score += w.LOCATION_MATCH;
  else if (isRemote)                            score += w.LOCATION_MATCH * 0.5;

  // ── Job type match (10 pts) ──────────────────────────────────────────────
  if (!profile.jobType || profile.jobType === job.jobType) score += w.JOB_TYPE_MATCH;

  // ── Experience alignment adjustment ──────────────────────────────────────
  if (profile.experience) {
    const isSenior = /\b(senior|sr\.?|lead|principal|staff|architect|director|head\b|chief|vp|manager)\b/i.test(job.title);
    const isFresher = /\b(fresher|entry[\s-]level|junior|jr\.?|associate|graduate|intern|trainee)\b/i.test(`${job.title} ${(job.tags || []).join(' ')}`);

    if (profile.experience === '0-1' || profile.experience === 'fresher') {
      if (isSenior) {
        score -= 30;
      } else if (isFresher) {
        score += 10;
      }
    } else if (profile.experience === 'internship') {
      if (job.jobType === 'internship' || isFresher) {
        score += 10;
      }
    } else if (profile.experience === '5-10' || profile.experience === '10+') {
      if (isSenior) {
        score += 10;
      } else if (job.jobType === 'internship') {
        score -= 30;
      }
    }
  }

  return Math.round(Math.max(0, Math.min(score, 100)));
}

// ─── Individual API Fetchers ──────────────────────────────────────────────────

/**
 * Detects whether the app is running in a local development environment (Node dev server)
 * vs a production static host (e.g. Firebase Hosting, GitHub Pages, Netlify).
 * When running in production, local proxy routes (/api/...) do not exist and direct
 * CORS-enabled API endpoints are contacted directly.
 * @returns {boolean}
 */
function _isLocalDev() {
  if (typeof window === 'undefined' || !window.location) return false;
  const h = window.location.hostname;
  return h === 'localhost' || h === '127.0.0.1' || h === '' || h === '::1';
}

/**
 * Fetches from Remotive API. Free, no auth, CORS-safe.
 * @param {Object} profile
 * @returns {Promise<Job[]>}
 */
async function fetchRemotiveJobs(profile) {
  let queryStr;
  if (profile.jobType === 'internship' || profile.experience === 'internship') {
    const term = profile.jobTitle ? `${profile.jobTitle} intern` : 'intern';
    queryStr = `?search=${encodeURIComponent(term)}&limit=${CONFIG.APIS.REMOTIVE.MAX_RESULTS}`;
  } else if (profile.experience === '0-1' || profile.experience === 'fresher') {
    const term = profile.jobTitle ? `${profile.jobTitle} junior` : 'junior';
    queryStr = `?search=${encodeURIComponent(term)}&limit=${CONFIG.APIS.REMOTIVE.MAX_RESULTS}`;
  } else {
    const category = _mapTitleToRemotiveCategory(profile.jobTitle);
    queryStr = `?category=${category}&limit=${CONFIG.APIS.REMOTIVE.MAX_RESULTS}`;
  }

  let data;
  try {
    data = await AsyncUtils.fetchJSON(`${CONFIG.APIS.REMOTIVE.BASE_URL}${queryStr}`, {}, 8000);
  } catch (err) {
    if (_isLocalDev() && CONFIG.APIS.REMOTIVE.PROXY_URL) {
      data = await AsyncUtils.fetchJSON(`${CONFIG.APIS.REMOTIVE.PROXY_URL}${queryStr}`, {}, 8000).catch(() => null);
    }
  }
  if (!Array.isArray(data?.jobs)) return [];
  return data.jobs.map(_normalizeRemotive).filter((j) => _isRelevantJob(j, profile));
}

/**
 * Fetches from RemoteOK API. Free, no auth.
 * Uses local proxy if running on localhost dev server,
 * with direct API fetch for production (e.g. Firebase Hosting).
 * Note: first array element is metadata — skip it.
 * @param {Object} profile
 * @returns {Promise<Job[]>}
 */
async function fetchRemoteOKJobs(profile) {
  let queryParam = '';
  if (profile.jobType === 'internship' || profile.experience === 'internship') {
    queryParam = '?tag=internship';
  } else if (profile.experience === '0-1' || profile.experience === 'fresher') {
    queryParam = '?tag=junior';
  } else if (profile.experience === '5-10' || profile.experience === '10+') {
    queryParam = '?tag=senior';
  }

  let data;
  // 1. Try server proxy first ONLY if running locally
  if (_isLocalDev() && CONFIG.APIS.REMOTEOK.PROXY_URL) {
    try {
      data = await AsyncUtils.fetchJSON(`${CONFIG.APIS.REMOTEOK.PROXY_URL}${queryParam}`, {}, 8000);
    } catch (proxyErr) {
      console.warn('[RemoteOK] Proxy fetch failed:', proxyErr.message);
    }
  }

  // 2. Fallback or direct fetch in production
  if (!data) {
    try {
      data = await AsyncUtils.fetchJSON(`${CONFIG.APIS.REMOTEOK.BASE_URL}${queryParam}`, {}, 8000);
    } catch (directErr) {
      console.warn('[RemoteOK] Direct fetch failed (likely browser CORS):', directErr.message);
      return [];
    }
  }

  if (!Array.isArray(data)) return [];
  return data
    .slice(1) // skip metadata object
    .map(_normalizeRemoteOK)
    .filter((j) => _isRelevantJob(j, profile))
    .slice(0, CONFIG.APIS.REMOTEOK.MAX_RESULTS);
}

/**
 * Fetches from Adzuna API (requires free API key in config.js).
 * Returns India-specific jobs. Only called when ADZUNA.ENABLED is true.
 * Uses local proxy caching (/api/adzuna) in dev, and direct API in production.
 * @param {Object} profile
 * @returns {Promise<Job[]>}
 */
async function fetchAdzunaJobs(profile) {
  const cfg = CONFIG.APIS.ADZUNA;
  if (!cfg.ENABLED || !cfg.APP_ID || !cfg.APP_KEY) return [];

  let whatTerm = (profile.jobTitle || 'developer').trim();
  if (profile.experience === 'internship' || profile.jobType === 'internship') {
    whatTerm = `${whatTerm} intern`.trim();
  } else if (profile.experience === '5-10' || profile.experience === '10+') {
    whatTerm = `senior ${whatTerm}`.trim();
  }

  const queryParams = new URLSearchParams({
    app_id:          cfg.APP_ID,
    app_key:         cfg.APP_KEY,
    results_per_page:cfg.MAX_RESULTS,
    what:            whatTerm,
    sort_by:         'relevance',
    'content-type':  'application/json',
  });

  const loc = (profile.location || '').trim();
  if (loc && loc.toLowerCase() !== 'remote' && loc.toLowerCase() !== 'india') {
    queryParams.set('where', loc);
  }

  const searchStr = `?${queryParams.toString()}`;
  let data;

  // 1. Try local proxy first ONLY if running locally (preserves quota during local iteration)
  if (_isLocalDev() && cfg.PROXY_URL) {
    try {
      data = await AsyncUtils.fetchJSON(`${cfg.PROXY_URL}${searchStr}`, {}, 8000);
    } catch (proxyErr) {
      console.warn('[Adzuna] Proxy fetch failed, trying direct:', proxyErr.message);
    }
  }

  // 2. Direct fetch fallback / production direct fetch (Adzuna supports CORS Access-Control-Allow-Origin: *)
  if (!data) {
    try {
      const url = `${cfg.BASE_URL}${searchStr}`;
      data = await AsyncUtils.fetchJSON(url, { headers: { 'Accept': 'application/json' } }, 8000);
    } catch (directErr) {
      console.warn('[Adzuna] Direct fetch failed:', directErr.message);
      return [];
    }
  }

  if (!Array.isArray(data?.results)) return [];
  return data.results.map(_normalizeAdzuna).filter((j) => _isRelevantJob(j, profile));
}

/**
 * Fetches from JSearch (RapidAPI) — aggregates LinkedIn, Indeed, Glassdoor.
 * Requires a RapidAPI key in config.js. Only called when JSEARCH.ENABLED is true.
 * @param {Object} profile
 * @returns {Promise<Job[]>}
 */
async function fetchJSearchJobs(profile) {
  const cfg = CONFIG.APIS.JSEARCH;
  if (!cfg.ENABLED || !cfg.API_KEY) return [];

  let expTerm = '';
  if (profile.experience === 'internship' || profile.jobType === 'internship') {
    expTerm = 'internship';
  } else if (profile.experience === '0-1' || profile.experience === 'fresher') {
    expTerm = 'entry level fresher';
  } else if (profile.experience === '5-10' || profile.experience === '10+') {
    expTerm = 'senior';
  }

  const query  = `${profile.jobTitle || 'developer'} ${expTerm} in ${profile.location || 'India'}`.replace(/\s+/g, ' ').trim();
  const params = new URLSearchParams({ query, page: '1', num_pages: '1' });
  const url    = `${cfg.BASE_URL}?${params}`;

  const data = await AsyncUtils.fetchJSON(url, {
    headers: {
      'X-RapidAPI-Key':  cfg.API_KEY,
      'X-RapidAPI-Host': 'jsearch.p.rapidapi.com',
    },
  });

  if (!Array.isArray(data?.data)) return [];
  return data.data
    .map(_normalizeJSearch)
    .filter((j) => _isRelevantJob(j, profile))
    .slice(0, cfg.MAX_RESULTS);
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Main job search — runs all enabled API fetchers concurrently,
 * normalizes & deduplicates results, then sorts by match score.
 * Never throws — failed API sources are silently skipped.
 * @param {Object} profile - user job search profile
 * @returns {Promise<Job[]>} sorted by matchScore descending
 */
async function searchJobs(profile) {
  // Build list of active fetchers (free always on; keyed APIs conditional)
  const fetchers = [
    AsyncUtils.retry(() => fetchRemotiveJobs(profile), 2),
    AsyncUtils.retry(() => fetchRemoteOKJobs(profile), 2),
    // Phase 2: Adzuna + JSearch — enabled when API keys are present in config.js
    fetchAdzunaJobs(profile),
    fetchJSearchJobs(profile),
  ];

  const settled = await AsyncUtils.allSettled(fetchers);

  // Flatten successful results; skip failed sources
  const allJobs = settled
    .filter((r) => r.status === 'fulfilled')
    .flatMap((r) => r.value || []);

  // Log any failed sources for debugging (non-blocking)
  settled
    .filter((r) => r.status === 'rejected')
    .forEach((r) => console.warn('[JobSearch] A source failed:', r.reason?.message));

  // Deduplicate by normalized title + company (same job may appear on multiple sources)
  const seen   = new Set();
  const unique = allJobs.filter((job) => {
    const key = `${StringUtils.normalize(job.title)}-${StringUtils.normalize(job.company)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // Score and sort
  return unique
    .map((job) => ({ ...job, matchScore: computeMatchScore(job, profile) }))
    .sort((a, b) => b.matchScore - a.matchScore);
}
