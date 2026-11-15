"use client";

import {
  Camera,
  Check,
  Copy,
  Fingerprint,
  Flag,
  Lock,
  Mail,
  Radar,
  RotateCcw,
  Shield,
  UserRound,
  X,
} from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import Webcam from "react-webcam";

type Phase = "idle" | "scanning" | "results";
type NoticeKind = "report" | "email" | "contact";

type Trace = {
  fullName: string;
  handle: string;
  reference: string;
};

type CatalogItem = {
  id: string;
  site: string;
  pageTitle: string;
  url: string;
  snippet: string;
  indexedOn: string;
  similarity: number;
  uploader: string;
  abuse: string;
};

type ScanResult = CatalogItem & {
  report: string;
  email: string;
  contact: string;
};

type OpenNotice = {
  kind: NoticeKind;
  result: ScanResult;
};

const STEPS = [
  {
    title: "Seal the live frame",
    detail: "Reading the selfie in memory and dropping the pixels before any write.",
  },
  {
    title: "Sweep public pages",
    detail: "Checking open threads, caches, and galleries against the local demo index.",
  },
  {
    title: "Score similarity",
    detail: "Ranking how closely each page thumbnail lines up with the capture.",
  },
  {
    title: "Draft takedown actions",
    detail: "Preparing a cyber crime report, a removal email, and an uploader note.",
  },
] as const;

const CATALOG: CatalogItem[] = [
  {
    id: "lane-88421",
    site: "thread.nightlane.example",
    pageTitle: "Campus fest photos — open thread",
    url: "https://thread.nightlane.example/t/88421",
    snippet:
      "A public thread republishes a profile still beside a handle close to the optional trace.",
    indexedOn: "12 Mar 2026",
    similarity: 96,
    uploader: "nightowl_88",
    abuse: "abuse@nightlane.example",
  },
  {
    id: "pix-22091",
    site: "cdn.pixvault.example",
    pageTitle: "Cached social avatar · album 22091",
    url: "https://cdn.pixvault.example/a/22091.jpg",
    snippet:
      "An image cache still serves a resized avatar that matches the live capture closely.",
    indexedOn: "02 Feb 2026",
    similarity: 91,
    uploader: "meera.uploads",
    abuse: "abuse@pixvault.example",
  },
  {
    id: "orbit-441",
    site: "posts.orbitgram.example",
    pageTitle: "Repost · city meetup",
    url: "https://posts.orbitgram.example/p/44108",
    snippet:
      "A repost uses the same portrait as a display picture without a removal path on the page.",
    indexedOn: "19 Jan 2026",
    similarity: 84,
    uploader: "@southblock",
    abuse: "privacy@orbitgram.example",
  },
  {
    id: "metro-77",
    site: "gallery.southmetro.example",
    pageTitle: "Event gallery · winter showcase",
    url: "https://gallery.southmetro.example/events/winter-77",
    snippet:
      "An event album tags a face that lines up with the capture and the known handle.",
    indexedOn: "28 Nov 2025",
    similarity: 78,
    uploader: "desk.volunteer",
    abuse: "privacy@southmetro.example",
  },
  {
    id: "lanehost-9",
    site: "files.lanehost.example",
    pageTitle: "Public folder · avatar-crop",
    url: "https://files.lanehost.example/public/avatar-crop",
    snippet:
      "A leftover public folder exposes a cropped portrait with a moderate visual match.",
    indexedOn: "04 Oct 2025",
    similarity: 71,
    uploader: "host_guest",
    abuse: "abuse@lanehost.example",
  },
  {
    id: "quiet-12",
    site: "paste.quietnet.example",
    pageTitle: "Comment avatar on a blog paste",
    url: "https://paste.quietnet.example/notes/12",
    snippet:
      "A comment avatar is a weaker match. It is listed so you can dismiss or still request removal.",
    indexedOn: "16 Aug 2025",
    similarity: 63,
    uploader: "anon_paste",
    abuse: "abuse@quietnet.example",
  },
];

function looksLikeFullGovernmentId(value: string) {
  const compact = value.replace(/[\s-]/g, "");
  if (/\d{5,}/.test(compact)) return true;
  return /^[A-Z]{5}\d{4}[A-Z]$/i.test(compact);
}

function field(value: string, empty: string) {
  return value.trim() ? value.trim() : empty;
}

function buildNotices(item: CatalogItem, trace: Trace): Pick<ScanResult, "report" | "email" | "contact"> {
  const name = field(trace.fullName, "Not provided");
  const handle = field(trace.handle, "Not provided");
  const reference = field(trace.reference, "Not provided");

  const report = [
    "NATIONAL CYBER CRIME REPORTING PORTAL — draft",
    "Portal: https://cybercrime.gov.in",
    "Category: Other — non-consensual publication of my photograph",
    "",
    `Complainant: ${name}`,
    `Known handle or email: ${handle}`,
    `Reference keyword / last 4 digits: ${reference}`,
    "",
    "Incident",
    "A live webcam selfie was compared with a local demo index of public pages.",
    "The page below appears to republish my photograph without consent.",
    "",
    `Matched page: ${item.url}`,
    `Page title: ${item.pageTitle}`,
    `Website: ${item.site}`,
    `Observed similarity: ${item.similarity}%`,
    `Indexed on: ${item.indexedOn}`,
    `Uploader handle: ${item.uploader}`,
    "",
    "Request",
    "Please register this complaint and direct the intermediary to disable access to the image.",
    "This draft does not include a full government ID number.",
  ].join("\n");

  const email = [
    `To: ${item.abuse}`,
    `Subject: Please remove my photograph — ${item.pageTitle}`,
    "",
    "Hello,",
    "",
    "I am the person shown in a photograph on the page below. I did not consent to that publication.",
    "Please remove the image and any cached copies.",
    "",
    `Page: ${item.url}`,
    `Title: ${item.pageTitle}`,
    `Complainant: ${name}`,
    `Known handle or email: ${handle}`,
    `Reference keyword / last 4 digits: ${reference}`,
    "",
    "This notice is sent in good faith under the Information Technology Act, 2000",
    "and the intermediary due-diligence rules. I am not including a government ID number.",
    "",
    "Thank you,",
    name === "Not provided" ? "The person in the photograph" : name,
  ].join("\n");

  const contact = [
    `To: ${item.uploader} via ${item.site}`,
    "Subject: Please take down a photo of me",
    "",
    `Hello ${item.uploader},`,
    "",
    "A page you appear to have posted shows my photograph. I did not agree to that.",
    "Please delete the image and ask the site to clear caches.",
    "",
    `Page: ${item.url}`,
    `Reference keyword / last 4 digits: ${reference}`,
    "",
    "If this was a mistake, a short confirmation that it is gone is enough.",
    "I am not sending a government ID number.",
    "",
    "Thank you,",
    name === "Not provided" ? "The person in the photograph" : name,
  ].join("\n");

  return { report, email, contact };
}

function similarityTone(value: number) {
  if (value >= 90) return "border-rose-400/50 bg-rose-500/15 text-rose-100";
  if (value >= 75) return "border-amber-300/50 bg-amber-400/15 text-amber-50";
  return "border-teal-300/40 bg-teal-400/10 text-teal-100";
}

const NOTICE_META: Record<NoticeKind, { title: string; hint: string; pick: (result: ScanResult) => string }> = {
  report: {
    title: "Report to Indian Cyber Crime",
    hint: "Paste this draft into the National Cyber Crime Reporting Portal. It never asks for a full ID number.",
    pick: (result) => result.report,
  },
  email: {
    title: "Email Website to Remove",
    hint: "Send this to the site abuse desk and keep a copy of the timestamp for your records.",
    pick: (result) => result.email,
  },
  contact: {
    title: "Contact Uploader",
    hint: "A short removal request for the person who posted the page.",
    pick: (result) => result.contact,
  },
};

export default function HomePage() {
  const webcamRef = useRef<Webcam>(null);
  const timers = useRef<number[]>([]);
  const resultsRef = useRef<HTMLElement>(null);
  const titleId = useId();

  const [showCamera, setShowCamera] = useState(true);
  const [photo, setPhoto] = useState<string | null>(null);
  const [cameraError, setCameraError] = useState(false);
  const [fullName, setFullName] = useState("");
  const [handle, setHandle] = useState("");
  const [reference, setReference] = useState("");
  const [idWarning, setIdWarning] = useState(false);
  const [phase, setPhase] = useState<Phase>("idle");
  const [step, setStep] = useState(0);
  const [wiped, setWiped] = useState(false);
  const [results, setResults] = useState<ScanResult[] | null>(null);
  const [notice, setNotice] = useState<OpenNotice | null>(null);
  const [copied, setCopied] = useState(false);

  const clearTimers = () => {
    timers.current.forEach((id) => window.clearTimeout(id));
    timers.current = [];
  };

  useEffect(() => () => clearTimers(), []);

  useEffect(() => {
    if (!notice) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setNotice(null);
    };
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [notice]);

  useEffect(() => {
    if (phase === "results") {
      resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [phase]);

  const highest = useMemo(
    () => (results ? Math.max(...results.map((item) => item.similarity)) : 0),
    [results],
  );

  const capture = () => {
    const shot = webcamRef.current?.getScreenshot() ?? null;
    if (!shot) {
      setCameraError(true);
      return;
    }
    setCameraError(false);
    setPhoto(shot);
    setShowCamera(false);
    setWiped(false);
  };

  const retake = () => {
    clearTimers();
    setPhoto(null);
    setShowCamera(true);
    setWiped(false);
    setCameraError(false);
    if (phase === "scanning") {
      setPhase("idle");
      setStep(0);
    }
  };

  const endSession = () => {
    clearTimers();
    setPhoto(null);
    setShowCamera(true);
    setFullName("");
    setHandle("");
    setReference("");
    setIdWarning(false);
    setPhase("idle");
    setStep(0);
    setWiped(false);
    setResults(null);
    setNotice(null);
  };

  const scanInternet = () => {
    if (!photo || phase === "scanning") return;
    if (looksLikeFullGovernmentId(reference)) {
      setIdWarning(true);
      return;
    }
    setIdWarning(false);
    const trace: Trace = { fullName, handle, reference };
    clearTimers();
    setNotice(null);
    setPhase("scanning");
    setStep(0);
    setWiped(false);
    setResults(null);

    const later = (ms: number, run: () => void) => {
      timers.current.push(window.setTimeout(run, ms));
    };

    later(1100, () => {
      setPhoto(null);
      setFullName("");
      setHandle("");
      setReference("");
      setWiped(true);
      setStep(1);
    });
    later(2300, () => setStep(2));
    later(3500, () => setStep(3));
    later(4700, () => {
      setResults(CATALOG.map((item) => ({ ...item, ...buildNotices(item, trace) })));
      setPhase("results");
      setStep(4);
    });
  };

  const openNotice = (kind: NoticeKind, result: ScanResult) => {
    setCopied(false);
    setNotice({ kind, result });
  };

  const copyNotice = async () => {
    if (!notice) return;
    const text = NOTICE_META[notice.kind].pick(notice.result);
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="relative mx-auto min-h-screen max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-6">
        <div className="flex items-center gap-3">
          <span className="flex size-11 items-center justify-center rounded-xl border border-teal-300/30 bg-teal-400/10 text-teal-200">
            <Shield className="size-5" aria-hidden />
          </span>
          <div>
            <p className="font-mono text-[11px] tracking-[0.38em] text-teal-200/80">KAWACH-AI</p>
            <h1 className="text-xl font-semibold tracking-tight text-white sm:text-2xl">
              Personal image exposure desk
            </h1>
          </div>
        </div>
        <p className="rounded-full border border-gold/30 bg-gold/10 px-3 py-1 font-mono text-[11px] tracking-wide text-[#e4c27a]">
          Live webcam only · local demo index
        </p>
      </header>

      <div
        className="mt-6 flex gap-3 rounded-2xl border border-emerald-300/40 bg-emerald-400/10 px-4 py-4 shadow-[0_0_40px_rgba(16,185,129,0.12)]"
        role="status"
      >
        <Lock className="mt-0.5 size-5 shrink-0 text-emerald-300" aria-hidden />
        <p className="text-sm font-medium leading-relaxed text-emerald-50 sm:text-base">
          RAM-Only Zero Storage: Your selfie and info stay in temporary memory and are wiped
          immediately after scanning.
        </p>
      </div>

      <main className="mt-6 grid gap-6 lg:grid-cols-5">
        <section className="rounded-3xl border border-white/10 bg-[#0c1722]/90 p-4 shadow-2xl shadow-black/40 lg:col-span-3">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="text-sm font-medium text-white">Live webcam</h2>
            <span className="font-mono text-[11px] text-slate-400">
              {showCamera ? "Preview in memory" : wiped ? "Frame wiped" : "Held for this scan"}
            </span>
          </div>

          <div className="relative aspect-[4/3] overflow-hidden rounded-2xl bg-black">
            <span className="pointer-events-none absolute left-3 top-3 z-10 h-6 w-6 border-l-2 border-t-2 border-teal-300/80" />
            <span className="pointer-events-none absolute right-3 top-3 z-10 h-6 w-6 border-r-2 border-t-2 border-teal-300/80" />
            <span className="pointer-events-none absolute bottom-3 left-3 z-10 h-6 w-6 border-b-2 border-l-2 border-teal-300/80" />
            <span className="pointer-events-none absolute bottom-3 right-3 z-10 h-6 w-6 border-b-2 border-r-2 border-teal-300/80" />

            {showCamera ? (
              <Webcam
                ref={webcamRef}
                audio={false}
                mirrored
                screenshotFormat="image/jpeg"
                screenshotQuality={0.82}
                videoConstraints={{ facingMode: "user", width: 1280, height: 720 }}
                onUserMedia={() => setCameraError(false)}
                onUserMediaError={() => setCameraError(true)}
                className="h-full w-full object-cover"
              />
            ) : photo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={photo} alt="Captured live selfie" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
                <Lock className="size-8 text-emerald-300" aria-hidden />
                <p className="text-sm text-emerald-50">Selfie cleared from temporary memory.</p>
                <p className="max-w-xs text-xs text-slate-400">
                  The frame was discarded in the browser. Retake if you want a fresh live capture.
                </p>
              </div>
            )}

            {showCamera && !cameraError && (
              <span className="scanline pointer-events-none absolute inset-x-0 z-10 h-16 bg-gradient-to-b from-transparent via-teal-300/25 to-transparent" />
            )}
          </div>

          {cameraError && showCamera && (
            <p className="mt-3 text-sm text-amber-100" role="alert">
              Allow the live webcam in the browser prompt. This desk does not accept a photo from disk.
            </p>
          )}

          <div className="mt-4 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={capture}
              disabled={!showCamera || phase === "scanning"}
              className="inline-flex items-center gap-2 rounded-full bg-teal-300 px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-teal-200 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
            >
              <Camera className="size-4" aria-hidden />
              Capture Live Selfie
            </button>
            <button
              type="button"
              onClick={retake}
              disabled={showCamera && !photo}
              className="inline-flex items-center gap-2 rounded-full border border-white/15 px-4 py-2.5 text-sm font-medium text-slate-100 transition hover:border-teal-300/40 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
            >
              <RotateCcw className="size-4" aria-hidden />
              Retake Photo
            </button>
          </div>
        </section>

        <section className="flex flex-col rounded-3xl border border-white/10 bg-[#0c1722]/90 p-5 lg:col-span-2">
          <div className="flex items-center gap-2 text-white">
            <Fingerprint className="size-4 text-[#e4c27a]" aria-hidden />
            <h2 className="text-sm font-medium">Optional trace inputs</h2>
          </div>
          <p className="mt-2 text-xs leading-relaxed text-slate-400">
            All three fields are optional. They are copied into the takedown drafts, then cleared from
            the form when the scan finishes.
          </p>

          <label className="mt-5 block text-xs font-medium text-slate-200" htmlFor="full-name">
            Full Name
          </label>
          <input
            id="full-name"
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
            autoComplete="off"
            placeholder="How you want the complaint addressed"
            className="mt-1.5 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-sm text-white outline-none ring-teal-300/40 placeholder:text-slate-500 focus:ring-2"
          />

          <label className="mt-4 block text-xs font-medium text-slate-200" htmlFor="handle">
            Known Handle or Email
          </label>
          <input
            id="handle"
            value={handle}
            onChange={(event) => setHandle(event.target.value)}
            autoComplete="off"
            placeholder="@handle or name@email.com"
            className="mt-1.5 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-sm text-white outline-none ring-teal-300/40 placeholder:text-slate-500 focus:ring-2"
          />

          <label className="mt-4 block text-xs font-medium text-slate-200" htmlFor="reference">
            Optional Reference Keyword / Last 4 Digits
          </label>
          <input
            id="reference"
            value={reference}
            onChange={(event) => {
              setReference(event.target.value);
              setIdWarning(false);
            }}
            autoComplete="off"
            inputMode="text"
            maxLength={48}
            placeholder="Keyword or last 4 digits only"
            className="mt-1.5 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-sm text-white outline-none ring-teal-300/40 placeholder:text-slate-500 focus:ring-2"
          />
          <p className="mt-1.5 text-[11px] leading-relaxed text-slate-500">
            A keyword or the last 4 digits is enough. Do not enter a full government ID number.
          </p>
          {idWarning && (
            <p className="mt-2 text-xs text-rose-200" role="alert">
              That looks like a full ID number. Keep only a keyword or the last 4 digits.
            </p>
          )}

          <button
            type="button"
            onClick={scanInternet}
            disabled={!photo || phase === "scanning"}
            className="mt-6 inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-teal-100 disabled:cursor-not-allowed disabled:bg-slate-800 disabled:text-slate-500"
          >
            <Radar className="size-4" aria-hidden />
            {phase === "scanning" ? "Scanning…" : "Scan Internet"}
          </button>
          <p className="mt-3 text-center text-[11px] text-slate-500">
            {photo
              ? "The capture stays in this tab until the scan wipes it."
              : "Capture a live selfie to enable the scan. Uploads are not available."}
          </p>
        </section>
      </main>

      {phase === "scanning" && (
        <section className="mt-6 rounded-3xl border border-white/10 bg-[#0c1722]/90 p-5" aria-live="polite">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-medium text-white">Scan in progress</h2>
            <span className="font-mono text-[11px] text-teal-200">{Math.min(step + 1, 4)} / 4</span>
          </div>
          <div className="mt-4 h-1 overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-teal-300 transition-all duration-700"
              style={{ width: `${(Math.min(step, 4) / 4) * 100}%` }}
            />
          </div>
          <ol className="mt-5 grid gap-3 md:grid-cols-4">
            {STEPS.map((item, index) => {
              const state = index < step ? "done" : index === step ? "active" : "wait";
              return (
                <li
                  key={item.title}
                  className={`rounded-2xl border px-3 py-3 ${
                    state === "active"
                      ? "step-live border-teal-300/50 bg-teal-400/10"
                      : state === "done"
                        ? "border-emerald-300/30 bg-emerald-400/10"
                        : "border-white/10 bg-black/20"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={`flex size-6 items-center justify-center rounded-full font-mono text-[11px] ${
                        state === "wait" ? "bg-white/10 text-slate-400" : "bg-teal-300 text-slate-950"
                      }`}
                    >
                      {state === "done" ? <Check className="size-3.5" aria-hidden /> : index + 1}
                    </span>
                    <p className="text-xs font-semibold text-white">{item.title}</p>
                  </div>
                  <p className="mt-2 text-[11px] leading-relaxed text-slate-400">{item.detail}</p>
                </li>
              );
            })}
          </ol>
        </section>
      )}

      {phase === "results" && results && (
        <section ref={resultsRef} className="mt-6 scroll-mt-6" aria-live="polite">
          <div className="rounded-3xl border border-white/10 bg-[#0c1722]/90 p-5">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="font-mono text-[11px] tracking-[0.22em] text-teal-200/80">SCAN COMPLETE</p>
                <h2 className="mt-1 text-3xl font-semibold tracking-tight text-white">
                  {results.length} websites found
                </h2>
                <p className="mt-1 max-w-xl text-sm text-slate-400">
                  Sample matches from the local demo index. Highest similarity {highest}%. The live
                  frame and form fields were cleared when this scan finished.
                </p>
              </div>
              <button
                type="button"
                onClick={endSession}
                className="rounded-full border border-white/15 px-4 py-2 text-sm text-slate-200 hover:border-rose-300/40 hover:text-white"
              >
                End session & wipe drafts
              </button>
            </div>
            <dl className="mt-5 grid grid-cols-3 gap-3">
              <div className="rounded-2xl border border-white/10 bg-black/25 px-3 py-3">
                <dt className="text-[11px] text-slate-400">Websites found</dt>
                <dd className="mt-1 font-mono text-2xl text-white">{results.length}</dd>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/25 px-3 py-3">
                <dt className="text-[11px] text-slate-400">Top similarity</dt>
                <dd className="mt-1 font-mono text-2xl text-rose-200">{highest}%</dd>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/25 px-3 py-3">
                <dt className="text-[11px] text-slate-400">Pages checked</dt>
                <dd className="mt-1 font-mono text-2xl text-white">48</dd>
              </div>
            </dl>
          </div>

          <ul className="mt-4 space-y-4">
            {results.map((result) => (
              <li key={result.id} className="rounded-3xl border border-white/10 bg-[#0c1722]/90 p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-mono text-[11px] text-slate-400">{result.site}</p>
                    <h3 className="mt-1 text-lg font-semibold text-white">{result.pageTitle}</h3>
                  </div>
                  <span
                    className={`rounded-full border px-3 py-1 font-mono text-xs ${similarityTone(result.similarity)}`}
                  >
                    {result.similarity}% similarity
                  </span>
                </div>
                <p className="mt-3 text-sm leading-relaxed text-slate-300">{result.snippet}</p>
                <p className="mt-3 break-all font-mono text-[11px] text-teal-100/80">{result.url}</p>
                <p className="mt-2 text-[11px] text-slate-500">
                  Indexed {result.indexedOn} · Uploader {result.uploader}
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => openNotice("report", result)}
                    className="inline-flex items-center gap-2 rounded-full border border-rose-300/40 bg-rose-400/10 px-3 py-2 text-xs font-medium text-rose-50 hover:bg-rose-400/20"
                  >
                    <Flag className="size-3.5" aria-hidden />
                    Report to Indian Cyber Crime
                  </button>
                  <button
                    type="button"
                    onClick={() => openNotice("email", result)}
                    className="inline-flex items-center gap-2 rounded-full border border-[#e4c27a]/40 bg-[#e4c27a]/10 px-3 py-2 text-xs font-medium text-[#f3e2bc] hover:bg-[#e4c27a]/20"
                  >
                    <Mail className="size-3.5" aria-hidden />
                    Email Website to Remove
                  </button>
                  <button
                    type="button"
                    onClick={() => openNotice("contact", result)}
                    className="inline-flex items-center gap-2 rounded-full border border-teal-300/40 bg-teal-400/10 px-3 py-2 text-xs font-medium text-teal-50 hover:bg-teal-400/20"
                  >
                    <UserRound className="size-3.5" aria-hidden />
                    Contact Uploader
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <footer className="mt-10 border-t border-white/10 py-6 text-xs leading-relaxed text-slate-500">
        KAWACH keeps the webcam frame in temporary memory and never offers a file upload. Matches on
        this page are a built-in demo set so the report, email, and uploader actions can be reviewed
        without sending a photo anywhere.
      </footer>

      {notice && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 sm:items-center"
          role="presentation"
          onClick={() => setNotice(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className="max-h-[85vh] w-full max-w-xl overflow-hidden rounded-3xl border border-white/15 bg-[#0b141d] shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 border-b border-white/10 px-5 py-4">
              <div>
                <h2 id={titleId} className="text-base font-semibold text-white">
                  {NOTICE_META[notice.kind].title}
                </h2>
                <p className="mt-1 text-xs text-slate-400">{NOTICE_META[notice.kind].hint}</p>
              </div>
              <button
                type="button"
                onClick={() => setNotice(null)}
                className="rounded-full border border-white/10 p-1.5 text-slate-300 hover:text-white"
                aria-label="Close"
              >
                <X className="size-4" />
              </button>
            </div>
            <pre className="max-h-[46vh] overflow-auto whitespace-pre-wrap px-5 py-4 font-mono text-[11px] leading-relaxed text-slate-200">
              {NOTICE_META[notice.kind].pick(notice.result)}
            </pre>
            <div className="flex items-center justify-between gap-3 border-t border-white/10 px-5 py-4">
              <p className="text-xs text-emerald-200" role="status">
                {copied ? "Copied" : "Ready to copy"}
              </p>
              <button
                type="button"
                onClick={copyNotice}
                className="inline-flex items-center gap-2 rounded-full bg-teal-300 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-teal-200"
              >
                <Copy className="size-4" aria-hidden />
                Copy to Clipboard
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
