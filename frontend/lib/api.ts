/**
 * Axios client for all backend calls.
 *
 * All requests go to /api/v1/... which next.config.js rewrites to the backend.
 * Never import the backend URL directly in components — always use this client.
 */
import axios from "axios";

const api = axios.create({
  baseURL: "/api/v1",
  headers: {
    "Content-Type": "application/json",
  },
});

export default api;

// ---------------------------------------------------------------------------
// Typed helpers — expand as M1, M2, M3 endpoints are built
// ---------------------------------------------------------------------------

export interface VideoSummary {
  id: number;
  youtube_id: string;
  title: string | null;
  channel: string | null;
  duration_s: number | null;
  status: "pending" | "fetching" | "fetched" | "no_transcript" | "error";
  fetched_at: string | null;
  created_at: string;
}

export interface Segment {
  id: number;
  video_id: number;
  segment_index: number;
  start_time: number;
  duration: number;
  te_original: string;
  en_auto: string | null;
  en_human: string | null;
  en_final: string | null;
  content_type: "sermon" | "song" | "prayer" | "unknown";
  is_reviewed: boolean;
  quality_score: number | null;
}
