/**
 * Zustand global store.
 *
 * Starts minimal — just the active video ID for the editor.
 * Expand in M3 when the parallel editor needs segment state.
 */
import { create } from "zustand";

interface AppState {
  /** ID of the video currently open in the editor (null = none). */
  activeVideoId: number | null;
  setActiveVideoId: (id: number | null) => void;
}

export const useAppStore = create<AppState>((set) => ({
  activeVideoId: null,
  setActiveVideoId: (id) => set({ activeVideoId: id }),
}));
