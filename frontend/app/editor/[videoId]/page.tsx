"use client";
import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { useParams } from "next/navigation";
import useSWR from "swr";
import Link from "next/link";
import axios from "axios";
import { motion, AnimatePresence } from "motion/react";
import { FixedSizeList } from "react-window";

// ── Types ─────────────────────────────────────────────────────────────────

export interface Segment {
  id: number; segment_index: number; start_time: number; duration: number;
  te_original: string; en_auto: string | null; en_human: string | null;
  en_final: string | null; content_type: string; is_reviewed: boolean; quality_score: number | null;
}
interface SegmentsPage {
  total: number; page: number; page_size: number; total_pages: number; items: Segment[];
}
interface TMResult { te_text: string; en_text: string; similarity: number; }
interface TMResponse { query: string; results: TMResult[]; }

const fetcher = (u: string) => axios.get(u).then(r => r.data);
const ALL_PAGE_SIZE = 9999;

function fmtTime(s: number) {
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = Math.floor(s % 60);
  if (h > 0) return `${h}:${m.toString().padStart(2,"0")}:${sec.toString().padStart(2,"0")}`;
  return `${m}:${sec.toString().padStart(2,"0")}`;
}

// ── Components ────────────────────────────────────────────────────────────

/** Quality score dots: 1-5 clickable */
function QualityDots({ score, onChange, disabled }: { score: number | null; onChange: (n: number) => void; disabled?: boolean }) {
  return (
    <div style={{ display: "flex", gap: 3, alignItems: "center" }}>
      {[1, 2, 3, 4, 5].map(n => (
        <button
          key={n}
          disabled={disabled}
          onClick={() => onChange(n)}
          style={{
            width: 10, height: 10, borderRadius: "50%", border: "none", cursor: disabled ? "default" : "pointer",
            background: (score ?? 0) >= n ? "var(--amber)" : "var(--gray-300)",
            transition: "background 0.15s", padding: 0,
          }}
        />
      ))}
    </div>
  );
}

/** TM suggestion popup */
function TMSuggestions({ query, onSelect }: { query: string; onSelect: (text: string) => void }) {
  const { data } = useSWR<TMResponse>(query.length > 3 ? `/api/v1/tm/search?q=${encodeURIComponent(query)}` : null, fetcher);
  if (!data || data.results.length === 0) return null;
  return (
    <div style={{
      position: "absolute", zIndex: 50, bottom: "100%", left: 0, marginBottom: 6,
      background: "var(--white)", border: "1px solid var(--gray-200)", borderRadius: 8,
      boxShadow: "var(--shadow-md)", padding: "6px 0", minWidth: 220, maxWidth: 320,
    }}>
      <p style={{ fontSize: 10, color: "var(--gray-400)", padding: "0 10px", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.06em" }}>
        Translation Memory
      </p>
      {data.results.map((r, i) => (
        <button key={i} onClick={() => onSelect(r.en_text)}
          style={{
            display: "block", width: "100%", textAlign: "left", padding: "5px 10px",
            border: "none", background: "transparent", cursor: "pointer", fontSize: 12,
            color: "var(--gray-700)", borderBottom: i < data.results.length - 1 ? "1px solid var(--gray-100)" : "none",
          }}
          onMouseEnter={e => (e.currentTarget.style.background = "var(--gray-50)")}
          onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
          <span style={{ fontFamily: "'Noto Sans Telugu', sans-serif", color: "var(--gray-900)", fontSize: 13 }}>{r.te_text}</span>
          <span style={{ color: "var(--gray-400)", margin: "0 6px" }}>→</span>
          <span>{r.en_text}</span>
          <span style={{ fontSize: 10, color: "var(--gray-400)", marginLeft: 6 }}>{Math.round(r.similarity * 100)}%</span>
        </button>
      ))}
    </div>
  );
}

/** Single virtualized row */
function SegmentRow({ index, style, data }: { index: number; style: React.CSSProperties; data: RowData }) {
  const seg = data.segments[index];
  const isActive = data.activeId === seg.id;
  const [val, setVal] = useState(seg.en_human ?? "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [tmQuery, setTmQuery] = useState("");
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { setVal(seg.en_human ?? ""); }, [seg.id, seg.en_human]);
  useEffect(() => {
    if (isActive && data.focusEnglish && ref.current) {
      ref.current.focus();
      data.focusEnglish = false;
    }
  }, [isActive, data.focusEnglish]);

  async function save(newValue: string) {
    const trimmed = newValue.trim();
    if (trimmed === (seg.en_human ?? "")) return;
    setSaving(true);
    try {
      const { data: updated } = await axios.patch(`/api/v1/segments/${seg.id}`, {
        en_human: trimmed, is_reviewed: trimmed.length > 0,
      });
      data.onUpdate(seg.id, updated);
      setSaved(true); setTimeout(() => setSaved(false), 1500);
    } catch (e) { console.error(e); }
    finally { setSaving(false); }
  }

  async function setQuality(n: number) {
    try {
      const { data: updated } = await axios.patch(`/api/v1/segments/${seg.id}`, { quality_score: n });
      data.onUpdate(seg.id, updated);
    } catch (e) { console.error(e); }
  }

  async function toggleReviewed() {
    try {
      const { data: updated } = await axios.patch(`/api/v1/segments/${seg.id}`, { is_reviewed: !seg.is_reviewed });
      data.onUpdate(seg.id, updated);
    } catch (e) { console.error(e); }
  }

  async function setContentType(ct: string) {
    try {
      const { data: updated } = await axios.patch(`/api/v1/segments/${seg.id}`, { content_type: ct });
      data.onUpdate(seg.id, updated);
    } catch (e) { console.error(e); }
  }

  return (
    <div
      style={{
        ...style,
        display: "flex", flexDirection: "column", padding: "10px 16px",
        borderBottom: "1px solid var(--gray-200)",
        background: isActive ? "var(--rose-light)" : seg.is_reviewed ? "rgba(16,185,129,0.03)" : "var(--white)",
        borderLeft: isActive ? "3px solid var(--rose)" : "3px solid transparent",
        transition: "background 0.12s",
        cursor: "pointer",
      }}
      onClick={() => data.setActive(seg.id, seg.start_time)}
      className="editor-row"
    >
      {/* Row header: time + controls */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
        <button
          onClick={e => { e.stopPropagation(); data.seek(seg.start_time); }}
          style={{
            fontSize: 11, fontFamily: "JetBrains Mono", fontWeight: 600,
            color: "var(--rose)", background: "none", border: "none", cursor: "pointer", padding: 0,
          }}>
          {fmtTime(seg.start_time)}
        </button>
        <QualityDots score={seg.quality_score} onChange={setQuality} />
        <button onClick={e => { e.stopPropagation(); toggleReviewed(); }}
          style={{
            fontSize: 10, fontWeight: 600, padding: "2px 8px", borderRadius: 99, border: "none", cursor: "pointer",
            background: seg.is_reviewed ? "var(--green-light)" : "var(--gray-100)",
            color: seg.is_reviewed ? "var(--green)" : "var(--gray-400)",
          }}>
          {seg.is_reviewed ? "✓ Reviewed" : "○ Review"}
        </button>
        <select
          value={seg.content_type}
          onClick={e => e.stopPropagation()}
          onChange={e => setContentType(e.target.value)}
          style={{
            fontSize: 10, padding: "2px 6px", borderRadius: 6, border: "1px solid var(--gray-200)",
            background: "var(--white)", color: "var(--gray-500)", outline: "none",
          }}>
          <option value="unknown">?</option>
          <option value="sermon">Sermon</option>
          <option value="song">Song</option>
          <option value="prayer">Prayer</option>
        </select>
        <span style={{ fontSize: 10, color: "var(--gray-400)", marginLeft: "auto" }}>
          #{seg.segment_index + 1}
        </span>
      </div>

      {/* Text area: Telugu + English side by side */}
      <div style={{ display: "flex", gap: 12, flex: 1, minHeight: 0 }}>
        {/* Telugu */}
        <div
          style={{ flex: 1, fontFamily: "'Noto Sans Telugu', sans-serif", fontSize: 15, lineHeight: 1.8, color: "var(--gray-900)", overflow: "hidden" }}
          onMouseUp={e => {
            const sel = window.getSelection()?.toString().trim();
            if (sel) data.onTextSelect(sel, e.clientX, e.clientY);
          }}>
          {seg.te_original}
        </div>

        {/* English editable */}
        <div style={{ flex: 1, position: "relative" }}>
          <textarea
            ref={ref}
            value={val}
            onChange={e => { setVal(e.target.value); setTmQuery(e.target.value); }}
            onBlur={() => save(val)}
            onKeyDown={e => {
              if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                ref.current?.blur();
                data.saveAndNext?.();
              }
            }}
            onClick={e => e.stopPropagation()}
            rows={2}
            placeholder={seg.en_auto || "Type translation…"}
            style={{
              width: "100%", padding: "8px 10px", borderRadius: 8, resize: "none",
              fontSize: 13, lineHeight: 1.6, fontFamily: "DM Sans, sans-serif",
              border: `1px solid ${seg.is_reviewed ? "var(--green-border)" : "var(--gray-200)"}`,
              background: seg.is_reviewed ? "rgba(16,185,129,0.03)" : "var(--gray-50)",
              color: "var(--gray-900)", outline: "none", transition: "border-color 0.15s",
            }}
            onFocus={e => { e.target.style.borderColor = "var(--rose)"; e.target.style.boxShadow = "0 0 0 3px rgba(244,63,94,0.08)"; }}
            onBlurCapture={e => { e.target.style.borderColor = seg.is_reviewed ? "var(--green-border)" : "var(--gray-200)"; e.target.style.boxShadow = "none"; }}
          />
          {/* TM suggestions */}
          {tmQuery.length > 5 && <TMSuggestions query={tmQuery} onSelect={t => { setVal(t); setTmQuery(""); }} />}
          {/* Save indicator */}
          <div style={{ position: "absolute", top: 6, right: 8, fontSize: 11, pointerEvents: "none" }}>
            {saving && <span style={{ color: "var(--gray-400)" }}>…</span>}
            {saved && <motion.span style={{ color: "var(--green)" }} initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }}>✓</motion.span>}
          </div>
        </div>
      </div>
    </div>
  );
}

interface RowData {
  segments: Segment[];
  activeId: number | null;
  setActive: (id: number, time: number) => void;
  onUpdate: (id: number, u: Partial<Segment>) => void;
  seek: (t: number) => void;
  onTextSelect: (text: string, x: number, y: number) => void;
  focusEnglish: boolean;
  saveAndNext?: () => void;
}

// ── Main Editor Page ──────────────────────────────────────────────────────

export default function EditorPage() {
  const { videoId } = useParams() as { videoId: string };
  const [activeId, setActiveId] = useState<number | null>(null);
  const [activeTime, setActiveTime] = useState(0);
  const [focusEnglish, setFocusEnglish] = useState(false);
  const [search, setSearch] = useState("");
  const [filterReviewed, setFilterReviewed] = useState<boolean | null>(null);
  const [filterType, setFilterType] = useState<string | null>(null);
  const [selectedText, setSelectedText] = useState("");
  const [selectPos, setSelectPos] = useState({ x: 0, y: 0 });
  const [showGlossaryForm, setShowGlossaryForm] = useState(false);
  const [glossaryEn, setGlossaryEn] = useState("");
  const listRef = useRef<FixedSizeList>(null);

  const { data, error, isLoading, mutate } = useSWR<SegmentsPage>(
    `/api/v1/videos/${videoId}/segments?page=1&page_size=${ALL_PAGE_SIZE}`, fetcher
  );

  const allSegments = data?.items ?? [];

  const filtered = useMemo(() => {
    return allSegments.filter(s => {
      if (search) {
        const q = search.toLowerCase();
        if (!s.te_original.toLowerCase().includes(q) &&
            !(s.en_auto ?? "").toLowerCase().includes(q) &&
            !(s.en_human ?? "").toLowerCase().includes(q)) return false;
      }
      if (filterReviewed !== null && s.is_reviewed !== filterReviewed) return false;
      if (filterType && s.content_type !== filterType) return false;
      return true;
    });
  }, [allSegments, search, filterReviewed, filterType]);

  const handleUpdate = useCallback((id: number, updated: Partial<Segment>) => {
    mutate(prev => prev ? { ...prev, items: prev.items.map(s => s.id === id ? { ...s, ...updated } : s) } : prev, false);
  }, [mutate]);

  const seek = useCallback((t: number) => setActiveTime(t), []);

  const setActive = useCallback((id: number, time: number) => {
    setActiveId(id);
    setActiveTime(time);
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLInputElement) {
        if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
          // handled in textarea onKeyDown
          return;
        }
        if (e.key === "Escape") {
          (e.target as HTMLElement).blur();
          return;
        }
        // Let other keys pass through when typing
        if (!e.ctrlKey && !e.metaKey && e.key.length === 1) return;
      }

      if (e.key === "/") {
        e.preventDefault();
        document.getElementById("editor-search")?.focus();
        return;
      }
      if (e.key === "j" || e.key === "k") {
        e.preventDefault();
        if (!filtered.length) return;
        const idx = filtered.findIndex(s => s.id === activeId);
        let nextIdx = e.key === "j" ? idx + 1 : idx - 1;
        if (nextIdx < 0) nextIdx = 0;
        if (nextIdx >= filtered.length) nextIdx = filtered.length - 1;
        const nextSeg = filtered[nextIdx];
        setActiveId(nextSeg.id);
        setActiveTime(nextSeg.start_time);
        listRef.current?.scrollToItem(nextIdx, "smart");
        return;
      }
      if (e.key === "e") {
        e.preventDefault();
        setFocusEnglish(true);
        return;
      }
      if (e.key >= "1" && e.key <= "5" && activeId !== null) {
        e.preventDefault();
        const score = parseInt(e.key, 10);
        axios.patch(`/api/v1/segments/${activeId}`, { quality_score: score }).then(({ data: u }) => handleUpdate(activeId, u));
        return;
      }
      if (e.key === "r" && activeId !== null) {
        e.preventDefault();
        const seg = allSegments.find(s => s.id === activeId);
        if (seg) {
          axios.patch(`/api/v1/segments/${activeId}`, { is_reviewed: !seg.is_reviewed }).then(({ data: u }) => handleUpdate(activeId, u));
        }
        return;
      }
      if (e.key === "s" && activeId !== null) {
        e.preventDefault();
        const seg = allSegments.find(s => s.id === activeId);
        if (seg) {
          const next = seg.content_type === "song" ? "unknown" : "song";
          axios.patch(`/api/v1/segments/${activeId}`, { content_type: next }).then(({ data: u }) => handleUpdate(activeId, u));
        }
        return;
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [activeId, filtered, allSegments, handleUpdate]);

  // Text selection handler
  const onTextSelect = useCallback((text: string, x: number, y: number) => {
    setSelectedText(text);
    setSelectPos({ x, y });
  }, []);

  async function addToGlossary() {
    if (!selectedText || !glossaryEn.trim()) return;
    try {
      await axios.post("/api/v1/glossary", {
        te_term: selectedText.trim(),
        en_term: glossaryEn.trim(),
        category: "theology",
      });
      setShowGlossaryForm(false);
      setGlossaryEn("");
      setSelectedText("");
    } catch (e) { console.error(e); }
  }

  function downloadText() {
    const lines = filtered.map(s =>
      `[${fmtTime(s.start_time)}] ${s.te_original}\n→ ${s.en_human || s.en_auto || "[untranslated]"}\n`
    );
    const blob = new Blob([lines.join("\n")], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${videoId}_segments.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function downloadJSONL() {
    const lines = filtered.map(s => JSON.stringify({
      te: s.te_original,
      en: s.en_human || s.en_auto,
      source: videoId,
      t: s.start_time,
    }));
    const blob = new Blob([lines.join("\n")], { type: "application/x-ndjson" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${videoId}.jsonl`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const reviewedCount = allSegments.filter(s => s.is_reviewed).length;
  const totalCount = allSegments.length;

  const rowData: RowData = {
    segments: filtered,
    activeId,
    setActive,
    onUpdate: handleUpdate,
    seek,
    onTextSelect,
    focusEnglish,
    saveAndNext: () => {
      const idx = filtered.findIndex(s => s.id === activeId);
      if (idx >= 0 && idx < filtered.length - 1) {
        const next = filtered[idx + 1];
        setActiveId(next.id);
        setActiveTime(next.start_time);
        setFocusEnglish(true);
        listRef.current?.scrollToItem(idx + 1, "smart");
      }
    },
  };

  const listHeight = typeof window !== "undefined" ? window.innerHeight - 380 : 600;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, height: "calc(100vh - 56px)", marginTop: -12 }}>

      {/* ── Top bar ── */}
      <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap", paddingBottom: 12, borderBottom: "1px solid var(--gray-200)" }}>
        <Link href="/queue" style={{ fontSize: 12, color: "var(--gray-400)", textDecoration: "none", whiteSpace: "nowrap" }}>← Queue</Link>
        <h1 style={{ fontSize: 16, fontWeight: 600, color: "var(--gray-900)", flex: 1, minWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {videoId}
        </h1>
        <span style={{ fontSize: 11, fontFamily: "JetBrains Mono", color: reviewedCount === totalCount ? "var(--green)" : "var(--gray-400)", background: reviewedCount === totalCount ? "var(--green-light)" : "var(--gray-100)", border: `1px solid ${reviewedCount === totalCount ? "var(--green-border)" : "var(--gray-200)"}`, padding: "4px 10px", borderRadius: 99 }}>
          {reviewedCount}/{totalCount} done
        </span>
      </div>

      {/* ── YouTube + Controls ── */}
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
        {/* YouTube player */}
        <div style={{ flexShrink: 0 }}>
          <iframe
            key={Math.floor(activeTime)}
            src={`https://www.youtube.com/embed/${videoId}?start=${Math.floor(activeTime)}&autoplay=0&rel=0`}
            width={360} height={202}
            style={{ borderRadius: 10, border: "1px solid var(--gray-200)", display: "block" }}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>

        {/* Controls */}
        <div style={{ flex: 1, minWidth: 280, display: "flex", flexDirection: "column", gap: 10 }}>
          {/* Search */}
          <div style={{ display: "flex", gap: 8 }}>
            <input
              id="editor-search"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search segments…  ( / to focus )"
              style={{
                flex: 1, padding: "7px 12px", borderRadius: 8, border: "1px solid var(--gray-200)",
                fontSize: 13, color: "var(--gray-700)", background: "var(--white)", outline: "none",
              }}
            />
            <select
              value={filterReviewed === null ? "" : filterReviewed ? "yes" : "no"}
              onChange={e => {
                const v = e.target.value;
                setFilterReviewed(v === "" ? null : v === "yes");
              }}
              style={{ padding: "7px 10px", borderRadius: 8, border: "1px solid var(--gray-200)", fontSize: 12, color: "var(--gray-600)", background: "var(--white)", outline: "none" }}>
              <option value="">All status</option>
              <option value="yes">Reviewed</option>
              <option value="no">Unreviewed</option>
            </select>
            <select
              value={filterType ?? ""}
              onChange={e => setFilterType(e.target.value || null)}
              style={{ padding: "7px 10px", borderRadius: 8, border: "1px solid var(--gray-200)", fontSize: 12, color: "var(--gray-600)", background: "var(--white)", outline: "none" }}>
              <option value="">All types</option>
              <option value="sermon">Sermon</option>
              <option value="song">Song</option>
              <option value="prayer">Prayer</option>
              <option value="unknown">Unknown</option>
            </select>
          </div>

          {/* Filtered count + download */}
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 12, color: "var(--gray-400)" }}>
              Showing {filtered.length} of {allSegments.length} segments
            </span>
            <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
              <button onClick={downloadText}
                style={{ padding: "5px 12px", borderRadius: 7, border: "1px solid var(--gray-200)", background: "var(--white)", color: "var(--gray-600)", fontSize: 11, cursor: "pointer" }}>
                ↓ Text
              </button>
              <button onClick={downloadJSONL}
                style={{ padding: "5px 12px", borderRadius: 7, border: "1px solid var(--gray-200)", background: "var(--white)", color: "var(--gray-600)", fontSize: 11, cursor: "pointer" }}>
                ↓ JSONL
              </button>
            </div>
          </div>

          {/* Shortcuts legend */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 12px", fontSize: 10, color: "var(--gray-400)", marginTop: 2 }}>
            <span><kbd style={{ background: "var(--gray-100)", padding: "1px 4px", borderRadius: 4, fontFamily: "JetBrains Mono" }}>j/k</kbd> navigate</span>
            <span><kbd style={{ background: "var(--gray-100)", padding: "1px 4px", borderRadius: 4, fontFamily: "JetBrains Mono" }}>e</kbd> edit</span>
            <span><kbd style={{ background: "var(--gray-100)", padding: "1px 4px", borderRadius: 4, fontFamily: "JetBrains Mono" }}>ctrl↵</kbd> save+next</span>
            <span><kbd style={{ background: "var(--gray-100)", padding: "1px 4px", borderRadius: 4, fontFamily: "JetBrains Mono" }}>1-5</kbd> quality</span>
            <span><kbd style={{ background: "var(--gray-100)", padding: "1px 4px", borderRadius: 4, fontFamily: "JetBrains Mono" }}>r</kbd> review</span>
            <span><kbd style={{ background: "var(--gray-100)", padding: "1px 4px", borderRadius: 4, fontFamily: "JetBrains Mono" }}>s</kbd> song</span>
          </div>
        </div>
      </div>

      {/* ── Virtualized list ── */}
      {isLoading && <p style={{ color: "var(--gray-400)", fontSize: 13, textAlign: "center", padding: "60px 0" }}>Loading segments…</p>}
      {error && <p style={{ color: "var(--red)", fontSize: 13, textAlign: "center", padding: "40px 0" }}>Failed to load — is the backend running?</p>}
      {!isLoading && filtered.length === 0 && (
        <div style={{ textAlign: "center", padding: "60px 0", color: "var(--gray-400)", fontSize: 14 }}>
          No segments match your filters.
        </div>
      )}
      {!isLoading && filtered.length > 0 && (
        <div style={{ flex: 1, minHeight: 0, border: "1px solid var(--gray-200)", borderRadius: 12, overflow: "hidden", background: "var(--white)" }}>
          <FixedSizeList
            ref={listRef}
            height={listHeight}
            itemCount={filtered.length}
            itemSize={150}
            width="100%"
            itemData={rowData}
          >
            {SegmentRow}
          </FixedSizeList>
        </div>
      )}

      {/* ── Selection popup ── */}
      <AnimatePresence>
        {selectedText && !showGlossaryForm && (
          <motion.div
            initial={{ opacity: 0, y: 6, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.95 }}
            style={{
              position: "fixed", left: selectPos.x, top: selectPos.y - 40, zIndex: 100,
              background: "var(--rose)", color: "#fff", padding: "6px 12px", borderRadius: 8,
              fontSize: 12, fontWeight: 600, boxShadow: "var(--shadow-md)", cursor: "pointer",
              display: "flex", alignItems: "center", gap: 8,
            }}
            onClick={() => setShowGlossaryForm(true)}>
            + Add “{selectedText.slice(0, 20)}{selectedText.length > 20 ? "…" : ""}” to glossary
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Glossary form modal ── */}
      <AnimatePresence>
        {showGlossaryForm && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{
              position: "fixed", inset: 0, zIndex: 200,
              display: "flex", alignItems: "center", justifyContent: "center",
              background: "rgba(17,24,39,0.35)", backdropFilter: "blur(4px)",
            }}
            onClick={() => setShowGlossaryForm(false)}>
            <motion.div
              initial={{ opacity: 0, y: 14, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.98 }}
              onClick={e => e.stopPropagation()}
              style={{
                width: "100%", maxWidth: 400,
                background: "var(--white)", borderRadius: 16,
                boxShadow: "0 20px 60px rgba(0,0,0,0.12)", padding: 24,
                border: "1px solid var(--gray-200)",
              }}>
              <h3 style={{ fontSize: 16, fontWeight: 600, color: "var(--gray-900)", marginBottom: 12 }}>Add to Glossary</h3>
              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 11, color: "var(--gray-500)", display: "block", marginBottom: 4 }}>Telugu term</label>
                <div style={{ fontFamily: "'Noto Sans Telugu', sans-serif", fontSize: 15, padding: "8px 10px", borderRadius: 8, background: "var(--gray-50)", border: "1px solid var(--gray-200)", color: "var(--gray-900)" }}>
                  {selectedText}
                </div>
              </div>
              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 11, color: "var(--gray-500)", display: "block", marginBottom: 4 }}>English translation *</label>
                <input
                  value={glossaryEn}
                  onChange={e => setGlossaryEn(e.target.value)}
                  placeholder="e.g. Lord"
                  autoFocus
                  style={{
                    width: "100%", padding: "8px 10px", borderRadius: 8, border: "1px solid var(--gray-200)",
                    fontSize: 13, color: "var(--gray-900)", outline: "none",
                  }}
                  onKeyDown={e => { if (e.key === "Enter") addToGlossary(); }}
                />
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={addToGlossary}
                  style={{ padding: "8px 18px", borderRadius: 8, border: "none", background: "var(--rose)", color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                  Add term
                </button>
                <button onClick={() => setShowGlossaryForm(false)}
                  style={{ padding: "8px 14px", borderRadius: 8, border: "1px solid var(--gray-200)", background: "var(--white)", color: "var(--gray-500)", fontSize: 13, cursor: "pointer" }}>
                  Cancel
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
