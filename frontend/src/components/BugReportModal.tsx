"use client";

import { Bug, Check, ExternalLink, Loader2, Send, X } from "lucide-react";
import { useState } from "react";

interface BugReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentPhase?: string;
}

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:8000";
// Optional: paste your Google Doc link here if you want users/testers to be able to open the Doc directly
const GOOGLE_DOC_VIEW_URL = process.env.NEXT_PUBLIC_BUG_DOC_URL || "";

export default function BugReportModal({
  isOpen,
  onClose,
  currentPhase = "idle",
}: BugReportModalProps) {
  const [category, setCategory] = useState("UI / Layout");
  const [description, setDescription] = useState("");
  const [sending, setSending] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim() || sending) return;

    setSending(true);
    setErrorMsg(null);

    try {
      const response = await fetch(`${API_BASE}/api/report-bug`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category,
          description: description.trim(),
          phase: currentPhase,
          user_agent: typeof navigator !== "undefined" ? navigator.userAgent : "Unknown",
          timestamp: new Date().toISOString(),
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to log bug report.");
      }

      setSubmitted(true);
      if (!GOOGLE_DOC_VIEW_URL) {
        setTimeout(() => {
          setSubmitted(false);
          setDescription("");
          onClose();
        }, 1600);
      }
    } catch {
      setErrorMsg("Could not reach FastAPI backend. Ensure Uvicorn is running.");
    } finally {
      setSending(false);
    }
  };

  const resetAndClose = () => {
    setSubmitted(false);
    setDescription("");
    setErrorMsg(null);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 sm:items-center"
      onClick={resetAndClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="bug-modal-title"
        className="w-full max-w-md rounded-3xl border border-white/15 bg-[#0b141d] p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-white/10 pb-3.5">
          <div className="flex items-center gap-2.5">
            <span className="flex size-8 items-center justify-center rounded-xl border border-amber-300/25 bg-amber-400/10 text-amber-300">
              <Bug className="size-4" aria-hidden />
            </span>
            <div>
              <h2 id="bug-modal-title" className="text-sm font-semibold text-white">
                Report a Bug
              </h2>
              <p className="text-[11px] text-slate-400">
                Appends directly to our Google Doc without touching scan memory.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={resetAndClose}
            className="rounded-full border border-white/10 p-1 text-slate-400 hover:text-white"
            aria-label="Close bug report modal"
          >
            <X className="size-4" />
          </button>
        </div>

        {submitted ? (
          <div className="flex flex-col items-center justify-center gap-3 py-8 text-center">
            <span className="flex size-10 items-center justify-center rounded-full bg-emerald-400/15 text-emerald-300">
              <Check className="size-5" />
            </span>
            <p className="text-sm font-medium text-white">Bug logged to Google Docs!</p>
            {GOOGLE_DOC_VIEW_URL && (
              <a
                href={GOOGLE_DOC_VIEW_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1 inline-flex items-center gap-1.5 rounded-full border border-teal-300/40 bg-teal-400/10 px-4 py-2 text-xs font-semibold text-teal-100 hover:bg-teal-400/20"
              >
                Open Google Doc <ExternalLink className="size-3.5" />
              </a>
            )}
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-4 space-y-4">
            <div>
              <label htmlFor="bug-category" className="block text-xs font-medium text-slate-300">
                Issue Area
              </label>
              <select
                id="bug-category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="mt-1.5 w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-xs text-white outline-none focus:border-teal-300/50"
              >
                <option value="Webcam / Capture">Webcam / Live Capture</option>
                <option value="Scan Results / Matching">Scan Results / Matching</option>
                <option value="Legal Action Modal">Legal Action Modal</option>
                <option value="UI / Layout">UI / Layout</option>
                <option value="Backend / API Error">Backend / API Error</option>
              </select>
            </div>

            <div>
              <label htmlFor="bug-desc" className="block text-xs font-medium text-slate-300">
                Description
              </label>
              <textarea
                id="bug-desc"
                rows={4}
                required
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe what happened or paste any error message..."
                className="mt-1.5 w-full rounded-xl border border-white/10 bg-black/40 p-3 text-xs text-white placeholder:text-slate-500 outline-none focus:border-teal-300/50"
              />
            </div>

            {errorMsg && (
              <p className="text-xs text-rose-300" role="alert">
                {errorMsg}
              </p>
            )}

            <div className="flex items-center justify-between gap-2 pt-1">
              {GOOGLE_DOC_VIEW_URL ? (
                <a
                  href={GOOGLE_DOC_VIEW_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-full border border-white/15 px-3 py-1.5 text-xs text-slate-300 hover:text-white"
                >
                  View Doc <ExternalLink className="size-3" />
                </a>
              ) : (
                <span />
              )}

              <button
                type="submit"
                disabled={!description.trim() || sending}
                className="inline-flex items-center gap-1.5 rounded-full bg-teal-300 px-4 py-2 text-xs font-semibold text-slate-950 transition hover:bg-teal-200 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {sending ? (
                  <>
                    <Loader2 className="size-3.5 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Send className="size-3.5" />
                    Submit to Google Doc
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}