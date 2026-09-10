/**
 * @file bookmarkManager.js
 * @description Manages saved/bookmarked jobs using a dedicated IndexedDB store.
 *              Intentionally separate from storage.js to keep concerns isolated.
 *              All operations are async and return Promises.
 * @module bookmarkManager
 */

'use strict';

// ─── IndexedDB Setup ──────────────────────────────────────────────────────────

const BOOKMARK_DB_NAME    = 'FindMeAJob_Bookmarks_DB';
const BOOKMARK_DB_VERSION = 1;
const BOOKMARK_STORE      = 'bookmarks';

/** @type {IDBDatabase|null} cached DB connection */
let _bookmarkDB = null;

/**
 * Opens (or returns cached) bookmark IndexedDB connection.
 * @returns {Promise<IDBDatabase>}
 */
async function _openBookmarkDB() {
  if (_bookmarkDB) return _bookmarkDB;

  return new Promise((resolve, reject) => {
    const req = indexedDB.open(BOOKMARK_DB_NAME, BOOKMARK_DB_VERSION);

    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(BOOKMARK_STORE)) {
        const store = db.createObjectStore(BOOKMARK_STORE, { keyPath: 'id' });
        // Index by savedAt so we can retrieve in saved order
        store.createIndex('savedAt', 'savedAt', { unique: false });
      }
    };

    req.onsuccess = (e) => { _bookmarkDB = e.target.result; resolve(_bookmarkDB); };
    req.onerror   = (e) => reject(new Error(`Bookmark DB open failed: ${e.target.error}`));
  });
}

/**
 * DRY helper: wraps an IDBRequest in a Promise.
 * @param {IDBRequest} request
 * @returns {Promise<*>}
 */
function _bPromise(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = (e) => resolve(e.target.result);
    request.onerror   = (e) => reject(new Error(e.target.error));
  });
}

/**
 * Internal helper — gets the bookmark object store transaction.
 * @param {'readonly'|'readwrite'} mode
 * @returns {Promise<IDBObjectStore>}
 */
async function _bookmarkStore(mode) {
  const db = await _openBookmarkDB();
  return db.transaction(BOOKMARK_STORE, mode).objectStore(BOOKMARK_STORE);
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Saves a job to the bookmarks store.
 * If the job is already bookmarked, it is overwritten (idempotent).
 * @param {import('./jobSearch.js').Job} job
 * @returns {Promise<void>}
 */
async function addBookmark(job) {
  const store = await _bookmarkStore('readwrite');
  await _bPromise(store.put({ ...job, savedAt: new Date().toISOString() }));
}

/**
 * Removes a job from bookmarks by its ID.
 * No-op if the job wasn't bookmarked.
 * @param {string} jobId
 * @returns {Promise<void>}
 */
async function removeBookmark(jobId) {
  const store = await _bookmarkStore('readwrite');
  await _bPromise(store.delete(jobId));
}

/**
 * Toggles a job's bookmark state.
 * Adds if not bookmarked, removes if bookmarked.
 * @param {import('./jobSearch.js').Job} job
 * @returns {Promise<boolean>} true if job is now bookmarked, false if removed
 */
async function toggleBookmark(job) {
  const currently = await isBookmarked(job.id);
  if (currently) {
    await removeBookmark(job.id);
    return false;
  } else {
    await addBookmark(job);
    return true;
  }
}

/**
 * Checks whether a job is currently bookmarked.
 * @param {string} jobId
 * @returns {Promise<boolean>}
 */
async function isBookmarked(jobId) {
  const store = await _bookmarkStore('readonly');
  const result = await _bPromise(store.get(jobId));
  return !!result;
}

/**
 * Retrieves all bookmarked jobs, ordered by most recently saved.
 * @returns {Promise<import('./jobSearch.js').Job[]>}
 */
async function getAllBookmarks() {
  const store = await _bookmarkStore('readonly');
  const all   = await _bPromise(store.getAll());
  // Sort: newest bookmark first
  return all.sort((a, b) => new Date(b.savedAt) - new Date(a.savedAt));
}

/**
 * Returns the total count of bookmarked jobs.
 * @returns {Promise<number>}
 */
async function getBookmarkCount() {
  const store = await _bookmarkStore('readonly');
  return _bPromise(store.count());
}

/**
 * Fetches all bookmarked job IDs as a Set for fast O(1) lookups.
 * Used to batch-check which cards to render as bookmarked.
 * @returns {Promise<Set<string>>}
 */
async function getBookmarkedIds() {
  const all = await getAllBookmarks();
  return new Set(all.map((j) => j.id));
}

/**
 * Clears all bookmarks.
 * @returns {Promise<void>}
 */
async function clearAllBookmarks() {
  const store = await _bookmarkStore('readwrite');
  await _bPromise(store.clear());
}
