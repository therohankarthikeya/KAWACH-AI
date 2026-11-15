"""Draft portal complaints, takedown notices, and uploader warnings.

Images and other user data are never written to disk or a database. Government
ID numbers are masked before they leave this module.
"""

from __future__ import annotations

import json
import os
import re
from datetime import datetime, timedelta, timezone
from typing import Literal

from dotenv import load_dotenv
from fastapi import APIRouter, HTTPException
from google import genai
from google.genai import types
from pydantic import BaseModel, Field

load_dotenv()

if not os.environ.get("GEMINI_API_KEY"):
    raise RuntimeError("GEMINI_API_KEY is missing. Set it in .env before starting the API.")

client = genai.Client()

router = APIRouter()

ActionType = Literal["cybercrime", "website_takedown", "contact_uploader"]

_EMAIL_RE = re.compile(r"\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b", re.IGNORECASE)
_HANDLE_RE = re.compile(r"(?<![\w@])@[A-Za-z0-9_.]{2,30}\b")
_AADHAAR_RE = re.compile(r"\b\d{4}[\s-]?\d{4}[\s-]?\d{4}\b")
_PAN_RE = re.compile(r"\b[A-Z]{5}\d{4}[A-Z]\b")
_CONTROL_RE = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f]")

_IST = timezone(timedelta(hours=5, minutes=30))


class GenerateActionRequest(BaseModel):
    action_type: ActionType
    target_url: str = Field(min_length=1, max_length=2000)
    domain: str = Field(min_length=1, max_length=253)
    page_snippet: str = Field(min_length=1, max_length=12000)
    user_name: str = Field(min_length=1, max_length=120)


class GenerateActionResponse(BaseModel):
    subject: str
    recipient_hint: str
    draft_text: str


def _clean(value: str, limit: int) -> str:
    text = _CONTROL_RE.sub("", value).strip()
    text = re.sub(r"[ \t]+\n", "\n", text)
    return text[:limit]


def _mask_gov_ids(text: str) -> str:
    """Replace full government ID numbers with a non-reversible mask."""

    def _aadhaar(match: re.Match[str]) -> str:
        digits = re.sub(r"\D", "", match.group(0))
        return f"XXXX-XXXX-{digits[-4:]}"

    masked = _AADHAAR_RE.sub(_aadhaar, text)
    return _PAN_RE.sub("[REDACTED-ID]", masked)


def _visible_emails(snippet: str) -> list[str]:
    seen: list[str] = []
    for match in _EMAIL_RE.findall(snippet):
        email = match.lower()
        if email not in seen:
            seen.append(email)
    return seen[:8]


def _visible_handles(snippet: str) -> list[str]:
    seen: list[str] = []
    for match in _HANDLE_RE.findall(snippet):
        if match.lower() not in {item.lower() for item in seen}:
            seen.append(match)
    return seen[:8]


def _host(domain: str) -> str:
    host = re.sub(r"^https?://", "", domain.strip().lower())
    host = host.split("/")[0].split(":")[0].lstrip(".")
    if re.fullmatch(r"[a-z0-9.-]+\.[a-z]{2,}", host):
        return host
    return ""


def _fallback_recipients(domain: str) -> str:
    host = _host(domain)
    if not host:
        return f"grievance@{domain}, privacy@{domain}"
    return f"grievance@{host}, privacy@{host}"


def _instructions(action_type: ActionType, domain: str, emails: list[str], handles: list[str]) -> str:
    shared = (
        "You draft formal text for a person whose identity is being misused online. "
        "Use only facts present in the user message. Do not invent URLs, dates, emails, "
        "phone numbers, handles, quotes, or evidence. If a detail is missing, say it is "
        "not visible in the captured page text. Never include a full government ID number; "
        "if one appears, keep only a masked fragment such as XXXX-XXXX-1234. "
        "Write in clear English, first person from the complainant. "
        "Return JSON with exactly three string fields: subject, recipient_hint, and draft_text."
    )
    if action_type == "cybercrime":
        return (
            shared
            + " Action: a structured incident report ready to paste into India's National "
            "Cyber Crime Reporting Portal (https://cybercrime.gov.in) and to read to the "
            "1930 helpline. Category is identity misuse. recipient_hint must be exactly "
            "'National Cyber Crime Reporting Portal (cybercrime.gov.in) and 1930 helpline'. "
            "draft_text must include labeled lines for: complainant name, date and time "
            "(use the timestamp given to you), exact URL, domain, category (Identity misuse), "
            "what the page shows, and a formal complaint paragraph asking the portal to "
            "register the incident, direct the intermediary to remove the content, and "
            "preserve relevant logs. Do not promise a legal outcome."
        )
    if action_type == "website_takedown":
        visible = ", ".join(emails) if emails else "none"
        fallback = _fallback_recipients(domain)
        return (
            shared
            + " Action: a formal takedown / grievance notice to the website operator. "
            f"Visible emails already detected in the page text: {visible}. "
            "recipient_hint must be those visible support or grievance emails, comma-separated. "
            f"If none are visible, recipient_hint must be exactly '{fallback}'. "
            "Do not use any other address. subject is a short email subject line. "
            "draft_text is the notice: who is writing, the exact URL, that the page misuses "
            "their identity, a request to disable access and delete the content, a request "
            "to preserve logs, and a statement that the matter is being reported on "
            "cybercrime.gov.in. Keep the tone formal. Do not threaten or abuse the recipient."
        )
    visible_handles = ", ".join(handles) if handles else "none"
    visible_emails = ", ".join(emails) if emails else "none"
    return (
        shared
        + " Action: a firm removal warning addressed to the uploader. "
        f"Visible handles: {visible_handles}. Visible contact emails: {visible_emails}. "
        "recipient_hint must be the visible uploader handle or contact. If nothing is "
        "visible, recipient_hint must be exactly 'Uploader (no contact visible on the page)'. "
        "draft_text must demand prompt removal of the content at the exact URL, state that "
        "use of the complainant's identity is unauthorized, and state that the incident "
        "will be reported on cybercrime.gov.in and to the site operator if it stays up. "
        "Be firm and civil. Do not insult, harass, threaten violence, or demand money."
    )


def _parse_model_json(response: object) -> GenerateActionResponse:
    parsed = getattr(response, "parsed", None)
    if isinstance(parsed, GenerateActionResponse):
        data = parsed
    elif isinstance(parsed, dict):
        data = GenerateActionResponse.model_validate(parsed)
    else:
        text = getattr(response, "text", None) or ""
        text = text.strip()
        if text.startswith("```"):
            text = re.sub(r"^```(?:json)?\s*|\s*```$", "", text, flags=re.IGNORECASE)
        try:
            payload = json.loads(text)
        except json.JSONDecodeError as exc:
            raise HTTPException(status_code=502, detail="Model returned invalid JSON") from exc
        data = GenerateActionResponse.model_validate(payload)

    subject = _mask_gov_ids(data.subject).strip()
    recipient = _mask_gov_ids(data.recipient_hint).strip()
    draft = _mask_gov_ids(data.draft_text).strip()
    if not subject or not recipient or not draft:
        raise HTTPException(status_code=502, detail="Model returned an empty draft")
    return GenerateActionResponse(subject=subject, recipient_hint=recipient, draft_text=draft)


@router.post("/api/generate-action", response_model=GenerateActionResponse)
def generate_action(body: GenerateActionRequest) -> GenerateActionResponse:
    target_url = _clean(body.target_url, 2000)
    domain = _clean(body.domain, 253).lower()
    user_name = _clean(_mask_gov_ids(body.user_name), 120)
    snippet = _mask_gov_ids(_clean(body.page_snippet, 12000))
    if not target_url or not domain or not user_name or not snippet:
        raise HTTPException(status_code=422, detail="target_url, domain, page_snippet, and user_name are required")

    emails = _visible_emails(snippet)
    handles = _visible_handles(snippet)
    timestamp = datetime.now(_IST).strftime("%Y-%m-%d %H:%M:%S IST")

    prompt = (
        f"action_type: {body.action_type}\n"
        f"complainant_name: {user_name}\n"
        f"timestamp: {timestamp}\n"
        f"exact_url: {target_url}\n"
        f"domain: {domain}\n"
        f"page_snippet:\n{snippet}\n"
    )

    try:
        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=prompt,
            config=types.GenerateContentConfig(
                system_instruction=_instructions(body.action_type, domain, emails, handles),
                temperature=0.2,
                response_mime_type="application/json",
                response_schema=GenerateActionResponse,
            ),
        )
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=502, detail="Draft generation failed") from exc

    result = _parse_model_json(response)
    if body.action_type == "cybercrime":
        result.recipient_hint = "National Cyber Crime Reporting Portal (cybercrime.gov.in) and 1930 helpline"
    elif body.action_type == "website_takedown":
        result.recipient_hint = ", ".join(emails) if emails else _fallback_recipients(domain)
    elif body.action_type == "contact_uploader":
        contacts = handles + emails
        result.recipient_hint = (
            ", ".join(contacts) if contacts else "Uploader (no contact visible on the page)"
        )
    return result
