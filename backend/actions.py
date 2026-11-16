import os
import httpx
from dotenv import load_dotenv
from fastapi import APIRouter, BackgroundTasks, HTTPException
from pydantic import BaseModel

load_dotenv(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env"), override=True)

try:
    import google.generativeai as genai
except ImportError:
    genai = None

router = APIRouter(prefix="/api")

# Configure Gemini AI
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "").strip().strip('"').strip("'")
if GEMINI_API_KEY and genai is not None:
    genai.configure(api_key=GEMINI_API_KEY)


class ActionRequest(BaseModel):
    action_type: str  # "cybercrime", "website_takedown", or "contact_uploader"
    target_url: str
    target_domain: str
    user_name: str = ""
    snippet: str = ""


class ActionResponse(BaseModel):
    title: str
    instructions: str
    prefilled_content: str
    action_url: str


class BugReportRequest(BaseModel):
    category: str
    description: str
    phase: str = "idle"
    user_agent: str = "Unknown"
    timestamp: str = ""


def generate_gemini_text(prompt: str, fallback: str) -> str:
    api_key = os.getenv("GEMINI_API_KEY", "").strip().strip('"').strip("'")
    if not api_key or genai is None:
        return fallback
    try:
        genai.configure(api_key=api_key)
        model = genai.GenerativeModel("gemini-2.5-flash")
        response = model.generate_content(prompt)
        if response and getattr(response, "text", None):
            return response.text.strip()
    except Exception as exc:
        print(f"[KAWACH] Gemini generation fallback triggered: {exc}")
    return fallback


@router.post("/generate-action", response_model=ActionResponse)
def generate_action(req: ActionRequest):
    subject_name = req.user_name.strip() or "the user"

    if req.action_type == "cybercrime":
        return ActionResponse(
            title="Report to Indian Cyber Crime Portal",
            instructions=(
                "1. Keep your evidence screenshots and URL links ready.\n"
                "2. Visit India's official National Cyber Crime Reporting Portal (cybercrime.gov.in).\n"
                "3. File under 'Other Cybercrimes' or 'Identity Theft/Impersonation'.\n"
                "4. For immediate financial fraud emergencies, call the national helpline at **1930**."
            ),
            prefilled_content=(
                f"Incident Report Details:\n"
                f"- Unauthorized Link/Source: {req.target_url}\n"
                f"- Domain: {req.target_domain}\n"
                f"- Description: Unauthorized digital footprint / likeness usage detected via KAWACH-AI biometric scan.\n"
                f"- Evidence Snippet: {req.snippet}"
            ),
            action_url="https://cybercrime.gov.in",
        )

    if req.action_type == "website_takedown":
        fallback_email = (
            f"Subject: Urgent: Request for Removal of Unauthorized Personal Data ({req.target_domain})\n\n"
            f"Dear Webmaster / Grievance Officer,\n\n"
            f"I am writing to request the immediate removal of unauthorized personal data/likeness belonging to "
            f"{subject_name} hosted at:\n{req.target_url}\n\n"
            f"Context: {req.snippet or 'Unauthorized public listing'}\n\n"
            f"Under applicable data privacy regulations and the Information Technology (Intermediary Guidelines and Digital Media Ethics Code) Rules, "
            f"please remove this content and purge any cached copies within 24 hours.\n\n"
            f"Sincerely,\n{subject_name}"
        )
        prompt = (
            f"Draft a formal legal DMCA / privacy notice email to the webmaster of domain '{req.target_domain}' "
            f"demanding the immediate removal of unauthorized photos or personal data belonging to {subject_name}.\n"
            f"Target URL: {req.target_url}\n"
            f"Context snippet found: {req.snippet}\n"
            f"Keep it professional, legally firm citing data privacy standards, and include placeholders for signature."
        )
        email_body = generate_gemini_text(prompt, fallback_email)

        return ActionResponse(
            title="Email Website Webmaster for Removal",
            instructions=(
                "1. Copy the formal legal draft below.\n"
                f"2. Send it to the abuse/contact email address for **{req.target_domain}** (or via their contact page).\n"
                "3. Keep a record of the communication for cyber cell follow-up."
            ),
            prefilled_content=email_body,
            action_url=f"mailto:support@{req.target_domain}?subject=Urgent:%20Request%20for%20Removal%20of%20Unauthorized%20Personal%20Data",
        )

    elif req.action_type == "contact_uploader":
        fallback_msg = (
            f"Hello,\n\n"
            f"I noticed that personal information/media referencing {subject_name} has been uploaded "
            f"without consent on your page:\n{req.target_url}\n\n"
            f"Please take down this content immediately. If it is not removed within 24 hours, I will escalate "
            f"this matter through platform abuse channels and the National Cyber Crime Reporting Portal (cybercrime.gov.in).\n\n"
            f"Thank you."
        )
        prompt = (
            f"Draft a polite yet firm direct message to the uploader/owner of page '{req.target_url}' on '{req.target_domain}', "
            f"asking them to take down unauthorized personal photos/mentions of {subject_name}.\n"
            f"Context snippet: {req.snippet}\n"
            f"Keep it concise and clear."
        )
        msg_body = generate_gemini_text(prompt, fallback_msg)

        return ActionResponse(
            title="Contact Uploader / Page Owner",
            instructions=(
                "1. Copy the message below.\n"
                "2. Navigate to the source page and send it via their comment box, profile DM, or listed contact form.\n"
                "3. If they refuse or ignore within 24 hours, proceed with filing a cybercrime report."
            ),
            prefilled_content=msg_body,
            action_url=req.target_url,
        )

    raise HTTPException(status_code=400, detail="Invalid action type specified.")


def append_bug_to_google_doc(report: BugReportRequest):
    webhook_url = os.getenv("GOOGLE_DOC_BUG_WEBHOOK_URL", "").strip()
    if not webhook_url:
        print("[KAWACH] Bug report skipped: GOOGLE_DOC_BUG_WEBHOOK_URL not set in .env")
        return

    try:
        with httpx.Client(follow_redirects=True, timeout=15.0) as client:
            res = client.post(webhook_url, json=report.model_dump())
            res.raise_for_status()
        print("[KAWACH] Bug report appended to Google Doc.")
    except Exception as exc:
        print(f"[KAWACH] Failed to append bug to Google Doc: {exc}")


@router.post("/report-bug")
def report_bug(req: BugReportRequest, background_tasks: BackgroundTasks):
    if not req.description.strip():
        raise HTTPException(status_code=400, detail="Bug description cannot be empty")
    background_tasks.add_task(append_bug_to_google_doc, req)
    return {"status": "queued", "message": "Bug report logged to Google Docs."}