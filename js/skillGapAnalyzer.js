/**
 * @file skillGapAnalyzer.js
 * @description Analyzes the gap between user's current skills and
 *              the skills demanded across job listings.
 *              All logic is pure (no DOM/side-effects) — easy to test.
 * @module skillGapAnalyzer
 */

'use strict';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Extracts all skill-like tokens from a job's tags + description.
 * Normalizes to lowercase for consistent comparison.
 * @param {import('./jobSearch.js').Job} job
 * @returns {string[]} lowercase skill tokens
 */
function _extractJobSkills(job) {
  const tagSkills  = (job.tags || []).map(StringUtils.normalize);
  // Also mine description for skill mentions using the known skill list
  const descSkills = CONFIG.SKILL_SUGGESTIONS
    .filter((s) => StringUtils.contains(job.description || '', s))
    .map(StringUtils.normalize);
  return ArrayUtils.unique([...tagSkills, ...descSkills]);
}

/**
 * Normalizes a user skills array to lowercase for comparison.
 * @param {string[]} userSkills
 * @returns {string[]}
 */
function _normalizeUserSkills(userSkills) {
  return (userSkills || []).map(StringUtils.normalize);
}

// ─── Per-Job Analysis ─────────────────────────────────────────────────────────

/**
 * Returns the list of skills a job requires that the user is missing.
 * @param {string[]} userSkills  - user's skills (raw, any case)
 * @param {import('./jobSearch.js').Job} job
 * @returns {string[]} missing skill names (from job's tag casing)
 */
function getMissingSkillsForJob(userSkills, job) {
  const normalizedUser = _normalizeUserSkills(userSkills);
  const jobSkills      = (job.tags || []);

  return jobSkills.filter(
    (tag) => !normalizedUser.some((us) =>
      StringUtils.normalize(tag).includes(us) || us.includes(StringUtils.normalize(tag))
    )
  );
}

/**
 * Calculates how much of a job's required skills the user already has.
 * Returns a percentage 0–100.
 * @param {string[]} userSkills
 * @param {import('./jobSearch.js').Job} job
 * @returns {number} coverage percentage (integer)
 */
function getSkillCoverage(userSkills, job) {
  const jobSkills = _extractJobSkills(job);
  if (jobSkills.length === 0) return 100; // No skills listed — treat as full match

  const normalizedUser = _normalizeUserSkills(userSkills);
  const matched = jobSkills.filter((js) =>
    normalizedUser.some((us) => js.includes(us) || us.includes(js))
  );
  return Math.round((matched.length / jobSkills.length) * 100);
}

// ─── Aggregate Analysis ───────────────────────────────────────────────────────

/**
 * Returns the top N most-demanded missing skills across all jobs,
 * sorted by frequency (most demanded first).
 * @param {string[]} userSkills
 * @param {import('./jobSearch.js').Job[]} jobs
 * @param {number} [topN=12]
 * @returns {Array<{ skill: string, count: number, percentage: number }>}
 */
function getTopMissingSkills(userSkills, jobs, topN = 12) {
  const frequency = {}; // skill (lowercase) → { displayName, count }

  jobs.forEach((job) => {
    const missing = getMissingSkillsForJob(userSkills, job);
    missing.forEach((skill) => {
      const key = StringUtils.normalize(skill);
      if (!frequency[key]) frequency[key] = { displayName: skill, count: 0 };
      frequency[key].count++;
    });
  });

  const total = jobs.length || 1;
  return Object.values(frequency)
    .sort((a, b) => b.count - a.count)
    .slice(0, topN)
    .map(({ displayName, count }) => ({
      skill:      displayName,
      count,
      percentage: Math.round((count / total) * 100), // % of jobs requiring this
    }));
}

/**
 * Returns the user's strongest skills — those that appear in the most jobs.
 * @param {string[]} userSkills
 * @param {import('./jobSearch.js').Job[]} jobs
 * @param {number} [topN=6]
 * @returns {Array<{ skill: string, count: number, percentage: number }>}
 */
function getTopMatchingSkills(userSkills, jobs, topN = 6) {
  const normalizedUser = _normalizeUserSkills(userSkills);
  const frequency      = {};

  // For each user skill, count how many jobs mention it
  normalizedUser.forEach((us) => {
    const matchCount = jobs.filter((job) => {
      const jobText = StringUtils.normalize(`${job.title} ${job.description} ${job.tags.join(' ')}`);
      return jobText.includes(us);
    }).length;

    // Find the original-cased skill name
    const displayName = userSkills.find(
      (s) => StringUtils.normalize(s) === us
    ) || us;

    if (matchCount > 0) {
      frequency[us] = { displayName, count: matchCount };
    }
  });

  const total = jobs.length || 1;
  return Object.values(frequency)
    .sort((a, b) => b.count - a.count)
    .slice(0, topN)
    .map(({ displayName, count }) => ({
      skill:      displayName,
      count,
      percentage: Math.round((count / total) * 100),
    }));
}

// ─── Master Analysis ──────────────────────────────────────────────────────────

/**
 * @typedef {Object} SkillGapAnalysis
 * @property {number}   totalJobsAnalyzed
 * @property {number}   averageCoverage     - user's avg skill coverage across all jobs (0–100)
 * @property {Array}    topMissingSkills    - ranked missing skills with frequency
 * @property {Array}    topMatchingSkills   - user's strongest skills by job demand
 * @property {Array}    jobCoverages        - per-job coverage breakdown
 */

/**
 * Runs the full skill gap analysis for a user against a set of jobs.
 * This is the main public entry point for the analyzer.
 * @param {string[]} userSkills - user's skills from profile
 * @param {import('./jobSearch.js').Job[]} jobs
 * @returns {SkillGapAnalysis}
 */
function analyzeSkillGap(userSkills, jobs) {
  if (!jobs || jobs.length === 0) {
    return {
      totalJobsAnalyzed: 0,
      averageCoverage:   0,
      topMissingSkills:  [],
      topMatchingSkills: [],
      jobCoverages:      [],
    };
  }

  // Per-job coverage breakdown (top 10 for display)
  const jobCoverages = jobs
    .map((job) => ({
      id:       job.id,
      title:    job.title,
      company:  job.company,
      platform: job.platform,
      coverage: getSkillCoverage(userSkills, job),
      missing:  getMissingSkillsForJob(userSkills, job).slice(0, 4),
      url:      job.url,
    }))
    .sort((a, b) => b.coverage - a.coverage)
    .slice(0, 10);

  // Average coverage across all jobs
  const coverageSum = jobs.reduce((sum, job) => sum + getSkillCoverage(userSkills, job), 0);
  const avgCoverage = Math.round(coverageSum / jobs.length);

  return {
    totalJobsAnalyzed: jobs.length,
    averageCoverage:   avgCoverage,
    topMissingSkills:  getTopMissingSkills(userSkills, jobs, 12),
    topMatchingSkills: getTopMatchingSkills(userSkills, jobs, 6),
    jobCoverages,
  };
}
