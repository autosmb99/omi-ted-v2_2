"use client";
import useSWR from "swr";
import Link from "next/link";
import axios from "axios";
import { motion } from "motion/react";

interface VideoProgress {
  youtube_id: string; title: string | null;
  total_segments: number; reviewed_segments: number;
  human_edited: number; auto_only: number; empty: number;
  pct_done: number; est_minutes_translated: number;
}
interface ConsistencyIssue { te_word: string; translations: string[]; occurrence_count: number; }
interface ActivityPoint { date: string; edits: number; }
interface MeaningfulStats {
  total_videos: number; total_segments: number;
  total_human_edits: number; total_auto_translations: number; total_untranslated: number;
  pct_dataset_complete: number;
  est_tokens_gold: number; est_tokens_silver: number;
  videos: VideoProgress[];
  consistency_issues: ConsistencyIssue[];
  glossary_coverage_pct: number;
  activity_last_30d: ActivityPoint[];
}

const fetcher = (u: string) => axios.get(u).then(r => r.data);

const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.06 } } };
const fadeUp  = { hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0, transition: { type: "spring" as const, stiffness: 380, damping: 28 } } };

export default function ProgressPage() {
  const { data, error, isLoading } = useSWR<MeaningfulStats>("/api/v1/stats", fetcher, { refreshInterval: 8000 });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
      <div>
        <h1 style={{ fontSize: 20, fontWeight: 600, color: "var(--gray-900)" }}>Progress</h1>
        <p style={{ fontSize: 13, color: "var(--gray-400)", marginTop: 4 }}>
          Real translation velocity. How much gold data you have, where gaps are, what needs consistency work.
        </p>
      </div>

      {isLoading && <p style={{ color: "var(--gray-400)", fontSize: 13, padding: "40px 0", textAlign: "center" }}>Loading…</p>}
      {error    && <p style={{ color: "var(--red)",      fontSize: 13, padding: "40px 0", textAlign: "center" }}>Backend not reachable.</p>}

      {data && (
        <>
          {/* Headline cards */}
          <motion.div variants={stagger} initial="hidden" animate="show"
            style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 16 }}>
            {[
              { label: "Videos", n: data.total_videos, color: "var(--gray-500)", bg: "var(--gray-100)", border: "var(--gray-200)", desc: "Total ingested" },
              { label: "Segments", n: data.total_segments, color: "var(--gray-900)", bg: "var(--gray-100)", border: "var(--gray-200)", desc: "Total captions" },
              { label: "Human edits", n: data.total_human_edits, color: "var(--rose)", bg: "var(--rose-light)", border: "var(--rose-border)", desc: "Gold quality" },
              { label: "Auto only", n: data.total_auto_translations, color: "var(--amber)", bg: "var(--amber-light)", border: "var(--amber-border)", desc: "Needs review" },
              { label: "Untranslated", n: data.total_untranslated, color: "var(--gray-400)", bg: "var(--gray-100)", border: "var(--gray-200)", desc: "Missing en_final" },
              { label: "Est. tokens (gold)", n: data.est_tokens_gold, color: "var(--green)", bg: "var(--green-light)", border: "var(--green-border)", desc: "Trainable data" },
            ].map(({ label, n, color, bg, border, desc }) => (
              <motion.div key={label} variants={fadeUp}
                style={{ background: "var(--white)", border: `1px solid ${border}`, borderRadius: 12, padding: "18px 18px 14px" }}>
                <p style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--gray-400)", marginBottom: 8 }}>{label}</p>
                <p style={{ fontSize: 28, fontWeight: 700, color, lineHeight: 1 }}>{n.toLocaleString()}</p>
                <p style={{ fontSize: 11, color: "var(--gray-400)", marginTop: 4 }}>{desc}</p>
              </motion.div>
            ))}
          </motion.div>

          {/* Overall completion bar */}
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
            style={{ background: "var(--white)", border: "1px solid var(--gray-200)", borderRadius: 12, padding: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
              <p style={{ fontSize: 13, fontWeight: 600, color: "var(--gray-900)" }}>Dataset completion</p>
              <p style={{ fontSize: 13, fontWeight: 700, color: "var(--rose)" }}>{data.pct_dataset_complete.toFixed(1)}%</p>
            </div>
            <div style={{ height: 12, borderRadius: 99, background: "var(--gray-100)", overflow: "hidden", display: "flex", gap: 1 }}>
              {[
                { pct: data.pct_dataset_complete, color: "var(--rose)" },
                { pct: Math.max(0, 100 - data.pct_dataset_complete), color: "var(--gray-200)" },
              ].map(({ pct, color }, i) => (
                <motion.div key={i} style={{ background: color, height: "100%" }}
                  initial={{ width: 0 }} animate={{ width: `${pct}%` }}
                  transition={{ duration: 0.9, delay: i * 0.08, ease: [0.22,1,0.36,1] }} />
              ))}
            </div>
            <div style={{ display: "flex", gap: 16, marginTop: 8, fontSize: 11, color: "var(--gray-400)" }}>
              <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--rose)", display: "inline-block" }} />Human-edited
              </span>
              <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--gray-200)", display: "inline-block" }} />Remaining
              </span>
            </div>
          </motion.div>

          {/* Per-video table */}
          <div>
            <h2 style={{ fontSize: 15, fontWeight: 600, color: "var(--gray-900)", marginBottom: 12 }}>Per-video progress</h2>
            <div style={{ background: "var(--white)", border: "1px solid var(--gray-200)", borderRadius: 12, overflow: "hidden" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "var(--gray-50)", borderBottom: "1px solid var(--gray-200)" }}>
                    {["Video", "Segments", "Human", "Auto", "Empty", "Done %", "Time spent", ""].map(h => (
                      <th key={h} style={{ padding: "10px 14px", textAlign: "left", fontSize: 11, fontWeight: 600, color: "var(--gray-400)", textTransform: "uppercase", letterSpacing: "0.06em" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.videos.map((v, i) => (
                    <motion.tr key={v.youtube_id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.03 }}
                      style={{ borderTop: "1px solid var(--gray-100)" }}>
                      <td style={{ padding: "10px 14px" }}>
                        <p style={{ fontSize: 13, fontWeight: 500, color: "var(--gray-900)" }}>{v.title || v.youtube_id}</p>
                        <p style={{ fontSize: 10, color: "var(--gray-400)", fontFamily: "JetBrains Mono" }}>{v.youtube_id}</p>
                      </td>
                      <td style={{ padding: "10px 14px", fontSize: 12, color: "var(--gray-600)", fontFamily: "JetBrains Mono" }}>{v.total_segments}</td>
                      <td style={{ padding: "10px 14px", fontSize: 12, color: "var(--rose)", fontWeight: 600 }}>{v.human_edited}</td>
                      <td style={{ padding: "10px 14px", fontSize: 12, color: "var(--amber)" }}>{v.auto_only}</td>
                      <td style={{ padding: "10px 14px", fontSize: 12, color: "var(--gray-400)" }}>{v.empty}</td>
                      <td style={{ padding: "10px 14px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <div style={{ width: 60, height: 6, borderRadius: 99, background: "var(--gray-100)", overflow: "hidden" }}>
                            <div style={{ width: `${v.pct_done}%`, height: "100%", background: v.pct_done >= 100 ? "var(--green)" : "var(--rose)", borderRadius: 99 }} />
                          </div>
                          <span style={{ fontSize: 11, color: "var(--gray-500)", fontFamily: "JetBrains Mono" }}>{v.pct_done.toFixed(0)}%</span>
                        </div>
                      </td>
                      <td style={{ padding: "10px 14px", fontSize: 11, color: "var(--gray-400)", fontFamily: "JetBrains Mono" }}>{v.est_minutes_translated}m</td>
                      <td style={{ padding: "10px 14px", textAlign: "right" }}>
                        <Link href={`/editor/${v.youtube_id}`}
                          style={{ fontSize: 12, fontWeight: 600, color: "var(--rose)", textDecoration: "none" }}>
                          Edit →
                        </Link>
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Consistency issues */}
          {data.consistency_issues.length > 0 && (
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
                <h2 style={{ fontSize: 15, fontWeight: 600, color: "var(--gray-900)" }}>Consistency issues</h2>
                <span style={{ fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 20, background: "var(--amber-light)", color: "var(--amber)", border: "1px solid var(--amber-border)" }}>
                  {data.consistency_issues.length} words
                </span>
              </div>
              <p style={{ fontSize: 12, color: "var(--gray-400)", marginBottom: 12 }}>
                Same Telugu word translated differently across segments. Pick one and standardize in the editor.
              </p>
              <div style={{ background: "var(--white)", border: "1px solid var(--gray-200)", borderRadius: 12, overflow: "hidden" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ background: "var(--gray-50)", borderBottom: "1px solid var(--gray-200)" }}>
                      {["Telugu word", "Occurrences", "Translations used", ""].map(h => (
                        <th key={h} style={{ padding: "10px 14px", textAlign: "left", fontSize: 11, fontWeight: 600, color: "var(--gray-400)", textTransform: "uppercase", letterSpacing: "0.06em" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.consistency_issues.map(issue => (
                      <tr key={issue.te_word} style={{ borderTop: "1px solid var(--gray-100)" }}>
                        <td style={{ padding: "10px 14px", fontFamily: "'Noto Sans Telugu', sans-serif", fontSize: 15, color: "var(--gray-900)", fontWeight: 500 }}>
                          {issue.te_word}
                        </td>
                        <td style={{ padding: "10px 14px", fontSize: 12, color: "var(--gray-500)", fontFamily: "JetBrains Mono" }}>
                          {issue.occurrence_count}
                        </td>
                        <td style={{ padding: "10px 14px" }}>
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                            {issue.translations.map((t, i) => (
                              <span key={i} style={{
                                fontSize: 11, padding: "2px 8px", borderRadius: 6, fontWeight: 500,
                                background: "var(--rose-light)", color: "var(--rose)", border: "1px solid var(--rose-border)",
                              }}>
                                {t}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td style={{ padding: "10px 14px", textAlign: "right" }}>
                          <Link href="/glossary"
                            style={{ fontSize: 11, color: "var(--rose)", textDecoration: "none", fontWeight: 500 }}>
                            Add to glossary →
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Glossary coverage */}
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
            style={{ background: "var(--white)", border: "1px solid var(--gray-200)", borderRadius: 12, padding: 20 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
              <p style={{ fontSize: 13, fontWeight: 600, color: "var(--gray-900)" }}>Glossary coverage</p>
              <p style={{ fontSize: 13, fontWeight: 700, color: data.glossary_coverage_pct >= 80 ? "var(--green)" : "var(--amber)" }}>
                {data.glossary_coverage_pct.toFixed(0)}%
              </p>
            </div>
            <div style={{ height: 8, borderRadius: 99, background: "var(--gray-100)", overflow: "hidden" }}>
              <motion.div style={{ height: "100%", background: data.glossary_coverage_pct >= 80 ? "var(--green)" : "var(--amber)", borderRadius: 99 }}
                initial={{ width: 0 }} animate={{ width: `${Math.min(100, data.glossary_coverage_pct)}%` }}
                transition={{ duration: 0.8, ease: [0.22,1,0.36,1] }} />
            </div>
            <p style={{ fontSize: 11, color: "var(--gray-400)", marginTop: 8 }}>
              {data.glossary_coverage_pct < 30 ? "Add more glossary terms for consistency." : "Good coverage — keep adding as you find new terms."}
            </p>
          </motion.div>
        </>
      )}
    </div>
  );
}
