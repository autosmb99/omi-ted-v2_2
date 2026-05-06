"use client";
import useSWR from "swr";
import axios from "axios";
import { useState } from "react";
import { motion } from "motion/react";

interface VideoSummary { youtube_id: string; title: string | null; segment_count: number; status: string; }
const fetcher = (u: string) => axios.get(u).then(r => r.data);

const FORMATS = [
  { id: "raw",    label: "Raw pairs",    desc: '{"te":"…","en":"…"} — simplest, most flexible' },
  { id: "alpaca", label: "Alpaca",       desc: '{"instruction","input","output"} — instruction tuning' },
  { id: "openai", label: "OpenAI chat",  desc: '{"messages":[system,user,assistant]} — ChatML format' },
];

const SPLITS = [
  { id: "none",  label: "All data", desc: "Single file — use for inference or custom splitting" },
  { id: "train", label: "Train (80%)", desc: "Training set — largest chunk" },
  { id: "val",   label: "Validation (10%)", desc: "Validation set — hyperparameter tuning" },
  { id: "test",  label: "Test (10%)", desc: "Test set — final evaluation only" },
];

export default function ExportPage() {
  const { data: videos } = useSWR<VideoSummary[]>("/api/v1/videos", fetcher);
  const [format, setFormat] = useState("raw");
  const [split, setSplit] = useState("none");
  const [reviewedOnly, setReviewedOnly] = useState(true);
  const fetched = (videos ?? []).filter(v => v.status === "fetched");

  function buildUrl(yid: string | null) {
    const params = new URLSearchParams();
    if (yid) params.set("youtube_id", yid);
    params.set("format", format);
    params.set("split", split);
    if (reviewedOnly) params.set("reviewed_only", "true");
    return `/api/v1/export/jsonl?${params.toString()}`;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
      <div>
        <h1 style={{ fontSize: 20, fontWeight: 600, color: "var(--gray-900)" }}>Export</h1>
        <p style={{ fontSize: 13, color: "var(--gray-400)", marginTop: 4 }}>
          Download your dataset for fine-tuning. Use splits to get train/val/test sets. Gold-only means human-edited segments only.
        </p>
      </div>

      {/* Format picker */}
      <div style={{ background: "var(--white)", border: "1px solid var(--gray-200)", borderRadius: 12, padding: 20 }}>
        <p style={{ fontSize: 12, fontWeight: 600, color: "var(--gray-400)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 14 }}>Format</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {FORMATS.map(f => (
            <button key={f.id} onClick={() => setFormat(f.id)}
              style={{
                padding: "12px 14px", borderRadius: 8, textAlign: "left", cursor: "pointer",
                border: `1px solid ${format === f.id ? "var(--rose)" : "var(--gray-200)"}`,
                background: format === f.id ? "var(--rose-light)" : "var(--white)",
              }}>
              <p style={{ fontSize: 13, fontWeight: format === f.id ? 600 : 400, color: format === f.id ? "var(--rose)" : "var(--gray-900)", marginBottom: 2 }}>
                {f.label}
              </p>
              <p style={{ fontSize: 11, color: "var(--gray-400)", fontFamily: "JetBrains Mono" }}>{f.desc}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Split picker */}
      <div style={{ background: "var(--white)", border: "1px solid var(--gray-200)", borderRadius: 12, padding: 20 }}>
        <p style={{ fontSize: 12, fontWeight: 600, color: "var(--gray-400)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 14 }}>Dataset split</p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 8 }}>
          {SPLITS.map(s => (
            <button key={s.id} onClick={() => setSplit(s.id)}
              style={{
                padding: "12px 14px", borderRadius: 8, textAlign: "left", cursor: "pointer",
                border: `1px solid ${split === s.id ? "var(--rose)" : "var(--gray-200)"}`,
                background: split === s.id ? "var(--rose-light)" : "var(--white)",
              }}>
              <p style={{ fontSize: 13, fontWeight: split === s.id ? 600 : 400, color: split === s.id ? "var(--rose)" : "var(--gray-900)", marginBottom: 2 }}>
                {s.label}
              </p>
              <p style={{ fontSize: 11, color: "var(--gray-400)" }}>{s.desc}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Quality toggle */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, background: "var(--white)", border: "1px solid var(--gray-200)", borderRadius: 12, padding: "14px 20px" }}>
        <input
          id="reviewed-only"
          type="checkbox"
          checked={reviewedOnly}
          onChange={e => setReviewedOnly(e.target.checked)}
          style={{ width: 16, height: 16, accentColor: "var(--rose)", cursor: "pointer" }}
        />
        <label htmlFor="reviewed-only" style={{ fontSize: 13, color: "var(--gray-700)", cursor: "pointer" }}>
          <strong>Gold only</strong> — only export human-edited, reviewed segments
        </label>
      </div>

      {/* Global download */}
      <div style={{ background: "var(--white)", border: "1px solid var(--gray-200)", borderRadius: 12, padding: 20 }}>
        <p style={{ fontSize: 12, fontWeight: 600, color: "var(--gray-400)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 14 }}>Full dataset</p>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <a href={buildUrl(null)}
            style={{ flex: 1, display: "block", padding: "12px 0", borderRadius: 8, border: "none", background: "var(--rose)", color: "#fff", fontSize: 13, fontWeight: 600, textDecoration: "none", textAlign: "center" }}>
            ↓ Download .jsonl
          </a>
          <a href={`/api/v1/export/csv?${reviewedOnly ? "reviewed_only=true&" : ""}`}
            style={{ flex: 1, display: "block", padding: "12px 0", borderRadius: 8, border: "1px solid var(--gray-200)", color: "var(--gray-600)", fontSize: 13, fontWeight: 500, textDecoration: "none", textAlign: "center" }}>
            ↓ Download .csv
          </a>
        </div>
      </div>

      {/* Per-video */}
      {fetched.length > 0 && (
        <div style={{ background: "var(--white)", border: "1px solid var(--gray-200)", borderRadius: 12, overflow: "hidden" }}>
          <div style={{ padding: "14px 20px", borderBottom: "1px solid var(--gray-100)" }}>
            <p style={{ fontSize: 12, fontWeight: 600, color: "var(--gray-400)", textTransform: "uppercase", letterSpacing: "0.07em" }}>Per video</p>
          </div>
          {fetched.map((v, i) => (
            <motion.div key={v.youtube_id}
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.03 }}
              style={{ display: "flex", alignItems: "center", gap: 16, padding: "14px 20px", borderTop: i > 0 ? "1px solid var(--gray-100)" : "none", flexWrap: "wrap" }}>
              <div style={{ flex: 1, minWidth: 200 }}>
                <p style={{ fontSize: 13, fontWeight: 500, color: "var(--gray-900)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {v.title || v.youtube_id}
                </p>
                <p style={{ fontSize: 11, color: "var(--gray-400)", fontFamily: "JetBrains Mono", marginTop: 2 }}>{v.segment_count} segments</p>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <a href={buildUrl(v.youtube_id)}
                  style={{ padding: "7px 14px", borderRadius: 6, background: "var(--rose)", color: "#fff", fontSize: 11, fontWeight: 600, textDecoration: "none" }}>
                  ↓ JSONL
                </a>
                <a href={`/api/v1/export/csv?youtube_id=${v.youtube_id}${reviewedOnly ? "&reviewed_only=true" : ""}`}
                  style={{ padding: "7px 14px", borderRadius: 6, border: "1px solid var(--gray-200)", color: "var(--gray-500)", fontSize: 11, textDecoration: "none" }}>
                  CSV
                </a>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
