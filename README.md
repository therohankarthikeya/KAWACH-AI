# KAWACH-AI: Indian Cyber-Biometric Shield & Automated Takedown Suite


**A Zero-Storage Personal Digital Footprint Scanner & Identity Protection Shield**  
*Built for **AI HUB 2K26***

![Next.js](https://img.shields.io/badge/Frontend-Next.js%20%7C%20Tailwind%20CSS-black?style=flat-square&logo=next.js)
![FastAPI](https://img.shields.io/badge/Backend-FastAPI%20%7C%20Python-009688?style=flat-square&logo=fastapi)
![DeepFace](https://img.shields.io/badge/Biometrics-DeepFace%20(ArcFace)-blue?style=flat-square)
![Gemini](https://img.shields.io/badge/AI%20Legal%20Shield-Gemini%202.5%20Flash-4285F4?style=flat-square&logo=google)

**KAWACH-AI** is a dual-service, privacy-first OSINT and digital footprint auditing platform engineered specifically for the Indian cyberspace. It combines live facial biometric matching, localized search indexing, and AI-driven legal notice generation to help individuals detect unauthorized likeness usage and instantly initiate formal takedown or cybercrime reporting workflows.

---

## 🚀 Key Features

* **Zero-Persistence RAM Architecture:** Live webcam selfies and query parameters are processed exclusively in volatile memory (`io.BytesIO`) and purged the millisecond a scan initializes. Zero disk writes, zero database storage.
* **Indian Market Localization:** Strictly bound to Indian regional indices (`gl="in"`, `location="India"`, `google.co.in`) via SerpApi (Google Lens) and Serper.dev for precise local web mention tracking.
* **DeepFace ArcFace Biometric Engine:** Verifies visual candidate thumbnails against live facial embeddings with a strict cosine similarity threshold ($\ge 75\%$).
* **AI Legal Takedown Suite (Gemini 2.5 Flash):** Instantly generates formal legal DMCA, privacy notice emails, or civil uploader warnings tailored to the specific target domain.
* **Official Enforcement Integration:** Direct workflows linking victims to India's **National Cyber Crime Reporting Portal (`cybercrime.gov.in`)** and the national cyber fraud emergency helpline (**1930**).

---

## 🛠️ System Architecture

* **Frontend:** Next.js (App Router), React, Tailwind CSS, Lucide Icons, and responsive dashboard UI.
* **Backend:** FastAPI (Python), handling asynchronous API requests and secure memory management.
* **APIs & AI:** 
  * SerpApi (Google Lens visual search)
  * Serper.dev (localized text-based web mentions)
  * Google Gemini 2.5 Flash (legal draft generation)
  * DeepFace (ArcFace facial recognition)

---

## ⚙️ Installation & Setup

### Prerequisites
* Python 3.10+
* Node.js 18+
* API Keys: `SERPAPI_API_KEY`, `SERPER_API_KEY`, and `GEMINI_API_KEY`

### 1. Backend Setup (`FastAPI`)
```powershell
cd C:\KAWACH-AI\backend
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
```

Create a `.env` file inside `backend/`:
```env
SERPAPI_API_KEY="your_serpapi_key"
SERPER_API_KEY="your_serper_dev_key"
GEMINI_API_KEY="your_gemini_key"
```

Run the backend server:
```powershell
python -m uvicorn main:app --host 127.0.0.1 --port 8000 --reload
```

### 2. Frontend Setup (`Next.js`)
Open a new terminal window in Cursor:
```powershell
cd C:\KAWACH-AI\frontend
npm install
npm run dev
```

Open your browser and navigate to **`http://localhost:3000`**.

---

## 🛡️ Usage Workflow

1. **Capture Live Selfie:** Allow webcam access and capture a live frame (file uploads from disk are intentionally blocked for security).
2. **Enter Parameters:** Provide your full name, email address, and reference keyword (full government ID numbers are automatically flagged and blocked).
3. **Execute Scan:** The system splits into two independent parallel pipelines (Serper text mention search + DeepFace visual match search).
4. **Review Results:** Inspect verified matches categorized by domain, match type, and similarity score.
5. **Take Action:** Click any of the three action buttons:
   * **Report to Indian Cyber Crime:** Get direct links to `cybercrime.gov.in` and guidance on calling `1930`.
   * **Email Website to Remove:** Generate and copy a custom AI legal takedown notice.
   * **Contact Uploader:** Draft a polite yet firm direct removal request message.

---

## 📄 License
Built for privacy and cyber defense empowerment in India.
