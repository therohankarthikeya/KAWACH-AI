"""Live-selfie scan API.

The selfie is a webcam frame received as multipart bytes. It is compressed,
sent to SerpApi, and compared in memory. Photo bytes are never written to disk.
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
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from PIL import Image, ImageOps
from pydantic import BaseModel

load_dotenv(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env"))

SERPAPI_IMAGE_URL = "https://serpapi.com/image"
SERPAPI_SEARCH_URL = "https://serpapi.com/search.json"
MAX_IMAGE_BYTES = 500 * 1024
MAX_RAW_BYTES = 12 * 1024 * 1024
MAX_THUMBNAIL_BYTES = 5 * 1024 * 1024
TOP_VISUAL_MATCHES = 10
SIMILARITY_CUTOFF = 75.0

app = FastAPI(title="KAWACH-AI")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
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
        params={"engine": "google_lens", "image_id": image_id, "api_key": api_key},
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


def mention_query(full_name: Optional[str], keyword: Optional[str]) -> str:
    terms = []
    if full_name and full_name.strip():
        terms.append(f'"{full_name.strip()}"')
    if keyword and keyword.strip():
        terms.append(keyword.strip())
    return " ".join(terms)


def mention_hits(client: httpx.Client, api_key: str, query: str) -> List[ScanHit]:
    if not query:
        return []
    response = client.get(
        SERPAPI_SEARCH_URL,
        params={"engine": "google", "q": query, "api_key": api_key},
        timeout=60.0,
    )
    if response.status_code >= 400:
        raise HTTPException(status_code=502, detail=serpapi_detail(response))
    hits: List[ScanHit] = []
    for item in response.json().get("organic_results") or []:
        page_url = item.get("link") or ""
        hits.append(
            ScanHit(
                title=item.get("title") or "",
                url=page_url,
                domain=domain_of(page_url),
                match_type="mention",
                similarity_score=None,
                snippet=item.get("snippet") or "",
                thumbnail=item.get("thumbnail") or "",
            )
        )
    return hits


@app.post("/api/scan", response_model=ScanResponse)
def scan(
    selfie: UploadFile = File(...),
    full_name: Optional[str] = Form(None),
    keyword: Optional[str] = Form(None),
) -> ScanResponse:
    api_key = os.getenv("SERPAPI_API_KEY", "").strip()
    if not api_key:
        raise HTTPException(status_code=500, detail="SERPAPI_API_KEY is not configured")

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

        with httpx.Client(follow_redirects=True) as client:
            image_id = upload_image(client, api_key, compressed)
            visuals = lens_matches(client, api_key, image_id)
            results = verified_visual_hits(client, selfie_bgr, visuals)
            results.extend(mention_hits(client, api_key, mention_query(full_name, keyword)))
        return ScanResponse(results=results)
    finally:
        clear_buffer(raw_buffer)
        selfie.file.close()
        del compressed
        if selfie_bgr is not None:
            selfie_bgr.fill(0)
            del selfie_bgr
