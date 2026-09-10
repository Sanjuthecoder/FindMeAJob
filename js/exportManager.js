/**
 * @file exportManager.js
 * @description Handles exporting job results as CSV or PDF.
 *              All export logic runs in the browser — no server required.
 *              Uses PapaParse for CSV and jsPDF for PDF generation.
 * @module exportManager
 * @dependency PapaParse (CDN), jsPDF (CDN)
 */

'use strict';

// ─── CSV Export ───────────────────────────────────────────────────────────────

/**
 * Column definitions for CSV export.
 * DRY: defined once, used by both CSV and PDF exports.
 * @type {Array<{ label: string, key: string, transform?: Function }>}
 */
const EXPORT_COLUMNS = [
  { label: 'Job Title',   key: 'title' },
  { label: 'Company',     key: 'company' },
  { label: 'Location',    key: 'location' },
  { label: 'Platform',    key: 'platform' },
  { label: 'Job Type',    key: 'jobType',    transform: (v) => v?.replace('_', '-') || '' },
  { label: 'Salary',      key: 'salary' },
  { label: 'Match Score', key: 'matchScore', transform: (v) => `${v}%` },
  { label: 'Posted',      key: 'postedAt',   transform: (v) => DateUtils.format(v) },
  { label: 'Skills',      key: 'tags',       transform: (v) => (v || []).join(', ') },
  { label: 'Apply Link',  key: 'url' },
];

/**
 * Converts a job object into a plain row object using EXPORT_COLUMNS.
 * @param {import('./jobSearch.js').Job} job
 * @returns {Object.<string, string>}
 */
function _jobToRow(job) {
  return EXPORT_COLUMNS.reduce((row, col) => {
    const rawVal     = job[col.key];
    row[col.label]   = col.transform ? col.transform(rawVal) : (rawVal || '');
    return row;
  }, {});
}

/**
 * Triggers a file download in the browser.
 * @param {string} content   - file content string
 * @param {string} filename  - file name with extension
 * @param {string} mimeType  - e.g. 'text/csv' or 'application/pdf'
 */
function _downloadFile(content, filename, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url  = URL.createObjectURL(blob);
  const link = DOM.create('a', { href: url, download: filename });
  document.body.appendChild(link);
  link.click();
  // Cleanup — revoke object URL after short delay to ensure download starts
  setTimeout(() => {
    URL.revokeObjectURL(url);
    link.remove();
  }, 200);
}

/**
 * Exports job results as a CSV file.
 * Uses PapaParse.unparse() for RFC-4180-compliant CSV generation.
 * @param {import('./jobSearch.js').Job[]} jobs
 * @param {string} [filename='FindMeAJob_Results']
 * @returns {void}
 */
function exportToCSV(jobs, filename = 'FindMeAJob_Results') {
  if (!jobs || jobs.length === 0) {
    showToast('No jobs to export.', 'warning');
    return;
  }

  if (typeof Papa === 'undefined') {
    showToast('CSV library not loaded. Check your connection.', 'error');
    return;
  }

  const rows = jobs.map(_jobToRow);
  const csv  = Papa.unparse(rows, { header: true });
  const date = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

  _downloadFile(csv, `${filename}_${date}.csv`, 'text/csv;charset=utf-8;');
  showToast(`✅ Exported ${jobs.length} jobs as CSV`, 'success');
}

// ─── PDF Export ───────────────────────────────────────────────────────────────

/**
 * Exports job results as a neatly formatted PDF file.
 * Uses jsPDF for generation. Wraps long text automatically.
 * @param {import('./jobSearch.js').Job[]} jobs
 * @param {Object} profile - user profile (for PDF header)
 * @param {string} [filename='FindMeAJob_Results']
 * @returns {void}
 */
function exportToPDF(jobs, profile = {}, filename = 'FindMeAJob_Results') {
  if (!jobs || jobs.length === 0) {
    showToast('No jobs to export.', 'warning');
    return;
  }

  if (typeof jspdf === 'undefined' && typeof jsPDF === 'undefined') {
    showToast('PDF library not loaded. Try exporting as CSV instead.', 'error');
    return;
  }

  const { jsPDF: JsPDF } = window.jspdf || { jsPDF: window.jsPDF };
  const doc = new JsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  const PAGE_W   = 210;
  const MARGIN   = 15;
  const COL_W    = PAGE_W - MARGIN * 2;
  const LINE_H   = 6;
  let   y        = MARGIN;

  // ── Helper: check and add new page if needed ──────────────────────────────
  const checkPage = (needed = 20) => {
    if (y + needed > 285) { doc.addPage(); y = MARGIN; }
  };

  // ── PDF Header ─────────────────────────────────────────────────────────────
  doc.setFillColor(99, 102, 241); // indigo
  doc.rect(0, 0, PAGE_W, 30, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text('FindMeAJob — Results Report', MARGIN, 18);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(`Generated: ${DateUtils.format(new Date())}   |   Total: ${jobs.length} jobs`, MARGIN, 25);
  y = 38;

  // ── Profile Summary ─────────────────────────────────────────────────────────
  if (profile.jobTitle) {
    doc.setTextColor(50, 50, 80);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('Search Profile', MARGIN, y);
    y += LINE_H;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    const profileText = [
      profile.jobTitle && `Role: ${profile.jobTitle}`,
      profile.experience && `Experience: ${profile.experience}`,
      profile.location && `Location: ${profile.location}`,
      profile.skills?.length && `Skills: ${profile.skills.slice(0, 6).join(', ')}`,
    ].filter(Boolean).join('   ');
    doc.text(profileText, MARGIN, y);
    y += LINE_H * 2;
  }

  // ── Job Entries ─────────────────────────────────────────────────────────────
  jobs.forEach((job, idx) => {
    checkPage(35);

    // Alternating row background for readability
    if (idx % 2 === 0) {
      doc.setFillColor(245, 245, 255);
      doc.rect(MARGIN - 2, y - 4, COL_W + 4, 28, 'F');
    }

    // Job number badge
    doc.setFillColor(99, 102, 241);
    doc.circle(MARGIN + 3, y - 1, 3, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(7);
    doc.text(String(idx + 1), MARGIN + 1.8, y);

    // Title
    doc.setTextColor(30, 30, 60);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text(StringUtils.truncate(job.title, 55), MARGIN + 8, y);

    // Match badge
    const matchColor = job.matchScore >= 70 ? [34, 197, 94] : job.matchScore >= 40 ? [234, 179, 8] : [239, 68, 68];
    doc.setFillColor(...matchColor);
    doc.roundedRect(PAGE_W - MARGIN - 22, y - 5, 22, 7, 2, 2, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(8);
    doc.text(`${job.matchScore}% match`, PAGE_W - MARGIN - 20, y - 0.5);

    y += LINE_H;

    // Company & Location
    doc.setTextColor(80, 80, 120);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(`${job.company}  ·  ${job.location}  ·  ${job.platform}`, MARGIN + 8, y);
    y += LINE_H - 1;

    // Salary & Date
    const salaryText = job.salary ? `💰 ${job.salary}` : '';
    const dateText   = `📅 ${DateUtils.timeAgo(job.postedAt)}`;
    doc.setFontSize(8);
    doc.setTextColor(100, 100, 140);
    doc.text([salaryText, dateText].filter(Boolean).join('    '), MARGIN + 8, y);
    y += LINE_H - 1;

    // URL (clickable)
    doc.setTextColor(99, 102, 241);
    doc.setFontSize(8);
    doc.textWithLink(`Apply: ${StringUtils.truncate(job.url, 70)}`, MARGIN + 8, y, { url: job.url });
    y += LINE_H * 1.5;
  });

  // ── Footer ──────────────────────────────────────────────────────────────────
  const pageCount = doc.internal.getNumberOfPages();
  for (let p = 1; p <= pageCount; p++) {
    doc.setPage(p);
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 180);
    doc.text(`FindMeAJob.com  |  Page ${p} of ${pageCount}`, MARGIN, 292);
  }

  const date = new Date().toISOString().slice(0, 10);
  doc.save(`${filename}_${date}.pdf`);
  showToast(`✅ Exported ${jobs.length} jobs as PDF`, 'success');
}
