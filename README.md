# FindMeAJob 🚀
> **Your Dream Job, Found in Seconds** — Multi-Platform Job Aggregator & Match Engine

FindMeAJob is a modern, responsive web application that aggregates job listings across multiple major job platforms (**Adzuna**, **Remotive**, **RemoteOK**, with optional **JSearch** integration). It features experience-level filtering, skill matching, resume parsing, and offline bookmarking—all designed to run as a **zero-backend, serverless static web application** on Firebase Hosting.

---

## 🌟 Key Features

- **Multi-Platform Aggregation**: Fetches and unifies job listings in real-time from:
  - **Adzuna**: India-specific developer and tech listings with INR salary ranges.
  - **Remotive**: Worldwide curated remote tech positions.
  - **RemoteOK**: Global tech roles with high-signal compensation data.
- **Experience-Aware Match Engine**:
  - **Fresher / Entry-Level (0-1 yrs)**: Strictly eliminates Senior, Lead, Principal, and Architect roles, plus jobs requiring 3+ years experience.
  - **Internship Mode**: Exclusively isolates internship and trainee opportunities.
  - **Experienced Roles**: Correctly highlights Senior/Staff roles for 5-10+ years candidates.
- **Intelligent Match Scoring (0–100%)**:
  - 35% Title relevance
  - 40% Skill keyword overlap
  - 15% Location match
  - 10% Job type alignment
- **Resume Auto-Parser**: Upload a resume (PDF/TXT) to instantly extract technical skills, job titles, and experience level to auto-fill the search criteria.
- **Offline Bookmarking & Search History**: Built-in IndexedDB storage (with LocalStorage fallback) to save jobs and cache API results for 24 hours to preserve daily API quotas.
- **Dynamic Glassmorphic UI**: High-contrast, dark-mode design with fluid micro-interactions, responsive sidebar filters, and mobile-friendly drawer navigation.
- **Production-Ready & 100% Free**: Built to operate within free-tier API quotas and deployed on Firebase Hosting with zero running costs.

---

## 🛠️ Tech Stack

- **Frontend**: Vanilla JavaScript (ES6+ Modules/Classes), Semantic HTML5, CSS3 Custom Properties & Glassmorphism (No heavy UI frameworks needed).
- **Client Storage**: IndexedDB with LocalStorage fallback.
- **APIs**:
  - Adzuna REST API (India / Global)
  - Remotive Public API (CORS-enabled)
  - RemoteOK API (CORS-enabled)
- **Local Dev Server**: Node.js HTTP dev server (`server.js`) with in-memory caching.
- **Hosting & CI/CD**: Firebase Hosting with GitHub Actions for automated continuous deployment on every push.

---

## 📁 Repository Structure

```
Findmeajob.com/
├── css/
│   ├── landing.css          # Landing page hero & resume upload styling
│   ├── main.css             # Design tokens, reset, typography, and theme
│   ├── responsive.css       # Mobile & tablet layout adaptations
│   └── results.css          # Job cards, filter sidebar, chips, match badge
├── js/
│   ├── app.js               # Landing page logic & form submissions
│   ├── bookmarkManager.js   # IndexedDB bookmarking & saved jobs
│   ├── config.js            # API credentials & global app settings
│   ├── exportManager.js     # Export bookmarked jobs to JSON/CSV
│   ├── jobSearch.js         # API fetchers, normalizers, and match engine
│   ├── results-app.js       # Results page controller, filters, and state
│   ├── resultsRenderer.js   # DOM rendering for job cards, stats & chips
│   ├── resumeParser.js      # Client-side resume skill & title extractor
│   ├── skillGapAnalyzer.js  # Skill match analysis & missing skill suggestions
│   ├── storage.js           # Unified storage abstraction (IndexedDB/LocalStorage)
│   ├── urlBuilder.js        # Search state serialization in URL params
│   └── utils.js             # String, date, and async utilities
├── firebase.json            # Firebase Hosting configuration & caching headers
├── .firebaserc              # Firebase project target
├── index.html               # Main search & landing page
├── results.html             # Search results, filters, and job comparison
├── package.json             # NPM metadata & dev scripts
└── README.md                # Project documentation
```

---

## 💻 Local Development

### 1. Prerequisites
- [Node.js](https://nodejs.org/) (v16 or higher)

### 2. Run the Local Development Server
```bash
# Clone the repository
git clone https://github.com/<your-username>/findmeajob.git
cd findmeajob

# Start local dev server (opens http://localhost:3000 automatically)
npm run dev
```

### 3. Run Unit Tests
To execute the automated unit test suite (116 tests covering normalizers, scoring, storage, filters, and parsers):
- Start the dev server (`npm run dev`)
- Navigate to: `http://localhost:3000/tests/runner.html`

---

## 🌿 Git Branching Strategy

| Branch | Purpose |
|---|---|
| `dev-development` | Active development branch containing tests (`tests/`), documentation (`Docs/`), and local proxy dev server (`server.js`). |
| `main` | Production-ready release branch connected to Firebase Hosting. Test files and local dev server files are untracked and excluded. |

---

## 🚀 Deployment to Firebase Hosting

This project is optimized for **Firebase Hosting**. Every commit pushed to the `main` branch can be automatically deployed to your live Firebase site via GitHub Actions.

See the deployment guide below for complete step-by-step setup instructions.

---

## 📄 License

This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.
