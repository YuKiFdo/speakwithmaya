/**
 * Minimal WebM (Matroska) writer for one mono Opus audio track, plus a PCM -> WebM/Opus
 * encoder. Recordings were stored as WAV (16-bit PCM); WebM/Opus at ~24 kbps is ~15x
 * smaller. Plays in Chrome, Firefox, Android and Safari on iOS 17.4+ (older browsers get a
 * WAV conversion from the recording-audio endpoint).
 *
 * Layout: EBML header, Segment { SeekHead, Info, Tracks, Cluster*, Cues }. Clusters hold
 * 20 ms SimpleBlocks and start every 5 s; Cues point at each cluster so seeking works.
 * No dependencies besides an Opus encoder passed in, so it runs inside worker threads.
 */

// ---- EBML primitives -------------------------------------------------------------------

function vintSize(n: number): Buffer {
  // Smallest EBML variable-size integer that can hold n (all-ones values are reserved).
  for (let len = 1; len <= 8; len++) {
    if (n < 2 ** (7 * len) - 1) {
      const b = Buffer.alloc(len);
      let v = n;
      for (let i = len - 1; i >= 0; i--) {
        b[i] = v & 0xff;
        v = Math.floor(v / 256);
      }
      b[0] |= 1 << (8 - len);
      return b;
    }
  }
  throw new Error(`EBML size too large: ${n}`);
}

function uint(n: number, bytes?: number): Buffer {
  let len = bytes ?? 1;
  if (bytes === undefined) while (n >= 2 ** (8 * len)) len++;
  const b = Buffer.alloc(len);
  let v = n;
  for (let i = len - 1; i >= 0; i--) {
    b[i] = v & 0xff;
    v = Math.floor(v / 256);
  }
  return b;
}

function float64(x: number): Buffer {
  const b = Buffer.alloc(8);
  b.writeDoubleBE(x);
  return b;
}

function el(id: number, payload: Buffer | Buffer[]): Buffer {
  const data = Array.isArray(payload) ? Buffer.concat(payload) : payload;
  return Buffer.concat([uint(id), vintSize(data.length), data]);
}

const ID = {
  EBML: 0x1a45dfa3, EBMLVersion: 0x4286, EBMLReadVersion: 0x42f7, EBMLMaxIDLength: 0x42f2,
  EBMLMaxSizeLength: 0x42f3, DocType: 0x4282, DocTypeVersion: 0x4287, DocTypeReadVersion: 0x4285,
  Segment: 0x18538067, SeekHead: 0x114d9b74, Seek: 0x4dbb, SeekID: 0x53ab, SeekPosition: 0x53ac,
  Info: 0x1549a966, TimecodeScale: 0x2ad7b1, MuxingApp: 0x4d80, WritingApp: 0x5741, Duration: 0x4489,
  Tracks: 0x1654ae6b, TrackEntry: 0xae, TrackNumber: 0xd7, TrackUID: 0x73c5, TrackType: 0x83,
  CodecID: 0x86, CodecPrivate: 0x63a2, CodecDelay: 0x56aa, SeekPreRoll: 0x56bb, Audio: 0xe1,
  SamplingFrequency: 0xb5, Channels: 0x9f, Cluster: 0x1f43b675, Timecode: 0xe7, SimpleBlock: 0xa3,
  Cues: 0x1c53bb6b, CuePoint: 0xbb, CueTime: 0xb3, CueTrackPositions: 0xb7, CueTrack: 0xf7,
  CueClusterPosition: 0xf1,
};

// ---- Muxer -----------------------------------------------------------------------------

export const OPUS_FRAME_MS = 20;
const OPUS_PRE_SKIP = 312; // libopus lookahead, in 48 kHz samples (6.5 ms)
const CLUSTER_MS = 5000;

export function opusHead(inputSampleRate: number, channels = 1): Buffer {
  const b = Buffer.alloc(19);
  b.write('OpusHead', 0, 'ascii');
  b[8] = 1; // version
  b[9] = channels;
  b.writeUInt16LE(OPUS_PRE_SKIP, 10);
  b.writeUInt32LE(inputSampleRate, 12);
  b.writeInt16LE(0, 16); // output gain
  b[18] = 0; // channel mapping family
  return b;
}

/** Wraps consecutive 20 ms Opus packets of one mono track into a seekable WebM file. */
export function muxWebmOpus(packets: Buffer[], inputSampleRate: number): Buffer {
  const header = el(ID.EBML, [
    el(ID.EBMLVersion, uint(1)),
    el(ID.EBMLReadVersion, uint(1)),
    el(ID.EBMLMaxIDLength, uint(4)),
    el(ID.EBMLMaxSizeLength, uint(8)),
    el(ID.DocType, Buffer.from('webm')),
    el(ID.DocTypeVersion, uint(4)),
    el(ID.DocTypeReadVersion, uint(2)),
  ]);

  const durationMs = packets.length * OPUS_FRAME_MS;
  const info = el(ID.Info, [
    el(ID.TimecodeScale, uint(1_000_000)), // 1 ms
    el(ID.MuxingApp, Buffer.from('maya')),
    el(ID.WritingApp, Buffer.from('maya')),
    el(ID.Duration, float64(durationMs)),
  ]);
  const tracks = el(ID.Tracks, [
    el(ID.TrackEntry, [
      el(ID.TrackNumber, uint(1)),
      el(ID.TrackUID, uint(1)),
      el(ID.TrackType, uint(2)), // audio
      el(ID.CodecID, Buffer.from('A_OPUS')),
      el(ID.CodecPrivate, opusHead(inputSampleRate)),
      el(ID.CodecDelay, uint(Math.round((OPUS_PRE_SKIP / 48000) * 1e9))),
      el(ID.SeekPreRoll, uint(80_000_000)),
      el(ID.Audio, [el(ID.SamplingFrequency, float64(48000)), el(ID.Channels, uint(1))]),
    ]),
  ]);

  const clusters: Buffer[] = [];
  const clusterTimes: number[] = [];
  const perCluster = CLUSTER_MS / OPUS_FRAME_MS;
  for (let start = 0; start < packets.length || (start === 0 && packets.length === 0); start += perCluster) {
    const t0 = start * OPUS_FRAME_MS;
    const blocks: Buffer[] = [el(ID.Timecode, uint(t0))];
    for (let i = start; i < Math.min(packets.length, start + perCluster); i++) {
      const rel = Buffer.alloc(2);
      rel.writeInt16BE((i - start) * OPUS_FRAME_MS);
      blocks.push(el(ID.SimpleBlock, [Buffer.from([0x81]), rel, Buffer.from([0x80]), packets[i]]));
    }
    clusters.push(el(ID.Cluster, blocks));
    clusterTimes.push(t0);
    if (packets.length === 0) break;
  }

  // SeekHead with fixed 8-byte positions so its size does not depend on the values.
  const seekEntry = (id: number, pos: number) =>
    el(ID.Seek, [el(ID.SeekID, uint(id)), el(ID.SeekPosition, uint(pos, 8))]);
  const seekHeadSize = el(ID.SeekHead, [seekEntry(ID.Info, 0), seekEntry(ID.Tracks, 0), seekEntry(ID.Cues, 0)]).length;

  // Positions are relative to the start of the Segment's data.
  const infoPos = seekHeadSize;
  const tracksPos = infoPos + info.length;
  let pos = tracksPos + tracks.length;
  const clusterPositions = clusters.map((c) => {
    const p = pos;
    pos += c.length;
    return p;
  });
  const cuesPos = pos;
  const cues = el(
    ID.Cues,
    clusterPositions.map((p, i) =>
      el(ID.CuePoint, [
        el(ID.CueTime, uint(clusterTimes[i])),
        el(ID.CueTrackPositions, [el(ID.CueTrack, uint(1)), el(ID.CueClusterPosition, uint(p))]),
      ]),
    ),
  );
  const seekHead = el(ID.SeekHead, [seekEntry(ID.Info, infoPos), seekEntry(ID.Tracks, tracksPos), seekEntry(ID.Cues, cuesPos)]);

  const segment = el(ID.Segment, [seekHead, info, tracks, ...clusters, cues]);
  return Buffer.concat([header, segment]);
}

// ---- PCM -> WebM/Opus ------------------------------------------------------------------

export interface OpusEncoderLike {
  encode(pcm: Buffer): Buffer;
  setBitrate?(bitrate: number): void;
  applyEncoderCTL?(ctl: number, value: number): void;
}
export type OpusEncoderFactory = (sampleRate: number) => OpusEncoderLike;

const SPEECH_BITRATE = 24000;
const OPUS_SET_COMPLEXITY_REQUEST = 4010;

/** Encodes 16-bit mono PCM (16 or 24 kHz) into a WebM/Opus file at ~24 kbps. */
export function encodePcmToWebmOpus(pcm: Buffer, sampleRate: number, createEncoder: OpusEncoderFactory): Buffer {
  const enc = createEncoder(sampleRate);
  enc.setBitrate?.(SPEECH_BITRATE);
  // Complexity 5 instead of libopus' default 10: ~2.7x faster for the same size at
  // 24 kbps speech (measured), which matters on the 2-vCPU VPS.
  try {
    enc.applyEncoderCTL?.(OPUS_SET_COMPLEXITY_REQUEST, 5);
  } catch {
    /* keep default complexity */
  }
  const frameBytes = (sampleRate * OPUS_FRAME_MS * 2) / 1000;
  const packets: Buffer[] = [];
  for (let off = 0; off < pcm.length; off += frameBytes) {
    let frame = pcm.subarray(off, off + frameBytes);
    if (frame.length < frameBytes) {
      const padded = Buffer.alloc(frameBytes);
      frame.copy(padded);
      frame = padded;
    }
    packets.push(Buffer.from(enc.encode(frame)));
  }
  return muxWebmOpus(packets, sampleRate);
}

// ---- WebM/Opus -> WAV (for browsers without WebM/Opus, e.g. iOS Safari < 17.4) ----------

function readVint(buf: Buffer, pos: number, keepMarker: boolean): { value: number; len: number } {
  const first = buf[pos];
  let len = 1;
  while (len <= 8 && !(first & (0x80 >> (len - 1)))) len++;
  if (len > 8) throw new Error('bad EBML vint');
  let value = keepMarker ? first : first & (0xff >> len);
  for (let i = 1; i < len; i++) value = value * 256 + buf[pos + i];
  return { value, len };
}

/** Pulls the Opus packets and input sample rate out of a single-track WebM/Opus file. */
export function demuxWebmOpus(file: Buffer): { packets: Buffer[]; inputSampleRate: number } {
  const packets: Buffer[] = [];
  let inputSampleRate = 48000;
  const MASTER = new Set([ID.Segment, ID.Cluster, ID.Tracks, ID.TrackEntry]);
  const walk = (start: number, end: number) => {
    let pos = start;
    while (pos < end) {
      const id = readVint(file, pos, true);
      const size = readVint(file, pos + id.len, false);
      const dataStart = pos + id.len + size.len;
      const dataEnd = Math.min(end, dataStart + size.value);
      if (MASTER.has(id.value)) {
        walk(dataStart, dataEnd);
      } else if (id.value === ID.SimpleBlock) {
        const track = readVint(file, dataStart, false);
        packets.push(file.subarray(dataStart + track.len + 3, dataEnd)); // + timecode(2) + flags(1)
      } else if (id.value === ID.CodecPrivate && dataEnd - dataStart >= 16) {
        inputSampleRate = file.readUInt32LE(dataStart + 12);
      }
      pos = dataEnd;
    }
  };
  walk(0, file.length);
  return { packets, inputSampleRate };
}

export interface OpusDecoderLike {
  decode(packet: Buffer): Buffer;
}

/** Decodes a WebM/Opus recording back to 16-bit mono PCM at its original rate. */
export function decodeWebmOpusToPcm(
  file: Buffer,
  createDecoder: (sampleRate: number) => OpusDecoderLike,
): { pcm: Buffer; sampleRate: number } {
  const { packets, inputSampleRate } = demuxWebmOpus(file);
  const rate = [8000, 12000, 16000, 24000, 48000].includes(inputSampleRate) ? inputSampleRate : 48000;
  const dec = createDecoder(rate);
  const out: Buffer[] = [];
  for (const p of packets) out.push(Buffer.from(dec.decode(p)));
  // Drop the encoder's pre-skip so the decoded audio lines up with the original
  const skipBytes = Math.round((OPUS_PRE_SKIP / 48000) * rate) * 2;
  const pcm = Buffer.concat(out);
  return { pcm: pcm.subarray(Math.min(skipBytes, pcm.length)), sampleRate: rate };
}
