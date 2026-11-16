import os
import httpx
from fastapi import APIRouter, BackgroundTasks, HTTPException
from pydantic import BaseModel
import google.generativeai as genai

router = APIRouter(prefix="/api")

# Configure Gemini AI
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "").strip()
if GEMINI_API_KEY:
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


@router.post("/generate-action", response_model=ActionResponse)
def generate_action(req: ActionRequest):
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

    # Use Gemini for formal legal takedown and uploader notices
    if not GEMINI_API_KEY:
        raise HTTPException(
            status_code=500,
            detail="GEMINI_API_KEY is missing in backend/.env for generating email drafts.",
        )

    model = genai.GenerativeModel("gemini-2.5-flash")

    if req.action_type == "website_takedown":
        prompt = (
            f"Draft a formal legal DMCA / privacy notice email to the webmaster of domain '{req.target_domain}' "
            f"demanding the immediate removal of unauthorized photos or personal data belonging to {req.user_name or 'the user'}.\n"
            f"Target URL: {req.target_url}\n"
            f"Context snippet found: {req.snippet}\n"
            f"Keep it professional, legally firm citing data privacy standards, and include placeholders for signature."
        )
        response = model.generate_content(prompt)
        email_body = response.text if response else "Failed to generate draft."

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
        prompt = (
            f"Draft a polite yet firm direct message to the uploader/owner of page '{req.target_url}' on '{req.target_domain}', "
            f"asking them to take down unauthorized personal photos/mentions of {req.user_name or 'the user'}.\n"
            f"Context snippet: {req.snippet}\n"
            f"Keep it concise and clear."
        )
        response = model.generate_content(prompt)
        msg_body = response.text if response else "Failed to generate message."

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