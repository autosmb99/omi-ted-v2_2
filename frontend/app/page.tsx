"use client";

import useSWR from "swr";
import Link from "next/link";
import axios from "axios";

interface VideoSummary {
  id: number;
  youtube_id: string;
  title: string | null;
  channel: string | null;
  duration_s: number | null;
  status: string;
  segment_count: number;
  fetched_at: string | null;
}

const fetcher = (url: string) => axios.get(url).then((r) => r.data);

function fmt(s: number | null) {
  if (!s) return "—";
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

const STATUS_PILL: Record<string, string> = {
  fetched: "bg-green-100 text-green-800",
  fetching: "bg-blue-100 text-blue-800",
  pending: "bg-gray-100 text-gray-600",
  error: "bg-red-100 text-red-700",
  no_transcript: "bg-yellow-100 text-yellow-800",
};

export default function Home() {
  const { data: videos, error, isLoading } = useSWR<VideoSummary[]>(
    "/api/v1/videos",
    fetcher,
    { refreshInterval: 5000 }
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Videos</h1>
          <p className="text-sm text-gray-500 mt-1">
            Telugu sermon transcripts — click a row to open the editor
          </p>
        </div>
      </div>

      <div className="rounded-lg border border-gray-200 dark:border-gray-800 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800">
            <tr>
              {["Title", "Channel", "Duration", "Segments", "Status", ""].map((h) => (
                <th key={h} className="px-4 py-3 text-left font-medium text-gray-500 text-xs uppercase tracking-wider">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {isLoading && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-400">
                  Loading…
                </td>
              </tr>
            )}
            {error && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-red-500">
                  Failed to load videos — is the backend running?
                </td>
              </tr>
            )}
            {videos?.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-400">
                  No videos yet. Use POST /api/v1/ingest/ to add one.
                </td>
              </tr>
            )}
            {videos?.map((v) => (
              <tr key={v.id} className="hover:bg-gray-50 dark:hover:bg-gray-900/50">
                <td className="px-4 py-3 max-w-xs truncate font-medium">
                  {v.title || v.youtube_id}
                </td>
                <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                  {v.channel || "—"}
                </td>
                <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                  {fmt(v.duration_s)}
                </td>
                <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                  {v.segment_count.toLocaleString()}
                </td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${STATUS_PILL[v.status] ?? "bg-gray-100 text-gray-600"}`}>
                    {v.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  {v.status === "fetched" && (
                    <Link
                      href={`/editor/${v.youtube_id}`}
                      className="text-blue-600 hover:underline text-xs font-medium"
                    >
                      Edit →
                    </Link>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
