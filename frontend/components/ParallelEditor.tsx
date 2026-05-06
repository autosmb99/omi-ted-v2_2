"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useReactTable, getCoreRowModel, flexRender, createColumnHelper } from "@tanstack/react-table";
import { motion } from "motion/react";
import axios from "axios";

export interface Segment {
  id: number; segment_index: number; start_time: number; duration: number;
  te_original: string; en_auto: string | null; en_human: string | null;
  en_final: string | null; content_type: string; is_reviewed: boolean; quality_score: number | null;
}

interface Props { youtubeId: string; segments: Segment[]; onSegmentUpdate: (id: number, updated: Partial<Segment>) => void; }

function fmtTime(s: number) {
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = Math.floor(s % 60);
  if (h > 0) return `${h}:${m.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}`;
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

const col = createColumnHelper<Segment>();

export default function ParallelEditor({ youtubeId, segments, onSegmentUpdate }: Props) {
  const [saving, setSaving] = useState<Record<number, boolean>>({});
  const [saved,  setSaved]  = useState<Record<number, boolean>>({});

  const save = useCallback(async (segment: Segment, newValue: string) => {
    const trimmed = newValue.trim();
    if (trimmed === (segment.en_human ?? "")) return;
    setSaving((p) => ({ ...p, [segment.id]: true }));
    try {
      const { data } = await axios.patch(`/api/v1/segments/${segment.id}`, {
        en_human: trimmed, is_reviewed: trimmed.length > 0,
      });
      onSegmentUpdate(segment.id, data);
      setSaved((p) => ({ ...p, [segment.id]: true }));
      setTimeout(() => setSaved((p) => ({ ...p, [segment.id]: false })), 1500);
    } catch (e) { console.error("save failed", e); }
    finally { setSaving((p) => ({ ...p, [segment.id]: false })); }
  }, [onSegmentUpdate]);

  const columns = [
    col.accessor("start_time", {
      header: "Time", size: 76,
      cell: (info) => (
        <a
          href={`https://www.youtube.com/watch?v=${youtubeId}&t=${Math.floor(info.getValue())}s`}
          target="_blank" rel="noreferrer"
          className="text-xs font-mono whitespace-nowrap transition-colors"
          style={{ color: "var(--rose)", fontWeight: 500 }}
          title="Open in YouTube">
          {fmtTime(info.getValue())}
        </a>
      ),
    }),
    col.accessor("te_original", {
      header: "Telugu",
      cell: (info) => (
        <p className="text-sm leading-relaxed"
          style={{ color: "var(--gray-900)", fontFamily: "'Noto Sans Telugu', sans-serif" }}>
          {info.getValue()}
        </p>
      ),
    }),
    col.accessor("en_auto", {
      header: "Auto English",
      cell: (info) => (
        <p className="text-xs leading-snug italic" style={{ color: "var(--gray-400)" }}>
          {info.getValue() || "—"}
        </p>
      ),
    }),
    col.display({
      id: "en_human", header: "Your Translation",
      cell: ({ row }) => {
        const seg = row.original;
        return <EditableCell key={seg.id} segment={seg} isSaving={!!saving[seg.id]} isSaved={!!saved[seg.id]} onSave={save} />;
      },
    }),
    col.accessor("is_reviewed", {
      header: "", size: 32,
      cell: (info) => (
        <span style={{ color: info.getValue() ? "var(--green)" : "var(--gray-300)" }} className="text-sm">
          {info.getValue() ? "✓" : "○"}
        </span>
      ),
    }),
  ];

  const table = useReactTable({ data: segments, columns, getCoreRowModel: getCoreRowModel() });

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead>
          {table.getHeaderGroups().map((hg) => (
            <tr key={hg.id} style={{ borderBottom: "1px solid var(--gray-200)", background: "var(--gray-50)" }}>
              {hg.headers.map((h) => (
                <th key={h.id}
                  className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider"
                  style={{ color: "var(--gray-400)", width: h.getSize() !== 150 ? h.getSize() : undefined }}>
                  {flexRender(h.column.columnDef.header, h.getContext())}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.map((row, i) => (
            <motion.tr key={row.id}
              style={{
                borderBottom: "1px solid var(--gray-100)",
                background: row.original.is_reviewed
                  ? "rgba(16,185,129,0.04)"
                  : i % 2 === 0 ? "var(--white)" : "var(--gray-50)",
              }}
              whileHover={{ backgroundColor: row.original.is_reviewed ? "rgba(16,185,129,0.08)" : "#FFF1F2" }}
              transition={{ duration: 0.1 }}>
              {row.getVisibleCells().map((cell) => (
                <td key={cell.id} className="px-4 py-3 align-top">
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </td>
              ))}
            </motion.tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function EditableCell({ segment, isSaving, isSaved, onSave }: {
  segment: Segment; isSaving: boolean; isSaved: boolean;
  onSave: (seg: Segment, value: string) => void;
}) {
  const [value, setValue] = useState(segment.en_human ?? "");
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setValue(segment.en_human ?? "");
  }, [segment.id, segment.en_human]);

  return (
    <div className="relative">
      <textarea
        ref={ref}
        aria-label={`Translation for segment ${segment.segment_index + 1}`}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={() => onSave(segment, value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); ref.current?.blur(); }
        }}
        rows={2}
        placeholder={segment.en_auto ?? "Type translation…"}
        className="w-full min-w-[220px] text-xs rounded-lg px-3 py-2 resize-y focus:outline-none transition-all leading-relaxed"
        style={{
          background: "var(--white)",
          border: "1px solid var(--gray-200)",
          color: "var(--gray-900)",
          caretColor: "var(--rose)",
        }}
        onFocus={(e) => { e.target.style.borderColor = "var(--rose)"; e.target.style.boxShadow = "0 0 0 3px rgba(244,63,94,0.08)"; }}
        onBlurCapture={(e) => { e.target.style.borderColor = "var(--gray-200)"; e.target.style.boxShadow = "none"; }}
      />
      <div className="absolute top-1.5 right-2 text-xs pointer-events-none">
        {isSaving && <span style={{ color: "var(--gray-400)" }}>saving…</span>}
        {isSaved  && (
          <motion.span style={{ color: "var(--green)" }}
            initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}>
            ✓
          </motion.span>
        )}
      </div>
    </div>
  );
}
