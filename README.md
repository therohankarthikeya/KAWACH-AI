# KAWACH-AI

**A Zero-Storage Personal Digital Footprint Scanner & Identity Protection Shield**  
*Built for **AI HUB 2K26***

![Next.js](https://img.shields.io/badge/Frontend-Next.js%20%7C%20Tailwind%20CSS-black?style=flat-square&logo=next.js)
![FastAPI](https://img.shields.io/badge/Backend-FastAPI%20%7C%20Python-009688?style=flat-square&logo=fastapi)
![DeepFace](https://img.shields.io/badge/Biometrics-DeepFace%20(ArcFace)-blue?style=flat-square)
![Gemini](https://img.shields.io/badge/AI%20Legal%20Shield-Gemini%202.5%20Flash-4285F4?style=flat-square&logo=google)

---

## The Problem
Photos and personal details uploaded online are frequently scraped, reposted without consent, or used to create fake impersonation ("catfish") profiles. Standard reverse-image search tools match backgrounds and clothing rather than facial geometry—and even when victims find unauthorized uploads, they rarely know how to file a formal cybercrime complaint or draft a legal takedown notice.

##  Our Solution
**KAWACH-AI** acts as a personal digital bodyguard. Using a **live selfie** and optional public identifiers, it scans the indexed web for unauthorized appearances of your face or personal information, verifies facial matches using biometric embeddings, and generates **one-click legal takedown notices and Indian Cyber Crime reports**.

---

##  Privacy-First & Anti-Stalker Architecture

KAWACH-AI is engineered with strict privacy guardrails so the platform cannot be misused to spy on others or leak sensitive user data:

1. **Anti-Stalker Live Camera Gate (No File Uploads):** All file-upload dropzones are disabled. Users must capture a real-time selfie via webcam (`react-webcam`), preventing bad actors from uploading someone else's photo.
2. **RAM-Only Zero-Storage Pipeline:** Uploaded selfies and search inputs are processed strictly in volatile memory (`io.BytesIO`) and wiped immediately once the scan completes. **Zero photos, facial vectors, or user records are ever written to disk or stored in a database.**
3. **Safe Identifier Handling:** KAWACH-AI never requests or logs full government ID numbers (such as full Aadhaar numbers). Users can optionally search using their name, public handle, or a non-sensitive reference keyword / last 4 digits.

---

##  Key Features

* **Two-Stage Biometric Face Discovery:**
  * **Broad Web Recall:** Uploads a temporary, compressed in-memory frame to **SerpApi (Google Lens)** to discover visual matches across public websites, blogs, and indexed social media previews.
  * **Biometric False-Positive Filter:** Runs candidate thumbnails through **DeepFace (`ArcFace`)** to compute cosine similarity scores, filtering out lookalikes and keeping high-confidence facial matches (`> 75%`).
* **Public Info & Document Trace:** Searches indexed web pages and public documents for accidental exposure of the user's name, social handles, or reference keywords.
* **3-Click AI Action Shield (Powered by Gemini 2.5 Flash):**
  1. **Report to Indian Cyber Crime:** Generates a structured, copy-ready incident report formatted for India's **National Cyber Crime Reporting Portal (`cybercrime.gov.in`)** and the **1930** helpline, complete with unauthorized URLs, timestamps, and incident summaries.
  2. **Email Website to Remove:** Extracts visible support/grievance contacts from the target domain and drafts a formal takedown demand.
  3. **Contact Uploader:** Identifies visible uploader handles or contact details and drafts a firm removal notice prior to legal escalation.

---

##  System Architecture

```text
[Live Webcam Selfie + Optional Name/Keyword]
                     │
                     ▼  (In-Memory BytesIO — No Disk Write)
       [FastAPI Backend (/api/scan)]
          ├──► SerpApi Google Lens ──► Candidate URLs & Thumbnails
          │                                   │
          │                                   ▼
          │                       DeepFace (ArcFace Verification)
          │                       [Keep Cosine Similarity > 75%]
          │
          └──► SerpApi Web Search  ──► Public Name / Document Traces
                     │
                     ▼  (Memory Buffers Wiped Immediately)
     [Results Dashboard + Similarity Scores]
                     │
                     ▼  (On User Action Click)
  [Gemini 2.5 Flash (/api/generate-action)]
     ├──► cybercrime.gov.in / 1930 Incident Report
     ├──► Website Grievance Takedown Email
     └──► Uploader Removal Warning Message
