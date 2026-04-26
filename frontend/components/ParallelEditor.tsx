"use client";

import { useCallback, useRef, useState } from "react";
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  createColumnHelper,
} from "@tanstack/react-table";
import axios from "axios";

export interface Segment {
  id: number;
  segment_index: number;
  start_time: number;
  duration: number;
  te_original: string;
  en_auto: string | null;
  en_human: string | null;
  en_final: string | null;
  content_type: string;
  is_reviewed: boolean;
  quality_score: number | null;
}

interface Props {
  segments: Segment[];
  onSegmentUpdate: (id: number, updated: Partial<Segment>) => void;
}

function fmtTime(s: number) {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

const col = createColumnHelper<Segment>();

export default function ParallelEditor({ segments, onSegmentUpdate }: Props) {
  const [saving, setSaving] = useState<Record<number, boolean>>({});
  const [saved, setSaved] = useState<Record<number, boolean>>({});

  const save = useCallback(
    async (segment: Segment, newValue: string) => {
      const trimmed = newValue.trim();
      if (trimmed === (segment.en_human ?? "")) return; // no change
      setSaving((p) => ({ ...p, [segment.id]: true }));
      try {
        const { data } = await axios.patch(`/api/v1/segments/${segment.id}`, {
          en_human: trimmed,
          is_reviewed: trimmed.length > 0,
        });
        onSegmentUpdate(segment.id, data);
        setSaved((p) => ({ ...p, [segment.id]: true }));
        setTimeout(() => setSaved((p) => ({ ...p, [segment.id]: false })), 1500);
      } catch (e) {
        console.error("save failed", e);
      } finally {
        setSaving((p) => ({ ...p, [segment.id]: false }));
      }
    },
    [onSegmentUpdate]
  );

  const columns = [
    col.accessor("start_time", {
      header: "Time",
      size: 64,
      cell: (info) => (
        <span className="text-xs text-gray-400 font-mono whitespace-nowrap">
          {fmtTime(info.getValue())}
        </span>
      ),
    }),
    col.accessor("te_original", {
      header: "Telugu",
      cell: (info) => (
        <span className="text-sm leading-snug" style={{ fontFamily: "sans-serif" }}>
          {info.getValue()}
        </span>
      ),
    }),
    col.accessor("en_auto", {
      header: "Auto English",
      cell: (info) => (
        <span className="text-sm text-gray-500 leading-snug">
          {info.getValue() || <span className="italic text-gray-300">—</span>}
        </span>
      ),
    }),
    col.display({
      id: "en_human",
      header: "Your Translation",
      cell: ({ row }) => {
        const seg = row.original;
        return (
          <EditableCell
            key={seg.id}
            segment={seg}
            isSaving={!!saving[seg.id]}
            isSaved={!!saved[seg.id]}
            onSave={save}
          />
        );
      },
    }),
    col.accessor("is_reviewed", {
      header: "",
      size: 28,
      cell: (info) =>
        info.getValue() ? (
          <span className="text-green-500 text-xs">✓</span>
        ) : null,
    }),
  ];

  const table = useReactTable({
    data: segments,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead>
          {table.getHeaderGroups().map((hg) => (
            <tr key={hg.id} className="border-b border-gray-200 dark:border-gray-700">
              {hg.headers.map((h) => (
                <th
                  key={h.id}
                  className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider bg-gray-50 dark:bg-gray-900"
                  style={{ width: h.getSize() !== 150 ? h.getSize() : undefined }}
                >
                  {flexRender(h.column.columnDef.header, h.getContext())}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.map((row) => (
            <tr
              key={row.id}
              className={`border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-900/40 ${
                row.original.is_reviewed ? "bg-green-50/30 dark:bg-green-950/10" : ""
              }`}
            >
              {row.getVisibleCells().map((cell) => (
                <td key={cell.id} className="px-3 py-2 align-top">
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Editable cell — textarea that saves on blur or Ctrl+Enter
// ---------------------------------------------------------------------------

function EditableCell({
  segment,
  isSaving,
  isSaved,
  onSave,
}: {
  segment: Segment;
  isSaving: boolean;
  isSaved: boolean;
  onSave: (seg: Segment, value: string) => void;
}) {
  const [value, setValue] = useState(segment.en_human ?? "");
  const ref = useRef<HTMLTextAreaElement>(null);

  return (
    <div className="relative">
      <textarea
        ref={ref}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={() => onSave(segment, value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            ref.current?.blur();
          }
        }}
        rows={2}
        placeholder={segment.en_auto ?? "Enter translation…"}
        className="w-full min-w-[200px] text-sm rounded border border-gray-200 dark:border-gray-700 px-2 py-1 resize-none bg-white dark:bg-gray-900 focus:outline-none focus:ring-1 focus:ring-blue-400 placeholder:text-gray-300"
      />
      {isSaving && (
        <span className="absolute top-1 right-1 text-xs text-gray-400">saving…</span>
      )}
      {isSaved && (
        <span className="absolute top-1 right-1 text-xs text-green-500">saved ✓</span>
      )}
    </div>
  );
}
