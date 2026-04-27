"use client";
import { useState } from "react";
import useSWR from "swr";
import Link from "next/link";
import axios from "axios";
import { motion, AnimatePresence } from "motion/react";

interface VideoSummary {
  id: number; youtube_id: string; title: string | null;
  segment_count: number; status: string;
}

const fetcher = (u: string) => axios.get(u).then(r => r.data);

export default function QueuePage() {
  const { data: videos, isLoading, mutate } = useSWR<VideoSummary[]>("/api/v1/videos", fetcher, { refreshInterval: 5000 });
  const [deleting, setDeleting] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const queue = (videos ?? []).filter(v => v.status === "fetched");

  async function deleteVideo(youtubeId: string) {
    setDeleting(youtubeId);
    try {
      await axios.delete(`/api/v1/videos/${youtubeId}`);
      mutate();
    } catch (e) {
      console.error(e);
    } finally {
      setDeleting(null);
      setConfirmId(null);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <div>
        <h1 style={{ fontSize: 20, fontWeight: 600, color: "var(--gray-900)" }}>Work Queue</h1>
        <p style={{ fontSize: 13, color: "var(--gray-400)", marginTop: 4 }}>
          Videos ready to translate. Open one to start editing segments.
        </p>
      </div>

      {isLoading && (
        <p style={{ color: "var(--gray-400)", fontSize: 13, textAlign: "center", padding: "40px 0" }}>Loading…</p>
      )}

      {queue.length === 0 && !isLoading && (
        <div style={{ background: "var(--gray-50)", border: "1px solid var(--gray-200)", borderRadius: 12, padding: "48px 24px", textAlign: "center" }}>
          <p style={{ fontSize: 14, fontWeight: 500, color: "var(--gray-900)", marginBottom: 6 }}>No videos in queue</p>
          <p style={{ fontSize: 12, color: "var(--gray-400)", marginBottom: 16 }}>
            Paste a YouTube URL on the Videos page to ingest a sermon.
          </p>
          <Link href="/"
            style={{ display: "inline-block", padding: "8px 20px", borderRadius: 8, background: "var(--rose)", color: "#fff", fontSize: 12, fontWeight: 600, textDecoration: "none" }}>
            Add videos →
          </Link>
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <AnimatePresence>
          {queue.map((v, i) => (
            <motion.div key={v.youtube_id}
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, height: 0, marginBottom: 0 }}
              transition={{ delay: i * 0.04, type: "spring", stiffness: 380, damping: 28 }}
              style={{ background: "var(--white)", border: "1px solid var(--gray-200)", borderRadius: 12, padding: "16px 20px", display: "flex", alignItems: "center", gap: 16 }}>

              {/* Title + ID */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 14, fontWeight: 500, color: "var(--gray-900)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {v.title || v.youtube_id}
                </p>
                {v.title && (
                  <p style={{ fontSize: 11, color: "var(--gray-400)", fontFamily: "JetBrains Mono", marginTop: 3 }}>
                    {v.youtube_id}
                  </p>
                )}
              </div>

              {/* Segment count */}
              <span style={{ fontSize: 12, color: "var(--gray-400)", whiteSpace: "nowrap" }}>
                {v.segment_count.toLocaleString()} segments
              </span>

              {/* Edit button */}
              <Link href={`/editor/${v.youtube_id}`}
                style={{ padding: "7px 16px", borderRadius: 8, background: "var(--rose)", color: "#fff", fontSize: 12, fontWeight: 600, textDecoration: "none", whiteSpace: "nowrap" }}>
                Edit →
              </Link>

              {/* Delete — confirm inline */}
              {confirmId === v.youtube_id ? (
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ fontSize: 11, color: "var(--gray-500)" }}>Delete?</span>
                  <button
                    onClick={() => deleteVideo(v.youtube_id)}
                    disabled={deleting === v.youtube_id}
                    style={{ padding: "5px 12px", borderRadius: 7, border: "none", background: "#ef4444", color: "#fff", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>
                    {deleting === v.youtube_id ? "…" : "Yes"}
                  </button>
                  <button onClick={() => setConfirmId(null)}
                    style={{ padding: "5px 10px", borderRadius: 7, border: "1px solid var(--gray-200)", background: "var(--white)", color: "var(--gray-500)", fontSize: 11, cursor: "pointer" }}>
                    No
                  </button>
                </div>
              ) : (
                <button onClick={() => setConfirmId(v.youtube_id)}
                  title="Delete video and all its segments"
                  style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid var(--gray-200)", background: "var(--white)", color: "var(--gray-400)", fontSize: 12, cursor: "pointer" }}>
                  🗑
                </button>
              )}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
