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
  rec.start(250);
  return {
    stop: () => new Promise((resolve) => {
      rec.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunks, { type: rec.mimeType || type || "audio/webm" });
        if (!blob.size) return resolve(null);
        const fr = new FileReader();
        fr.onload = () => resolve({ dataUrl: fr.result as string, ms: Date.now() - t0 });
        fr.readAsDataURL(blob);
      };
      rec.stop();
    }),
  };
}

export const canRecord = () => typeof navigator !== "undefined" && !!navigator.mediaDevices?.getUserMedia && typeof MediaRecorder !== "undefined";
