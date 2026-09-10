/**
 * @file storage.js
 * @description Unified storage manager using localStorage for profile/settings
 *              and IndexedDB for large job result sets.
 *              Abstracts all persistence logic — no other file should call
 *              localStorage/indexedDB directly.
 * @module storage
 */

'use strict';

// ─── IndexedDB Setup ──────────────────────────────────────────────────────────

const DB_NAME    = 'FindMeAJob_DB';
const DB_VERSION = 1;
const STORE_NAME = 'job_results';

/** @type {IDBDatabase|null} Cached DB connection */
let _db = null;

/**
 * Opens (or returns cached) IndexedDB connection.
 * Creates object store on first run.
 * @returns {Promise<IDBDatabase>}
 */
async function openDB() {
  if (_db) return _db;

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        // keyPath: 'id' — every job object must have a unique 'id' field
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('platform', 'platform', { unique: false });
        store.createIndex('savedAt', 'savedAt', { unique: false });
      }
    };

    request.onsuccess  = (e) => { _db = e.target.result; resolve(_db); };
    request.onerror    = (e) => reject(new Error(`IndexedDB open failed: ${e.target.error}`));
  });
}

/**
 * Wraps an IDB request in a Promise.
 * DRY helper — avoids repeating onsuccess/onerror boilerplate.
 * @param {IDBRequest} request
 * @returns {Promise<*>}
 */
function idbPromise(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = (e) => resolve(e.target.result);
    request.onerror   = (e) => reject(new Error(e.target.error));
  });
}

// ─── Job Results (IndexedDB) ──────────────────────────────────────────────────

/**
 * Saves an array of job objects to IndexedDB.
 * Replaces existing entries with the same ID.
 * @param {Object[]} jobs - array of job objects (must each have an 'id' field)
 * @returns {Promise<void>}
 */
async function saveJobs(jobs) {
  const db   = await openDB();
  const tx   = db.transaction(STORE_NAME, 'readwrite');
  const store = tx.objectStore(STORE_NAME);
  const timestamped = jobs.map((job) => ({ ...job, savedAt: new Date().toISOString() }));
  await Promise.all(timestamped.map((job) => idbPromise(store.put(job))));
}

/**
 * Retrieves all stored jobs from IndexedDB.
 * @returns {Promise<Object[]>}
 */
async function getAllJobs() {
  const db   = await openDB();
  const tx   = store_tx(db, 'readonly');
  return idbPromise(tx.getAll());
}

/**
 * Clears all stored job results from IndexedDB.
 * @returns {Promise<void>}
 */
async function clearJobs() {
  const db   = await openDB();
  const tx   = store_tx(db, 'readwrite');
  await idbPromise(tx.clear());
}

/**
 * Returns count of stored jobs.
 * @returns {Promise<number>}
 */
async function getJobCount() {
  const db = await openDB();
  const tx = store_tx(db, 'readonly');
  return idbPromise(tx.count());
}

/**
 * Internal helper — creates a transaction and returns the object store.
 * @param {IDBDatabase} db
 * @param {'readonly'|'readwrite'} mode
 * @returns {IDBObjectStore}
 */
function store_tx(db, mode) {
  return db.transaction(STORE_NAME, mode).objectStore(STORE_NAME);
}

// ─── User Profile (localStorage) ─────────────────────────────────────────────

/**
 * Saves the user's job search profile to localStorage.
 * @param {Object} profile - user profile data
 * @returns {void}
 */
function saveProfile(profile) {
  try {
    const payload = { ...profile, lastUpdated: new Date().toISOString() };
    localStorage.setItem(CONFIG.STORAGE.USER_PROFILE_KEY, JSON.stringify(payload));
  } catch (err) {
    console.error('[Storage] Failed to save profile:', err);
  }
}

/**
 * Loads the user's profile from localStorage.
 * @returns {Object|null} profile object or null if not found
 */
function loadProfile() {
  try {
    const raw = localStorage.getItem(CONFIG.STORAGE.USER_PROFILE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (err) {
    console.error('[Storage] Failed to parse profile:', err);
    return null;
  }
}

/**
 * Checks if the profile exists in storage.
 * @returns {boolean}
 */
function hasProfile() {
  return !!localStorage.getItem(CONFIG.STORAGE.USER_PROFILE_KEY);
}

// ─── Job Result Metadata (localStorage) ──────────────────────────────────────
// We store lightweight metadata (timestamp, count, search query) in localStorage
// while full job objects live in IndexedDB.

/**
 * Saves job result metadata (timestamp, count, query).
 * @param {Object} meta - { count, query, fetchedAt }
 */
function saveResultMeta(meta) {
  try {
    localStorage.setItem(
      CONFIG.STORAGE.JOB_RESULTS_KEY,
      JSON.stringify({ ...meta, fetchedAt: new Date().toISOString() })
    );
  } catch (err) {
    console.error('[Storage] Failed to save result meta:', err);
  }
}

/**
 * Loads job result metadata from localStorage.
 * @returns {Object|null}
 */
function loadResultMeta() {
  try {
    const raw = localStorage.getItem(CONFIG.STORAGE.JOB_RESULTS_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (err) {
    return null;
  }
}

/**
 * Checks if stored results are still valid (within TTL hours and matching query and experience).
 * @param {string} [expectedQuery] - if provided, verifies search query matches
 * @param {string} [expectedExperience] - if provided, verifies experience level matches
 * @returns {boolean} true if results are fresh, false if expired/missing/mismatched
 */
function areResultsFresh(expectedQuery, expectedExperience) {
  const meta = loadResultMeta();
  if (!meta?.fetchedAt) return false;
  if (expectedQuery && meta.query && meta.query.toLowerCase().trim() !== expectedQuery.toLowerCase().trim()) {
    return false;
  }
  if (expectedExperience !== undefined && meta.experience !== undefined && meta.experience !== expectedExperience) {
    return false;
  }
  return !DateUtils.isExpired(meta.fetchedAt, CONFIG.STORAGE.RESULT_TTL_HOURS);
}

// ─── App Settings (localStorage) ─────────────────────────────────────────────

/**
 * Loads app settings (dark mode, etc.) from localStorage.
 * Falls back to default settings if not stored.
 * @returns {Object}
 */
function loadSettings() {
  const defaults = { darkMode: true, resultsPerPage: CONFIG.PAGINATION.JOBS_PER_PAGE };
  try {
    const raw = localStorage.getItem(CONFIG.STORAGE.APP_SETTINGS_KEY);
    return raw ? { ...defaults, ...JSON.parse(raw) } : defaults;
  } catch (err) {
    return defaults;
  }
}

/**
 * Saves app settings to localStorage.
 * @param {Object} settings
 */
function saveSettings(settings) {
  try {
    const current = loadSettings();
    localStorage.setItem(CONFIG.STORAGE.APP_SETTINGS_KEY, JSON.stringify({ ...current, ...settings }));
  } catch (err) {
    console.error('[Storage] Failed to save settings:', err);
  }
}

// ─── Nuclear Option ───────────────────────────────────────────────────────────

/**
 * Clears ALL application data — profile, results, settings.
 * Used by the "Clear My Data" privacy button.
 * @returns {Promise<void>}
 */
async function clearAllData() {
  localStorage.removeItem(CONFIG.STORAGE.USER_PROFILE_KEY);
  localStorage.removeItem(CONFIG.STORAGE.JOB_RESULTS_KEY);
  localStorage.removeItem(CONFIG.STORAGE.APP_SETTINGS_KEY);
  await clearJobs();
  if (typeof clearAllBookmarks === 'function') {
    await clearAllBookmarks();
  }
}

/**
 * Returns total storage usage info (approximate).
 * @returns {Object} { localStorageKB, idbJobCount }
 */
async function getStorageInfo() {
  let localStorageKB = 0;
  try {
    let total = 0;
    for (const key of Object.values(CONFIG.STORAGE)) {
      if (typeof key !== 'string') continue;
      const val = localStorage.getItem(key);
      if (val) total += val.length;
    }
    localStorageKB = (total * 2) / 1024; // UTF-16 chars = 2 bytes each
  } catch (_) {}

  const idbJobCount = await getJobCount().catch(() => 0);
  return { localStorageKB: localStorageKB.toFixed(2), idbJobCount };
}
