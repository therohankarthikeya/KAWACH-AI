"""Live-selfie and identity scan API.

Evaluates only full_name (via Serper.dev) and selfie (via SerpApi Google Lens +
DeepFace ArcFace) as two completely independent pipelines in memory without
writing photo bytes to disk. Keyword and email fields are accepted from the UI
form and intentionally ignored.
"""

import io
import os
from typing import List, Optional
from urllib.parse import urlparse

import cv2
import httpx
import numpy as np
from deepface import DeepFace
from dotenv import load_dotenv
from fastapi import FastAPI, File, Form, HTTPException, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from PIL import Image, ImageOps
from pydantic import BaseModel

load_dotenv(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env"), override=True)

SERPAPI_IMAGE_URL = "https://serpapi.com/image"
SERPAPI_SEARCH_URL = "https://serpapi.com/search.json"
SERPER_SEARCH_URL = "https://google.serper.dev/search"
MAX_IMAGE_BYTES = 500 * 1024
MAX_RAW_BYTES = 12 * 1024 * 1024
MAX_THUMBNAIL_BYTES = 5 * 1024 * 1024
TOP_VISUAL_MATCHES = 10
SIMILARITY_CUTOFF = 55.0

app = FastAPI(title="KAWACH-AI")
from actions import router as actions_router

app.include_router(actions_router)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    return JSONResponse(
        status_code=500,
        content={"detail": f"Backend error: {type(exc).__name__}: {exc}"},
    )


class ScanHit(BaseModel):
    title: str
    url: str
    domain: str
    match_type: str
    similarity_score: Optional[float] = None
    snippet: str = ""
    thumbnail: str = ""


class ScanResponse(BaseModel):
    results: List[ScanHit]


def clear_buffer(buffer: io.BytesIO) -> None:
    buffer.seek(0)
    buffer.truncate(0)
    buffer.close()


def domain_of(url: str) -> str:
    host = urlparse(url).hostname or ""
    if host.startswith("www."):
        return host[4:]
    return host


def clean_form_text(value: Optional[str]) -> str:
    if not value:
        return ""
    cleaned = value.strip()
    if cleaned.lower() in {"none", "null", "undefined", "nan"}:
        return ""
    return cleaned


def compress_selfie(raw: bytes) -> bytes:
    """Resize and JPEG-compress a frame until it is under 500 KB."""
    source = io.BytesIO(raw)
    output = io.BytesIO()
    try:
        with Image.open(source) as opened:
            image = ImageOps.exif_transpose(opened)
            if image.mode != "RGB":
                image = image.convert("RGB")
            image.thumbnail((1600, 1600), Image.Resampling.LANCZOS)
            quality = 85
            for _ in range(12):
                output.seek(0)
                output.truncate(0)
                image.save(output, format="JPEG", quality=quality, optimize=True)
                if output.tell() <= MAX_IMAGE_BYTES:
                    return output.getvalue()
                if quality > 45:
                    quality -= 10
                    continue
                width, height = image.size
                if min(width, height) <= 160:
                    break
                image = image.resize(
                    (max(1, int(width * 0.75)), max(1, int(height * 0.75))),
                    Image.Resampling.LANCZOS,
                )
                quality = 75
        raise HTTPException(
            status_code=413,
            detail="Live selfie could not be compressed under 500 KB",
        )
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=400, detail="Live selfie is not a valid image") from exc
    finally:
        clear_buffer(source)
        clear_buffer(output)


def decode_bgr(data: bytes) -> np.ndarray:
    encoded = io.BytesIO(data)
    try:
        array = np.frombuffer(encoded.getvalue(), dtype=np.uint8)
        image = cv2.imdecode(array, cv2.IMREAD_COLOR)
        if image is None:
            raise ValueError("Could not decode image")
        return image
    finally:
        clear_buffer(encoded)


def download_bytes(client: httpx.Client, url: str, limit: int) -> bytes:
    buffer = io.BytesIO()
    try:
        with client.stream("GET", url, timeout=30.0) as response:
            response.raise_for_status()
            for chunk in response.iter_bytes():
                buffer.write(chunk)
                if buffer.tell() > limit:
                    raise ValueError("Downloaded image exceeded the memory limit")
        return buffer.getvalue()
    finally:
        clear_buffer(buffer)


def serpapi_detail(response: httpx.Response) -> str:
    try:
        body = response.json()
    except ValueError:
        return f"SerpApi request failed ({response.status_code})"
    message = body.get("error") or body.get("message")
    if message:
        return str(message)
    return f"SerpApi request failed ({response.status_code})"


def upload_image(client: httpx.Client, api_key: str, jpeg: bytes) -> str:
    payload = io.BytesIO(jpeg)
    try:
        response = client.post(
            SERPAPI_IMAGE_URL,
            data={"api_key": api_key},
            files={"image": ("selfie.jpg", payload, "image/jpeg")},
            timeout=60.0,
        )
    finally:
        clear_buffer(payload)
    if response.status_code >= 400:
        raise HTTPException(status_code=502, detail=serpapi_detail(response))
    image_id = response.json().get("image_id")
    if not image_id:
        raise HTTPException(status_code=502, detail="SerpApi did not return an image_id")
    return str(image_id)


def lens_matches(client: httpx.Client, api_key: str, image_id: str) -> list:
    response = client.get(
        SERPAPI_SEARCH_URL,
        params={
            "engine": "google_lens",
            "image_id": image_id,
            "country": "in",
            "hl": "en",
            "api_key": api_key,
        },
        timeout=60.0,
    )
    if response.status_code >= 400:
        raise HTTPException(status_code=502, detail=serpapi_detail(response))
    matches = response.json().get("visual_matches") or []
    return matches[:TOP_VISUAL_MATCHES]


def cosine_similarity_percent(selfie_bgr: np.ndarray, thumbnail_bgr: np.ndarray) -> Optional[float]:
    try:
        result = DeepFace.verify(
            img1_path=selfie_bgr,
            img2_path=thumbnail_bgr,
            model_name="ArcFace",
            detector_backend="opencv",
            distance_metric="cosine",
            enforce_detection=True,
            silent=True,
        )
    except Exception:
        return None
    distance = float(result.get("distance", 1.0))
    if not np.isfinite(distance):
        return None
    return round((1.0 - distance) * 100.0, 2)


def verified_visual_hits(client: httpx.Client, selfie_bgr: np.ndarray, matches: list) -> List[ScanHit]:
    hits: List[ScanHit] = []
    for match in matches:
        thumbnail_url = match.get("thumbnail") or ""
        page_url = match.get("link") or ""
        if not thumbnail_url:
            continue
        thumb_bytes = b""
        thumb_bgr = None
        try:
            thumb_bytes = download_bytes(client, thumbnail_url, MAX_THUMBNAIL_BYTES)
            thumb_bgr = decode_bgr(thumb_bytes)
            score = cosine_similarity_percent(selfie_bgr, thumb_bgr)
        except Exception:
            score = None
        finally:
            del thumb_bytes
            if thumb_bgr is not None:
                thumb_bgr.fill(0)
                del thumb_bgr
        if score is None or score <= SIMILARITY_CUTOFF:
            continue
        hits.append(
            ScanHit(
                title=match.get("title") or "",
                url=page_url,
                domain=domain_of(page_url),
                match_type="visual",
                similarity_score=score,
                snippet=match.get("snippet") or "",
                thumbnail=thumbnail_url,
            )
        )
    return hits


def visual_scan_hits(
    client: httpx.Client,
    serpapi_key: str,
    selfie_bgr: np.ndarray,
    compressed: bytes,
) -> List[ScanHit]:
    if not serpapi_key:
        raise HTTPException(status_code=500, detail="SERPAPI_API_KEY is not configured")
    try:
        DeepFace.extract_faces(
            img_path=selfie_bgr,
            detector_backend="opencv",
            enforce_detection=True,
        )
    except Exception as exc:
        raise HTTPException(
            status_code=422,
            detail="No face detected in the live selfie",
        ) from exc

    image_id = upload_image(client, serpapi_key, compressed)
    visuals = lens_matches(client, serpapi_key, image_id)
    hits = verified_visual_hits(client, selfie_bgr, visuals)
    print(f"[KAWACH] Visual search returned {len(hits)} verified hits from {len(visuals)} Lens candidates")
    return hits


def serper_name_hits(client: httpx.Client, full_name_query: str) -> List[ScanHit]:
    if not full_name_query:
        return []

    serper_key = (
        (os.getenv("SERPER_API_KEY") or os.getenv("SERPER_KEY") or "")
        .strip()
        .strip('"')
        .strip("'")
    )
    if not serper_key:
        raise HTTPException(
            status_code=500,
            detail="SERPER_API_KEY is missing in backend/.env",
        )

    response = client.post(
        SERPER_SEARCH_URL,
        headers={
            "X-API-KEY": serper_key,
            "Content-Type": "application/json",
        },
        json={
            "q": full_name_query,
            "gl": "in",
            "hl": "en",
        },
        timeout=30.0,
    )
    if response.status_code >= 400:
        raise HTTPException(
            status_code=502,
            detail=f"Serper search failed ({response.status_code}): {response.text}",
        )

    hits: List[ScanHit] = []
    for item in response.json().get("organic") or []:
        page_url = item.get("link") or ""
        if not page_url:
            continue
        hits.append(
            ScanHit(
                title=item.get("title") or "",
                url=page_url,
                domain=domain_of(page_url),
                match_type="mention",
                similarity_score=None,
                snippet=item.get("snippet") or "",
                thumbnail=item.get("imageUrl") or "",
            )
        )
    print(f"[KAWACH] Serper.dev (gl='in', hl='en') returned {len(hits)} hits for q={full_name_query!r}")
    return hits


@app.post("/api/scan", response_model=ScanResponse)
def scan(
    selfie: UploadFile = File(...),
    full_name: Optional[str] = Form(None),
    keyword: Optional[str] = Form(None),
    email: Optional[str] = Form(None),
) -> ScanResponse:
    print(
        f"[KAWACH] /api/scan received -> full_name={full_name!r}, "
        f"keyword={keyword!r} (ignored), email={email!r} (ignored)"
    )
    serpapi_key = os.getenv("SERPAPI_API_KEY", "").strip().strip('"').strip("'")

    raw_buffer = io.BytesIO()
    compressed = b""
    selfie_bgr = None
    try:
        while True:
            chunk = selfie.file.read(1024 * 1024)
            if not chunk:
                break
            raw_buffer.write(chunk)
            if raw_buffer.tell() > MAX_RAW_BYTES:
                raise HTTPException(status_code=413, detail="Live selfie is too large")
        raw = raw_buffer.getvalue()
        if not raw:
            raise HTTPException(status_code=400, detail="Live selfie is empty")

        compressed = compress_selfie(raw)
        del raw
        selfie_bgr = decode_bgr(compressed)

        name_q = clean_form_text(full_name)

        with httpx.Client(follow_redirects=True) as client:
            # 1. Independent Full Name search on Serper.dev (keyword & email ignored)
            text_hits: List[ScanHit] = []
            text_error: Optional[HTTPException] = None
            if name_q:
                try:
                    text_hits = serper_name_hits(client, name_q)
                except HTTPException as exc:
                    if exc.status_code == 500:
                        raise
                    text_error = exc
                    print(f"[KAWACH] Name search failed ({exc.detail}); continuing with visual search.")

            # 2. Independent Selfie search via Google Lens + DeepFace
            visual_hits: List[ScanHit] = []
            try:
                visual_hits = visual_scan_hits(client, serpapi_key, selfie_bgr, compressed)
            except HTTPException as visual_exc:
                if not name_q:
                    raise
                if text_error is not None and not text_hits:
                    raise text_error
                print(
                    f"[KAWACH] Visual search skipped ({visual_exc.detail}); "
                    f"returning {len(text_hits)} Serper name hits."
                )

            results = text_hits + visual_hits
            return ScanResponse(results=results)
    finally:
        clear_buffer(raw_buffer)
        selfie.file.close()
        del compressed
        if selfie_bgr is not None:
            selfie_bgr.fill(0)
            del selfie_bgr