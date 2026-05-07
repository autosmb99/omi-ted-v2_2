"use client";
import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import axios from "axios";

interface KeyStatus {
  sarvam_key_set: boolean;
  openrouter_key_set: boolean;
  google_key_set: boolean;
  local_url_set: boolean;
  local_key_set: boolean;
  cookies_set: boolean;
}
interface Props { open: boolean; onClose: () => void; }

export default function SettingsModal({ open, onClose }: Props) {
  const [status, setStatus]         = useState<KeyStatus | null>(null);
  const [sarvam, setSarvam]         = useState("");
  const [openrouter, setOpenrouter] = useState("");
  const [localUrl, setLocalUrl]     = useState("");
  const [localKey, setLocalKey]     = useState("");
  const [saving, setSaving]         = useState(false);
  const [saved, setSaved]           = useState(false);
  const [error, setError]           = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      setError(null);
      axios.get<KeyStatus>("/api/v1/settings")
        .then((r) => setStatus(r.data))
        .catch((err: unknown) => {
          const msg = axios.isAxiosError(err)
            ? err.response?.data?.detail ?? err.message
            : String(err);
          setError(typeof msg === "string" ? msg : JSON.stringify(msg));
        });
    }
  }, [open]);

  async function handleSave() {
    setSaving(true); setError(null); setSaved(false);
    try {
      const r = await axios.post<KeyStatus>("/api/v1/settings", {
        ...(sarvam.trim()     ? { sarvam_api_key:     sarvam.trim()     } : {}),
        ...(openrouter.trim() ? { openrouter_api_key: openrouter.trim() } : {}),
        ...(localUrl.trim()   ? { local_llm_url:      localUrl.trim()   } : {}),
        ...(localKey.trim()   ? { local_llm_key:      localKey.trim()   } : {}),
      });
      setStatus(r.data);
      setSarvam(""); setOpenrouter(""); setLocalUrl(""); setLocalKey("");
      setSaved(true); setTimeout(() => setSaved(false), 2500);
    } catch (err: unknown) {
      const msg = axios.isAxiosError(err)
        ? err.response?.data?.detail ?? err.message
        : String(err);
      setError(typeof msg === "string" ? msg : JSON.stringify(msg));
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
                <button onClick={onClose} aria-label="Close settings" title="Close settings"
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
              <KeyRow
                label="Local LLM URL" hint="Ollama, vLLM, llama.cpp — base URL"
                isSet={status?.local_url_set ?? false}
                value={localUrl} onChange={setLocalUrl}
                placeholder="http://localhost:11434/v1" link="https://ollama.com"
              />
              <KeyRow
                label="Local LLM Key" hint="Optional API key for local endpoint"
                isSet={status?.local_key_set ?? false}
                value={localKey} onChange={setLocalKey}
                placeholder="optional-key" link=""
              />

              {/* Cookies status (read-only) */}
              <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderTop: "1px solid var(--gray-100)" }}>
                <span style={{ fontSize: 13, fontWeight: 500, color: "var(--gray-700)", width: 120 }}>YouTube Cookies</span>
                <span style={{
                  fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 99,
                  background: status?.cookies_set ? "var(--green-light)" : "var(--gray-100)",
                  color: status?.cookies_set ? "var(--green)" : "var(--gray-400)",
                }}>
                  {status?.cookies_set ? "Active" : "Not found"}
                </span>
                <span style={{ fontSize: 11, color: "var(--gray-400)", flex: 1 }}>
                  {status?.cookies_set ? "Reduces 429 errors" : "Add cookies.txt to project root"}
                </span>
              </div>

              <motion.button onClick={handleSave}
                disabled={saving || (!sarvam.trim() && !openrouter.trim() && !localUrl.trim() && !localKey.trim())}
                whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }}
                style={{
                  marginTop: 4, padding: "10px 0", borderRadius: 10, border: "none",
                  cursor: "pointer", fontSize: 13, fontWeight: 600,
                  background: saved ? "var(--green-light)" : "var(--rose)",
                  color: saved ? "var(--green)" : "#fff",
                  opacity: (!saving && (sarvam.trim() || openrouter.trim() || localUrl.trim() || localKey.trim())) ? 1 : 0.4,
                  transition: "background 0.2s, color 0.2s",
                }}>
                {saving ? "Saving…" : saved ? "✓ Saved!" : "Save keys"}
              </motion.button>

              {error && (
                <p style={{ textAlign: "center", fontSize: 11, color: "var(--red)", margin: "-4px 0 0" }}>
                  {error}
                </p>
              )}

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
        </div>
        {link && (
          <a href={link} target="_blank" rel="noreferrer"
            style={{ fontSize: 11, color: "var(--rose)", textDecoration: "none", fontWeight: 500 }}>
            Get key ↗
          </a>
        )}
      </div>
      <p style={{ fontSize: 11, color: "var(--gray-400)", margin: "0 0 8px" }}>{hint}</p>
      <input type="password" value={value} onChange={(e) => onChange(e.target.value)}
        aria-label={`${label} API key`}
        placeholder={isSet ? "Enter new key to replace" : placeholder}
        style={{
          width: "100%", padding: "8px 10px", borderRadius: 7,
          border: "1px solid var(--gray-200)", background: "var(--white)",
          fontSize: 12, fontFamily: "JetBrains Mono, monospace",
          color: "var(--gray-900)", outline: "none",
        }}
        onFocus={(e) => { e.target.style.borderColor = "var(--rose)"; e.target.style.boxShadow = "0 0 0 3px rgba(244,63,94,0.08)"; }}
        onBlur={(e)  => { e.target.style.borderColor = "var(--gray-200)"; e.target.style.boxShadow = "none"; }}
      />
    </div>
  );
}
