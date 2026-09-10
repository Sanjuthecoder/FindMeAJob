# 🌍 Job Platforms Overview & Configuration Guide

FindMeAJob utilizes a hybrid approach to provide maximum job coverage. Since many major job portals block direct frontend API access (due to CORS or bot protection), we use **direct API fetching** for open platforms and **intelligent deep-linking** for walled gardens.

## 1. Direct API Platforms (In-App Results)
These platforms return raw job data that is normalized, match-scored, and rendered directly as job cards inside the app.

| Platform | Access Method | Status | Configuration Required? |
| :--- | :--- | :--- | :--- |
| **Remotive** | Public API | Enabled by default | **No.** Free and open API without limits. |
| **RemoteOK** | Public API | Enabled by default | **No.** Free and open API. |
| **Adzuna** (India Jobs) | Private API | Disabled by default | **Yes.** Requires free App ID & Key. |
| **JSearch** (Aggregator) | RapidAPI | Disabled by default | **Yes.** Requires free RapidAPI key. |

### ⚙️ How to Configure API Keys (Phase 2)
To fetch jobs from Adzuna and JSearch, you must provide your own API keys in `js/config.js`. 
*We don't hardcode these to prevent quota exhaustion and keep the project open-source friendly.*

1. **Adzuna (1000 requests/day free):**
   - Go to [developer.adzuna.com](https://developer.adzuna.com) and sign up for an API key.
   - Open `js/config.js` and locate the `ADZUNA` object.
   - Paste your `APP_ID` and `APP_KEY`. The app will automatically enable Adzuna fetches.

2. **JSearch via RapidAPI (100 requests/month free):**
   - JSearch aggregates data from **LinkedIn, Indeed, and Glassdoor**.
   - Go to [JSearch on RapidAPI](https://rapidapi.com/letscrape-6baf0d461a99/api/jsearch) and subscribe to the basic free tier.
   - Open `js/config.js`, locate `JSEARCH`, and paste your `API_KEY`.

---

## 2. Smart Deep-Link Platforms (External Search)
Major portals like LinkedIn and Naukri do not allow client-side scraping or free API access. Instead of showing zero results, FindMeAJob acts as a **smart URL constructor**. 

The app takes your exact profile (Job Title, Experience, Location, Job Type) and generates a pre-filled, highly specific URL. One click takes you to the exact filtered results on their site.

| Platform | URL Construction Logic (`js/urlBuilder.js`) | Configuration Required? |
| :--- | :--- | :--- |
| **Naukri** | Slugs job title & maps location into path parameters. | No |
| **LinkedIn** | Injects job title keywords and maps experience levels to LinkedIn's specific `f_E` ID codes (e.g., 1-3 years = `f_E=2`). | No |
| **Indeed** | Formats search query with exact title and location. | No |
| **Internshala**| Adjusts base path depending on if the user selected 'Internship' or 'Full-time' job types. | No |
| **Shine** | Constructs standard keyword + location search parameters. | No |
| **Glassdoor** | Maps search terms to Glassdoor's standard search payload. | No |

### 🛠️ Modifying the URL Logic
If a platform changes their URL structure in the future, you do not need to touch the UI code. Simply open `js/urlBuilder.js` and update the specific builder function (e.g., `buildLinkedInURL()`). The app is designed to be highly modular for exactly this reason.
