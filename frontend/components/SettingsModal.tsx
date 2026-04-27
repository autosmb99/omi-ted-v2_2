"use client";
import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import axios from "axios";

interface KeyStatus { sarvam_key_set: boolean; openrouter_key_set: boolean; google_key_set: boolean; }
interface Props { open: boolean; onClose: () => void; }

export default function SettingsModal({ open, onClose }: Props) {
  const [status, setStatus]         = useState<KeyStatus | null>(null);
  const [sarvam, setSarvam]         = useState("");
  const [openrouter, setOpenrouter] = useState("");
  const [saving, setSaving]         = useState(false);
  const [saved, setSaved]           = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) axios.get<KeyStatus>("/api/v1/settings").then((r) => setStatus(r.data));
  }, [open]);

  async function handleSave() {
    setSaving(true);
    try {
      const r = await axios.post<KeyStatus>("/api/v1/settings", {
        ...(sarvam.trim()     ? { sarvam_api_key:     sarvam.trim()     } : {}),
        ...(openrouter.trim() ? { openrouter_api_key: openrouter.trim() } : {}),
      });
      setStatus(r.data);
      setSarvam(""); setOpenrouter("");
      setSaved(true); setTimeout(() => setSaved(false), 2500);
    } finally { setSaving(false); }
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div ref={ref}
          onClick={(e) => { if (e.target === ref.current) onClose(); }}
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          style={{
            position: "fixed", inset: 0, zIndex: 100,
            display: "flex", alignItems: "center", justifyContent: "center",
            padding: 24, background: "rgba(17,24,39,0.35)", backdropFilter: "blur(4px)",
          }}>
          <motion.div
            initial={{ opacity: 0, y: 14, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 420, damping: 30 }}
            style={{
              width: "100%", maxWidth: 460,
              background: "var(--white)", borderRadius: 16,
              boxShadow: "0 20px 60px rgba(0,0,0,0.12), 0 4px 12px rgba(0,0,0,0.06)",
              overflow: "hidden", border: "1px solid var(--gray-200)",
            }}>

            {/* Header */}
            <div style={{ padding: "22px 26px 18px", borderBottom: "1px solid var(--gray-100)" }}>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
                <div>
                  <h2 style={{ fontSize: 18, fontWeight: 600, color: "var(--gray-900)", margin: 0 }}>
                    API Keys
                  </h2>
                  <p style={{ fontSize: 12, color: "var(--gray-400)", marginTop: 4 }}>
                    Saved to disk — enter once, persists forever.
                  </p>
                </div>
                <button onClick={onClose}
                  style={{
                    background: "none", border: "none", cursor: "pointer",
                    color: "var(--gray-400)", fontSize: 20, padding: "2px 6px", lineHeight: 1,
                    borderRadius: 6,
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "var(--gray-100)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "none")}>
                  ×
                </button>
              </div>
            </div>

            {/* Body */}
            <div style={{ padding: "20px 26px 24px", display: "flex", flexDirection: "column", gap: 14 }}>
              <KeyRow
                label="OpenRouter" hint="Gemma, Claude, Llama — any model"
                isSet={status?.openrouter_key_set ?? false}
                value={openrouter} onChange={setOpenrouter}
                placeholder="sk-or-v1-…" link="https://openrouter.ai/keys"
              />
              <KeyRow
                label="Sarvam AI" hint="Indian-language specialist"
                isSet={status?.sarvam_key_set ?? false}
                value={sarvam} onChange={setSarvam}
                placeholder="your-sarvam-key" link="https://dashboard.sarvam.ai"
              />

              <motion.button onClick={handleSave}
                disabled={saving || (!sarvam.trim() && !openrouter.trim())}
                whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }}
                style={{
                  marginTop: 4, padding: "10px 0", borderRadius: 10, border: "none",
                  cursor: "pointer", fontSize: 13, fontWeight: 600,
                  background: saved ? "var(--green-light)" : "var(--rose)",
                  color: saved ? "var(--green)" : "#fff",
                  opacity: (!saving && (sarvam.trim() || openrouter.trim())) ? 1 : 0.4,
                  transition: "background 0.2s, color 0.2s",
                }}>
                {saving ? "Saving…" : saved ? "✓ Saved!" : "Save keys"}
              </motion.button>

              <p style={{ textAlign: "center", fontSize: 11, color: "var(--gray-400)", margin: 0 }}>
                Keys are write-only and never shown back.
              </p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function KeyRow({ label, hint, isSet, value, onChange, placeholder, link }: {
  label: string; hint: string; isSet: boolean; value: string;
  onChange: (v: string) => void; placeholder: string; link: string;
}) {
  return (
    <div style={{
      padding: "14px 16px", borderRadius: 10,
      border: "1px solid var(--gray-200)", background: "var(--gray-50)",
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: "var(--gray-900)" }}>{label}</span>
          <span style={{
            fontSize: 10, fontWeight: 600, padding: "2px 7px", borderRadius: 20, letterSpacing: "0.04em",
            background: isSet ? "var(--green-light)" : "var(--gray-100)",
            color: isSet ? "var(--green)" : "var(--gray-400)",
            border: isSet ? "1px solid var(--green-border)" : "1px solid var(--gray-200)",
          }}>
            {isSet ? "✓ SET" : "NOT SET"}
          </span>
  