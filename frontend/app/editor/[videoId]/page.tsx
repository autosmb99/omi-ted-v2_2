"use client";

import { useState, useCallback } from "react";
import { useParams } from "next/navigation";
import useSWR from "swr";
import Link from "next/link";
import axios from "axios";
import ParallelEditor, { Segment } from "@/components/ParallelEditor";

interface SegmentsPage {
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
  items: Segment[];
}

const fetcher = (url: string) => axios.get(url).then((r) => r.data);
const PAGE_SIZE = 50;

export default function EditorPage() {
  const params = useParams();
  const videoId = params.videoId as string;
  const [page, setPage] = useState(1);

  const { data, error, isLoading, mutate } = useSWR<SegmentsPage>(
    `/api/v1/videos/${videoId}/segments?page=${page}&page_size=${PAGE_SIZE}`,
    fetcher
  );

  // Optimistically update a segment in the local cache
  const handleSegmentUpdate = useCallback(
    (id: number, updated: Partial<Segment>) => {
      mutate(
        (prev) =>
          prev
            ? {
                ...prev,
                items: prev.items.map((s) =>
                  s.id === id ? { ...s, ...updated } : s
                ),
              }
            : prev,
        false
      );
    },
    [mutate]
  );

  const reviewedCount = data?.items.filter((s) => s.is_reviewed).length ?? 0;
  const totalOnPage = data?.items.length ?? 0;

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link href="/" className="text-xs text-gray-400 hover:text-gray-600 mb-1 block">
            ← All videos
          </Link>
          <h1 className="text-xl font-bold truncate max-w-2xl">
            {videoId}
          </h1>
          {data && (
            <p className="text-sm text-gray-500 mt-1">
              {data.total.toLocaleString()} segments · page {data.page} / {data.total_pages} ·{" "}
              <span className="text-green-600 font-medium">{reviewedCount}/{totalOnPage} reviewed this page</span>
            </p>
          )}
        </div>

        {/* Export buttons */}
        <div className="flex gap-2 shrink-0">
          <a
            href={`/api/v1/export/jsonl?youtube_id=${videoId}`}
            className="px-3 py-1.5 text-xs font-medium rounded border border-gray-300 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800"
          >
            ↓ JSONL
          </a>
          <a
            href={`/api/v1/export/jsonl?youtube_id=${videoId}&reviewed_only=true`}
            className="px-3 py-1.5 text-xs font-medium rounded border border-green-400 text-green-700 hover:bg-green-50 dark:border-green-700 dark:text-green-400 dark:hover:bg-green-950/30"
          >
            ↓ JSONL (reviewed)
          </a>
          <a
            href={`/api/v1/export/csv?youtube_id=${videoId}`}
            className="px-3 py-1.5 text-xs font-medium rounded border border-gray-300 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800"
          >
            ↓ CSV
          </a>
        </div>
      </div>

      {/* Editor table */}
      {isLoading && (
        <div className="py-16 text-center text-gray-400">Loading segments…</div>
      )}
      {error && (
        <div className="py-8 text-center text-red-500">
          Failed to load segments. Make sure the backend is running and this video is ingested.
        </div>
      )}
      {data && (
        <div className="rounded-lg border border-gray-200 dark:border-gray-800 overflow-hidden">
          <ParallelEditor
            segments={data.items}
            onSegmentUpdate={handleSegmentUpdate}
          />
        </div>
      )}

      {/* Pagination */}
      {data && data.total_pages > 1 && (
        <div className="flex items-center justify-center gap-2 py-4">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-3 py-1.5 text-xs rounded border border-gray-300 disabled:opacity-40 hover:bg-gray-50"
          >
            ← Prev
          </button>
          <span className="text-sm text-gray-500">
            {page} / {data.total_pages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(data.total_pages, p + 1))}
            disabled={page === data.total_pages}
            className="px-3 py-1.5 text-xs rounded border border-gray-300 disabled:opacity-40 hover:bg-gray-50"
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
}
