/**
 * @file config.js
 * @description Centralized application configuration.
 *              All API endpoints, platform URLs, constants, and feature flags live here.
 *              Follows the Single Source of Truth principle — never hardcode these elsewhere.
 */

const CONFIG = Object.freeze({

  // ─── App Meta ─────────────────────────────────────────────────────────────
  APP: {
    NAME: 'FindMeAJob',
    VERSION: '1.0.0',
    TAGLINE: 'Your Dream Job, Found in Seconds',
  },

  // ─── Storage Keys ─────────────────────────────────────────────────────────
  STORAGE: {
    USER_PROFILE_KEY: 'fmaj_user_profile',
    JOB_RESULTS_KEY:  'fmaj_job_results',
    APP_SETTINGS_KEY: 'fmaj_app_settings',
    RESULT_TTL_HOURS: 24,          // Results expire after 24 hours
    MAX_SAVED_JOBS:   500,          // IndexedDB cap
    BOOKMARK_COUNT_KEY: 'fmaj_bookmark_count', // Fast count cache
  },

  // ─── Job APIs (CORS-friendly, no auth required or free key) ───────────────
  APIS: {
    REMOTIVE: {
      BASE_URL:    'https://remotive.com/api/remote-jobs',
      PROXY_URL:   '/api/remotive',
      CATEGORIES: ['software-dev', 'devops', 'data', 'qa', 'product', 'design', 'marketing', 'finance'],
      MAX_RESULTS: 50,
    },
    REMOTEOK: {
      BASE_URL:    'https://remoteok.com/api',
      PROXY_URL:   '/api/remoteok',
      MAX_RESULTS: 50,
    },
    // Adzuna: free API keys from https://developer.adzuna.com (1000 req/day)
    ADZUNA: {
      BASE_URL:    'https://api.adzuna.com/v1/api/jobs/in/search/1',
      PROXY_URL:   '/api/adzuna',
      APP_ID:      '071fbcc3',
      APP_KEY:     '6bb4a11628010da0919563e5bfcfeb69',
      ENABLED:     true,
      MAX_RESULTS: 20,
    },
    // JSearch via RapidAPI — aggregates LinkedIn, Indeed, Glassdoor
    // Free tier: 100 requests/month from https://rapidapi.com/letscrape-6baf0d461a99/api/jsearch
    JSEARCH: {
      BASE_URL:    'https://jsearch.p.rapidapi.com/search',
      API_KEY:     '',   // → paste your RapidAPI key here
      ENABLED:     false, // auto-enabled when API_KEY is filled above
      MAX_RESULTS: 10,
    },
  },

  // ─── Platform Deep-Link Builders ──────────────────────────────────────────
  PLATFORMS: {
    NAUKRI: {
      name:    'Naukri',
      logo:    '🟠',
      color:   '#FF7555',
      baseUrl: 'https://www.naukri.com',
      description: 'India\'s #1 job portal',
    },
    LINKEDIN: {
      name:    'LinkedIn',
      logo:    '🔵',
      color:   '#0A66C2',
      baseUrl: 'https://www.linkedin.com/jobs/search',
      description: 'Professional network jobs',
      // Experience level codes used by LinkedIn filters
      EXP_CODES: {
        'fresher':       '2', // Entry level
        '0-1':           '2',
        '1-2':           '2',
        '1-3':           '2',
        '2-5':           '3', // Associate
        '3-5':           '3',
        '5-10':          '4', // Mid-Senior
        '10+':           '5', // Director
        'internship':    '1',
      },
      // Work type codes
      WORK_TYPE_CODES: {
        'remote':  '2',
        'hybrid':  '3',
        'on-site': '1',
        'onsite':  '1',
      },
    },
    INDEED: {
      name:    'Indeed',
      logo:    '🟣',
      color:   '#2164F3',
      baseUrl: 'https://in.indeed.com/jobs',
      description: 'Millions of jobs worldwide',
    },
    INTERNSHALA: {
      name:    'Internshala',
      logo:    '🟢',
      color:   '#1BAA7B',
      baseUrl: 'https://internshala.com',
      description: 'Best for students & freshers',
    },
    SHINE: {
      name:    'Shine',
      logo:    '🟡',
      color:   '#F5B800',
      baseUrl: 'https://www.shine.com/job-search',
      description: 'HindustanTimes job portal',
    },
    GLASSDOOR: {
      name:    'Glassdoor',
      logo:    '🟤',
      color:   '#0CAA41',
      baseUrl: 'https://www.glassdoor.co.in/Job/index.htm',
      description: 'Jobs + salary insights',
    },
  },

  // ─── Experience Level Options ──────────────────────────────────────────────
  EXPERIENCE_OPTIONS: [
    { value: 'internship', label: 'Internship / Student' },
    { value: '0-1',        label: 'Fresher (0–1 Years)' },
    { value: '1-3',        label: '1–3 Years' },
    { value: '3-5',        label: '3–5 Years' },
    { value: '5-10',       label: '5–10 Years' },
    { value: '10+',        label: '10+ Years' },
  ],

  // ─── Work Mode Options ────────────────────────────────────────────────────
  WORK_MODE_OPTIONS: [
    { value: 'remote',   label: '🏠 Remote' },
    { value: 'hybrid',   label: '🏢 Hybrid' },
    { value: 'on-site',  label: '🏙️ On-Site' },
    { value: 'any',      label: '✨ Any' },
  ],

  // ─── Job Type Options ────────────────────────────────────────────────────
  JOB_TYPE_OPTIONS: [
    { value: 'full_time',   label: 'Full-time' },
    { value: 'part_time',   label: 'Part-time' },
    { value: 'internship',  label: 'Internship' },
    { value: 'contract',    label: 'Contract' },
    { value: 'freelance',   label: 'Freelance' },
  ],

  // ─── Match Score Weights (sum = 100) ─────────────────────────────────────
  MATCH_WEIGHTS: {
    TITLE_MATCH:      35,
    SKILLS_OVERLAP:   40,
    LOCATION_MATCH:   15,
    JOB_TYPE_MATCH:   10,
  },

  // ─── Common Skill Suggestions (for autocomplete tag input) ────────────────
  SKILL_SUGGESTIONS: [
    'JavaScript', 'TypeScript', 'React', 'Vue.js', 'Angular', 'Node.js',
    'Python', 'Django', 'Flask', 'FastAPI', 'Java', 'Spring Boot',
    'C++', 'C#', '.NET', 'PHP', 'Laravel', 'Ruby on Rails',
    'SQL', 'MySQL', 'PostgreSQL', 'MongoDB', 'Redis', 'Firebase',
    'HTML', 'CSS', 'Tailwind CSS', 'SASS', 'Bootstrap',
    'AWS', 'Azure', 'GCP', 'Docker', 'Kubernetes', 'CI/CD',
    'Git', 'REST API', 'GraphQL', 'Machine Learning', 'Data Analysis',
    'React Native', 'Flutter', 'Swift', 'Kotlin', 'Android', 'iOS',
    'DevOps', 'Linux', 'Agile', 'Scrum', 'Figma', 'UI/UX',
  ],

  // ─── Location Suggestions (India-focused) ────────────────────────────────
  LOCATION_SUGGESTIONS: [
    'Remote', 'Bangalore', 'Mumbai', 'Delhi', 'Hyderabad', 'Pune',
    'Chennai', 'Kolkata', 'Ahmedabad', 'Jaipur', 'Noida', 'Gurgaon',
    'Chandigarh', 'Kochi', 'Indore', 'Bhopal', 'Lucknow', 'Nagpur',
  ],

  // ─── Pagination ───────────────────────────────────────────────────────────
  PAGINATION: {
    JOBS_PER_PAGE: 12,
  },
});
