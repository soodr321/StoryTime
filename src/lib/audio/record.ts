/**
 * Parent-recorded narration (MediaRecorder). The recording is stored as a data URL on the
 * page, so a family story can be read in Nani's real voice, offline, with no server.
 * iOS Safari records audio/mp4; Chrome records audio/webm. Both play back in <audio>.
 */
export interface Recorder { stop: () => Promise<{ dataUrl: string; ms: number } | null> }

export async function startRecording(): Promise<Recorder> {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const type = ["audio/mp4", "audio/webm;codecs=opus", "audio/webm"].find((t) => MediaRecorder.isTypeSupported(t)) ?? "";
  const rec = new MediaRecorder(stream, type ? { mimeType: type } : undefined);
  const chunks: Blob[] = [];
  const t0 = Date.now();
  rec.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
  rec.start();                        // no timeslice: iOS produces an empty/invalid mp4 with one
  let settled: Promise<{ dataUrl: string; ms: number } | null> | null = null;
  const release = () => stream.getTracks().forEach((t) => t.stop());
  return {
    stop: () => settled ??= new Promise((resolve) => {   // idempotent: every outcome settles exactly once
      const ms = Date.now() - t0;                          // measured at stop, not after encoding
      const finish = (v: { dataUrl: string; ms: number } | null) => { release(); resolve(v); };
      rec.onerror = () => finish(null);
      rec.onstop = () => {
        const blob = new Blob(chunks, { type: rec.mimeType || type || "audio/webm" });
        if (!blob.size) return finish(null);
        const fr = new FileReader();
        fr.onerror = () => finish(null);
        fr.onload = () => finish({ dataUrl: fr.result as string, ms });
        fr.readAsDataURL(blob);
      };
      if (rec.state === "inactive") { rec.onstop?.(new Event("stop")); return; }
      try { rec.stop(); } catch { finish(null); }
      setTimeout(() => finish(null), 8000);               // never leave the builder waiting
    }),
  };
}

export const canRecord = () => typeof navigator !== "undefined" && !!navigator.mediaDevices?.getUserMedia && typeof MediaRecorder !== "undefined";
