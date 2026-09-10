/**
 * @file resumeParser.js
 * @description Extracts text and infers profile fields from uploaded PDF/DOCX resumes.
 *              Runs entirely in the browser — no data is ever uploaded to a server.
 *              Uses PDF.js (CDN) for PDF parsing.
 * @module resumeParser
 * @dependency pdf.js (loaded via CDN in HTML)
 */

'use strict';

// ─── Constants ────────────────────────────────────────────────────────────────

/**
 * Regex patterns for extracting common resume fields.
 * Defined once here — referenced by all extractor functions below (DRY).
 */
const RESUME_PATTERNS = {
  EMAIL:   /[\w.+-]+@[\w-]+\.[a-zA-Z]{2,}/,
  PHONE:   /(?:\+91[-\s]?)?[6-9]\d{9}/,
  // Experience in years: "3 years", "3+ years", "3 yrs"
  EXP_YEARS: /(\d+)\+?\s*(?:years?|yrs?)(?:\s*of)?\s*(?:experience|exp)?/i,
  // LinkedIn URL
  LINKEDIN: /linkedin\.com\/in\/[\w-]+/i,
  // GitHub URL
  GITHUB:   /github\.com\/[\w-]+/i,
  // Known Job Titles (Broader heuristic)
  JOB_TITLES: /\b(?:Senior|Junior|Lead|Principal|Chief)?\s*(?:Software|Frontend|Backend|Full Stack|Mobile|Web|iOS|Android|Data|DevOps|QA|Cloud|Security|Systems|Network)?\s*(?:Engineer|Developer|Programmer|Scientist|Analyst|Manager|Designer|Consultant|Architect|Administrator)\b/i,
  // Known Locations (India/Remote)
  LOCATIONS: /\b(Bangalore|Bengaluru|Pune|Mumbai|New Delhi|Delhi|Hyderabad|Chennai|Kolkata|Ahmedabad|Remote)\b/i,
};

/**
 * Comprehensive list of skills to scan for in resume text.
 * Ordered roughly by frequency for early-match performance.
 * @type {string[]}
 */
const SCANNABLE_SKILLS = [
  // Languages
  'JavaScript', 'TypeScript', 'Python', 'Java', 'C++', 'C#', 'C',
  'PHP', 'Ruby', 'Go', 'Rust', 'Kotlin', 'Swift', 'Dart', 'Scala',
  // Frontend
  'React', 'Vue.js', 'Vue', 'Angular', 'Next.js', 'Nuxt.js', 'Svelte',
  'HTML', 'CSS', 'SASS', 'SCSS', 'Tailwind', 'Bootstrap', 'jQuery',
  // Backend
  'Node.js', 'Express', 'Django', 'Flask', 'FastAPI', 'Spring Boot',
  'Spring', 'Laravel', 'Rails', 'ASP.NET', '.NET',
  // Databases
  'MySQL', 'PostgreSQL', 'MongoDB', 'Redis', 'SQLite', 'Oracle',
  'Firebase', 'Supabase', 'DynamoDB', 'Cassandra', 'Elasticsearch',
  // Cloud / DevOps
  'AWS', 'Azure', 'GCP', 'Docker', 'Kubernetes', 'CI/CD', 'Jenkins',
  'GitHub Actions', 'Terraform', 'Ansible', 'Nginx',
  // Mobile
  'React Native', 'Flutter', 'Android', 'iOS', 'Xamarin',
  // Data / AI
  'Machine Learning', 'Deep Learning', 'TensorFlow', 'PyTorch', 'Keras',
  'Pandas', 'NumPy', 'Scikit-learn', 'OpenCV', 'NLP',
  // Tools / Other
  'Git', 'REST API', 'GraphQL', 'WebSocket', 'Microservices',
  'Agile', 'Scrum', 'Jira', 'Figma', 'Photoshop', 'Linux', 'Bash',
  'SQL', 'NoSQL', 'Postman', 'Swagger',
];

// ─── Core: Text Extraction ────────────────────────────────────────────────────

/**
 * Reads a File object and returns its full text content.
 * Dispatches to the correct parser based on file type.
 * @param {File} file - PDF or DOCX file
 * @returns {Promise<string>} full plain-text content
 * @throws {Error} if file type is unsupported or parsing fails
 */
async function extractTextFromFile(file) {
  if (!Validator.isValidFile(file, ['pdf', 'doc', 'docx'])) {
    throw new Error('Unsupported file type. Please upload a PDF or DOCX file.');
  }
  if (!Validator.isValidFileSize(file, 5)) {
    throw new Error('File size exceeds 5 MB. Please upload a smaller file.');
  }

  const ext = file.name.split('.').pop().toLowerCase();

  if (ext === 'pdf') return _extractFromPDF(file);
  if (ext === 'docx' || ext === 'doc') return _extractFromDOCX(file);

  throw new Error(`Unsupported extension: .${ext}`);
}

/**
 * Extracts text from a PDF using pdf.js.
 * Reads all pages and concatenates their text content.
 * @param {File} file
 * @returns {Promise<string>}
 * @private
 */
async function _extractFromPDF(file) {
  if (typeof pdfjsLib === 'undefined') {
    throw new Error('PDF.js library not loaded. Check your internet connection.');
  }

  const arrayBuffer = await file.arrayBuffer();
  const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
  const pdf         = await loadingTask.promise;

  const pageTexts = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page    = await pdf.getPage(i);
    const content = await page.getTextContent();
    // Join text items with space; separate logical rows with newline
    const pageText = content.items
      .map((item) => item.str)
      .join(' ')
      .replace(/\s{3,}/g, '\n'); // collapse excessive whitespace
    pageTexts.push(pageText);
  }

  return pageTexts.join('\n');
}

/**
 * Extracts text from a DOCX file by reading the raw XML.
 * Uses a simple XML text-node extraction (no heavy library needed for plain text).
 * @param {File} file
 * @returns {Promise<string>}
 * @private
 */
async function _extractFromDOCX(file) {
  if (typeof mammoth === 'undefined') {
    throw new Error('Mammoth.js library not loaded. Check your internet connection.');
  }
  
  try {
    const arrayBuffer = await file.arrayBuffer();
    const result = await mammoth.extractRawText({ arrayBuffer });
    return result.value || '';
  } catch (err) {
    throw new Error(`Could not read DOCX file: ${err.message}`);
  }
}

// ─── Field Extractors ─────────────────────────────────────────────────────────

/**
 * Extracts an email address from resume text.
 * @param {string} text
 * @returns {string|null}
 */
function extractEmail(text) {
  const match = text.match(RESUME_PATTERNS.EMAIL);
  return match ? match[0].toLowerCase() : null;
}

/**
 * Extracts a phone number (Indian format) from resume text.
 * @param {string} text
 * @returns {string|null}
 */
function extractPhone(text) {
  const match = text.match(RESUME_PATTERNS.PHONE);
  return match ? match[0].replace(/\s|-/g, '') : null;
}

/**
 * Extracts years of experience mentioned in the resume.
 * @param {string} text
 * @returns {string|null} e.g. '3' (years), or null
 */
function extractExperience(text) {
  const match = text.match(RESUME_PATTERNS.EXP_YEARS);
  if (!match) return null;
  const years = parseInt(match[1], 10);
  // Map numeric years to CONFIG experience option values
  if (years === 0)       return '0-1';
  if (years <= 1)        return '0-1';
  if (years <= 3)        return '1-3';
  if (years <= 5)        return '3-5';
  if (years <= 10)       return '5-10';
  return '10+';
}

/**
 * Scans resume text for known skill keywords (case-insensitive word-boundary match).
 * @param {string} text
 * @returns {string[]} matched skill names (original casing from SCANNABLE_SKILLS)
 */
function extractSkills(text) {
  const lowerText = text.toLowerCase();
  return SCANNABLE_SKILLS.filter((skill) => {
    // Escape dots/plusses for regex (e.g., "C++", "Vue.js")
    const escaped = skill.replace(/[.+]/g, '\\$&');
    const pattern = new RegExp(`\\b${escaped}\\b`, 'i');
    return pattern.test(lowerText);
  });
}

/**
 * Attempts to infer the candidate's name from the first line of resume text.
 * Assumes name appears at the top (common resume format).
 * @param {string} text
 * @returns {string|null}
 */
function extractName(text) {
  // First non-empty line that is 2-4 words and has no numbers/special chars
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  for (const line of lines.slice(0, 5)) {
    const words = line.split(/\s+/);
    if (words.length >= 2 && words.length <= 5 && /^[A-Za-z\s.]+$/.test(line)) {
      return StringUtils.capitalize(line.toLowerCase());
    }
  }
  return null;
}

/**
 * Extracts LinkedIn profile URL from text.
 * @param {string} text
 * @returns {string|null}
 */
function extractLinkedIn(text) {
  const match = text.match(RESUME_PATTERNS.LINKEDIN);
  return match ? `https://www.${match[0]}` : null;
}

/**
 * Extracts a likely job title from the text based on common patterns.
 * @param {string} text
 * @returns {string|null}
 */
function extractJobTitle(text) {
  const match = text.match(RESUME_PATTERNS.JOB_TITLES);
  return match ? match[0] : null;
}

/**
 * Extracts a likely location from the text.
 * @param {string} text
 * @returns {string|null}
 */
function extractLocation(text) {
  const match = text.match(RESUME_PATTERNS.LOCATIONS);
  return match ? match[0] : null;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Master resume parser — extracts all fields from an uploaded file.
 * Returns a partial profile object suitable for auto-filling the form.
 * @param {File} file - resume file (PDF or DOCX)
 * @returns {Promise<{
 *   name: string|null,
 *   email: string|null,
 *   phone: string|null,
 *   skills: string[],
 *   experience: string|null,
 *   linkedin: string|null,
 *   rawText: string
 * }>}
 */
async function parseResume(file) {
  const rawText = await extractTextFromFile(file);

  return {
    name:       extractName(rawText),
    email:      extractEmail(rawText),
    phone:      extractPhone(rawText),
    skills:     extractSkills(rawText),
    experience: extractExperience(rawText),
    linkedin:   extractLinkedIn(rawText),
    jobTitle:   extractJobTitle(rawText),
    location:   extractLocation(rawText),
    rawText,    // stored for match scoring against job descriptions
  };
}
