/**
 * Worker thread that builds a session's recording files (concat / resample / encode) so the
 * main event loop, which streams live calls, is never blocked when sessions end. The load
 * test showed several sessions finishing together could stall the loop for seconds.
 */
import { parentPort } from 'node:worker_threads';
import { buildSessionAudioFiles, unpackSessionAudio, type PackedLayout, type SessionAudioInput } from './audio-codec.js';

parentPort?.on('message', (msg: { id: number; packed: ArrayBuffer; layout: PackedLayout }) => {
  try {
    const input: SessionAudioInput = unpackSessionAudio(msg.packed, msg.layout);
    const files = buildSessionAudioFiles(input);
    const transfer: ArrayBuffer[] = [];
    const own = (b?: Buffer) => {
      if (!b) return undefined;
      const copy = new Uint8Array(b.length); // own ArrayBuffer so it can be transferred
      copy.set(b);
      transfer.push(copy.buffer);
      return copy;
    };
    parentPort!.postMessage(
      {
        id: msg.id,
        ok: true,
        files: {
          mime: files.mime,
          ext: files.ext,
          user: own(files.user),
          model: own(files.model),
          full: own(files.full),
          userTurns: files.userTurns.map(([k, b]) => [k, own(b)]),
          modelTurns: files.modelTurns.map(([k, b]) => [k, own(b)]),
        },
      },
      transfer,
    );
  } catch (err: any) {
    parentPort!.postMessage({ id: msg.id, ok: false, message: err?.message || String(err) });
  }
});
