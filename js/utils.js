/**
 * @file utils.js
 * @description Shared utility functions used across all modules.
 *              DRY principle: all reusable helpers live here — never duplicated elsewhere.
 * @module utils
 */

'use strict';

// ─── DOM Utilities ────────────────────────────────────────────────────────────

/**
 * DOM helper namespace — wraps common DOM operations for brevity and consistency.
 */
const DOM = {
  /**
   * Selects a single element. Returns null if not found.
   * @param {string} selector - CSS selector
   * @param {Element} [context=document] - search context
   * @returns {Element|null}
   */
  get: (selector, context = document) => context.querySelector(selector),

  /**
   * Selects all matching elements as an Array (not NodeList).
   * @param {string} selector - CSS selector
   * @param {Element} [context=document]
   * @returns {Element[]}
   */
  getAll: (selector, context = document) => Array.from(context.querySelectorAll(selector)),

  /**
   * Creates an element with optional attributes and inner HTML.
   * @param {string} tag - HTML tag name
   * @param {Object} [attrs={}] - attribute key-value pairs
   * @param {string} [innerHTML='']
   * @returns {HTMLElement}
   */
  create: (tag, attrs = {}, innerHTML = '') => {
    const el = document.createElement(tag);
    Object.entries(attrs).forEach(([key, val]) => {
      if (key === 'class') el.className = val;
      else if (key === 'dataset') Object.assign(el.dataset, val);
      else el.setAttribute(key, val);
    });
    el.innerHTML = innerHTML;
    return el;
  },

  /**
   * Removes all child nodes from an element.
   * @param {Element} el
   */
  empty: (el) => { while (el.firstChild) el.removeChild(el.firstChild); },

  /**
   * Shows an element by removing 'hidden' class and setting display.
   * @param {Element} el
   */
  show: (el) => { if (el) { el.classList.remove('hidden'); el.style.display = ''; } },

  /**
   * Hides an element by adding 'hidden' class.
   * @param {Element} el
   */
  hide: (el) => { if (el) el.classList.add('hidden'); },

  /**
   * Toggles a CSS class on an element.
   * @param {Element} el
   * @param {string} className
   * @param {boolean} [force]
   */
  toggleClass: (el, className, force) => el?.classList.toggle(className, force),

  /**
   * Adds an event listener with optional delegation.
   * @param {Element|string} target - element or selector string
   * @param {string} event
   * @param {Function} handler
   * @param {Element} [delegateContext=document]
   */
  on: (target, event, handler, delegateContext = document) => {
    const el = typeof target === 'string' ? delegateContext.querySelector(target) : target;
    if (el) el.addEventListener(event, handler);
  },

  /**
   * Scrolls element into view smoothly.
   * @param {Element|string} target
   */
  scrollTo: (target) => {
    const el = typeof target === 'string' ? document.querySelector(target) : target;
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  },
};

// ─── String Utilities ─────────────────────────────────────────────────────────

const StringUtils = {
  /**
   * Capitalizes the first letter of a string.
   * @param {string} str
   * @returns {string}
   */
  capitalize: (str) => (str ? str.charAt(0).toUpperCase() + str.slice(1) : ''),

  /**
   * Converts a string to kebab-case URL slug.
   * @param {string} str
   * @returns {string}
   */
  slugify: (str) => str.toLowerCase().trim().replace(/\s+/g, '-').replace(/[^\w-]/g, ''),

  /**
   * Truncates a string to a given length, appending '…'.
   * @param {string} str
   * @param {number} [maxLen=100]
   * @returns {string}
   */
  truncate: (str, maxLen = 100) => (str && str.length > maxLen ? `${str.slice(0, maxLen)}…` : str || ''),

  /**
   * Strips HTML tags from a string.
   * @param {string} html
   * @returns {string}
   */
  stripHTML: (html) => (html || '').replace(/<[^>]*>/g, ' ').replace(/\s{2,}/g, ' ').trim(),

  /**
   * Normalizes a string to lowercase, trimmed, for comparison.
   * @param {string} str
   * @returns {string}
   */
  normalize: (str) => (str || '').toLowerCase().trim(),

  /**
   * Checks if a string contains a keyword (case-insensitive).
   * @param {string} haystack
   * @param {string} needle
   * @returns {boolean}
   */
  contains: (haystack, needle) =>
    StringUtils.normalize(haystack).includes(StringUtils.normalize(needle)),

  /**
   * Extracts unique words from a block of text as lowercase tokens.
   * @param {string} text
   * @returns {string[]}
   */
  tokenize: (text) => [
    ...new Set(
      (text || '').toLowerCase()
        .replace(/[^a-z0-9\s.#\+]/g, ' ')
        .split(/\s+/)
        .filter((w) => w.length > 1)
    ),
  ],
};

// ─── Date Utilities ───────────────────────────────────────────────────────────

const DateUtils = {
  /**
   * Returns a human-readable "time ago" string.
   * @param {string|Date} dateInput
   * @returns {string} e.g. "3 days ago"
   */
  timeAgo: (dateInput) => {
    const seconds = Math.floor((Date.now() - new Date(dateInput).getTime()) / 1000);
    const intervals = [
      { label: 'year',   secs: 31536000 },
      { label: 'month',  secs: 2592000  },
      { label: 'week',   secs: 604800   },
      { label: 'day',    secs: 86400    },
      { label: 'hour',   secs: 3600     },
      { label: 'minute', secs: 60       },
    ];
    for (const { label, secs } of intervals) {
      const count = Math.floor(seconds / secs);
      if (count >= 1) return `${count} ${label}${count > 1 ? 's' : ''} ago`;
    }
    return 'Just now';
  },

  /**
   * Returns a formatted date string in DD/MM/YYYY format.
   * @param {string|Date} dateInput
   * @returns {string}
   */
  format: (dateInput) => {
    const d = new Date(dateInput);
    return isNaN(d.getTime()) ? '—' : d.toLocaleDateString('en-IN');
  },

  /**
   * Checks if a timestamp is older than a given number of hours.
   * @param {string|number} timestamp - ISO string or Unix ms
   * @param {number} [hours=24]
   * @returns {boolean}
   */
  isExpired: (timestamp, hours = 24) => {
    const diff = Date.now() - new Date(timestamp).getTime();
    return diff > hours * 60 * 60 * 1000;
  },

  /** @returns {string} current ISO timestamp */
  now: () => new Date().toISOString(),
};

// ─── Array Utilities ──────────────────────────────────────────────────────────

const ArrayUtils = {
  /**
   * Returns unique values from an array.
   * @template T
   * @param {T[]} arr
   * @returns {T[]}
   */
  unique: (arr) => [...new Set(arr)],

  /**
   * Groups an array of objects by a key.
   * @param {Object[]} arr
   * @param {string} key
   * @returns {Object.<string, Object[]>}
   */
  groupBy: (arr, key) =>
    arr.reduce((acc, item) => {
      const group = item[key] || 'Other';
      acc[group] = acc[group] || [];
      acc[group].push(item);
      return acc;
    }, {}),

  /**
   * Shuffles an array in-place using Fisher-Yates algorithm.
   * @template T
   * @param {T[]} arr
   * @returns {T[]}
   */
  shuffle: (arr) => {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  },

  /**
   * Chunks an array into subarrays of size n.
   * @template T
   * @param {T[]} arr
   * @param {number} size
   * @returns {T[][]}
   */
  chunk: (arr, size) => {
    const chunks = [];
    for (let i = 0; i < arr.length; i += size) chunks.push(arr.slice(i, i + size));
    return chunks;
  },
};

// ─── Async Utilities ──────────────────────────────────────────────────────────

const AsyncUtils = {
  /**
   * Debounces a function — delays execution until after 'delay' ms have passed
   * since the last invocation. Useful for search/input handlers.
   * @param {Function} fn
   * @param {number} [delay=300]
   * @returns {Function}
   */
  debounce: (fn, delay = 300) => {
    let timer;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn(...args), delay);
    };
  },

  /**
   * Retries an async function up to maxRetries times on failure.
   * @param {Function} fn - async function to retry
   * @param {number} [maxRetries=3]
   * @param {number} [delayMs=500]
   * @returns {Promise<*>}
   */
  retry: async (fn, maxRetries = 3, delayMs = 500) => {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await fn();
      } catch (err) {
        if (attempt === maxRetries) throw err;
        await AsyncUtils.sleep(delayMs * attempt); // exponential backoff
      }
    }
  },

  /**
   * Waits for a given duration.
   * @param {number} ms
   * @returns {Promise<void>}
   */
  sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),

  /**
   * Fetches JSON with timeout and optional retry.
   * @param {string} url
   * @param {Object} [options={}]
   * @param {number} [timeoutMs=10000]
   * @returns {Promise<*>}
   */
  fetchJSON: async (url, options = {}, timeoutMs = 10000) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, { ...options, signal: controller.signal });
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      return await res.json();
    } finally {
      clearTimeout(timeoutId);
    }
  },

  /**
   * Runs multiple promises and returns all settled results (never throws).
   * @param {Promise[]} promises
   * @returns {Promise<{status: string, value?: *, reason?: *}[]>}
   */
  allSettled: (promises) => Promise.allSettled(promises),
};

// ─── Validation Utilities ─────────────────────────────────────────────────────

const Validator = {
  /**
   * Checks if a string is empty or whitespace-only.
   * @param {string} str
   * @returns {boolean}
   */
  isEmpty: (str) => !str || String(str).trim().length === 0,

  /**
   * Validates an email address format.
   * @param {string} email
   * @returns {boolean}
   */
  isEmail: (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email),

  /**
   * Validates a file's extension against allowed types.
   * @param {File} file
   * @param {string[]} [allowedTypes=['pdf', 'doc', 'docx']]
   * @returns {boolean}
   */
  isValidFile: (file, allowedTypes = ['pdf', 'doc', 'docx']) => {
    if (!file) return false;
    const ext = file.name.split('.').pop().toLowerCase();
    return allowedTypes.includes(ext);
  },

  /**
   * Validates file size against a max in MB.
   * @param {File} file
   * @param {number} [maxMB=5]
   * @returns {boolean}
   */
  isValidFileSize: (file, maxMB = 5) => file && file.size <= maxMB * 1024 * 1024,
};

// ─── Notification Utility ─────────────────────────────────────────────────────

/**
 * Shows a toast notification on screen.
 * @param {string} message
 * @param {'success'|'error'|'warning'|'info'} [type='info']
 * @param {number} [durationMs=3000]
 */
function showToast(message, type = 'info', durationMs = 3000) {
  // Remove any existing toast of the same type to avoid stacking
  const existing = document.querySelector(`.toast.toast--${type}`);
  if (existing) existing.remove();

    const icons = {
      success: '<i class="fa-solid fa-check-circle" style="color:var(--success)"></i>',
      error: '<i class="fa-solid fa-circle-exclamation" style="color:var(--danger)"></i>',
      info: '<i class="fa-solid fa-circle-info" style="color:var(--primary-light)"></i>',
      warning: '<i class="fa-solid fa-triangle-exclamation" style="color:var(--warning)"></i>',
    };
  const toast = DOM.create('div', { class: `toast toast--${type}` }, `
    <span class="toast__icon">${icons[type]}</span>
    <span class="toast__msg">${message}</span>
  `);

  document.body.appendChild(toast);
  // Trigger CSS animation
  requestAnimationFrame(() => toast.classList.add('toast--visible'));

  setTimeout(() => {
    toast.classList.remove('toast--visible');
    toast.addEventListener('transitionend', () => toast.remove(), { once: true });
  }, durationMs);
}

/**
 * Generates a unique ID string (for job IDs, element IDs, etc.)
 * @returns {string}
 */
function generateUID() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

/**
 * Formats a salary string cleanly (handles various input formats).
 * @param {number|string} salary
 * @param {string} [currency='₹']
 * @returns {string}
 */
function formatSalary(salary, currency = '₹') {
  if (!salary) return 'Salary not disclosed';
  if (typeof salary === 'number') {
    return salary >= 100000
      ? `${currency}${(salary / 100000).toFixed(1)}L/yr`
      : `${currency}${salary.toLocaleString('en-IN')}/mo`;
  }
  return String(salary); // already a formatted string
}
