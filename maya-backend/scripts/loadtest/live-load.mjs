#!/usr/bin/env node
/**
 * Live-session load generator for the /live-session WebSocket gateway.
 *
 * Mimics ServerLiveTransport (maya-frontend): start_session with supportsOpus, binary
 * 16 kHz PCM16 mic frames every 100 ms while "speaking" (gated mic: silent while Maya talks),
 * turn_complete at the end of each user turn, client_ping every 10 s.
 *
 * Run it from a machine OTHER than the VPS (it would skew the CPU being measured), against
 * a backend started with LIVE_FAKE_UPSTREAM=1 so no Gemini cost is incurred.
 *
 *   node scripts/loadtest/live-load.mjs --url wss://host:3100/live-session \
 *        --steps 1,5,10,20,30 --hold 180 --guard https://api.speakwithmaya.com/v1/health
 *
 * Output: a per-step table on stdout and full JSON in --out (default loadtest-result.json).
 */
import WebSocket from 'ws';
import { randomUUID } from 'node:crypto';
import { writeFileSync } from 'node:fs';

const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, a, i, all) => {
    if (a.startsWith('--')) acc.push([a.slice(2), all[i + 1]?.startsWith('--') ? 'true' : all[i + 1]]);
    return acc;
  }, []),
);
const URL_ = args.url || 'ws://localhost:3100/live-session';
const STEPS = (args.steps || '1,5,10,20,30').split(',').map(Number);
const HOLD_S = Number(args.hold || 180);
const RAMP_MS = Number(args.ramp || 15000); // spread new connections over this window
const GUARD = args.guard || ''; // production health URL; abort if it degrades
const OUT = args.out || 'loadtest-result.json';

const FRAME_MS = 100;
const FRAME_BYTES = (16000 * FRAME_MS) / 1000 * 2; // 3200 bytes of PCM16 @16 kHz

function speechFrame(seed) {
  const b = Buffer.alloc(FRAME_BYTES);
  for (let i = 0; i < FRAME_BYTES / 2; i++) {
    const t = (seed * FRAME_BYTES / 2 + i) / 16000;
    const v = 0.4 * Math.sin(2 * Math.PI * 140 * t) * (0.6 + 0.4 * Math.sin(2 * Math.PI * 3.5 * t)) + 0.02 * (Math.random() * 2 - 1);
    b.writeInt16LE(Math.round(v * 12000), i * 2);
  }
  return b;
}

const pct = (arr, p) => {
  if (!arr.length) return null;
  const s = [...arr].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))];
};

class SimUser {
  constructor(id) {
    this.id = id;
    this.sessionId = randomUUID();
    this.m = { turns: 0, firstAudioMs: [], frameGapsMs: [], audioFrames: 0, errors: [], closedEarly: false, connectMs: null };
    this.stopped = false;
  }

  start() {
    const t0 = Date.now();
    this.ws = new WebSocket(URL_);
    this.ws.binaryType = 'arraybuffer';
    this.ws.on('open', () => {
      this.m.connectMs = Date.now() - t0;
      this.ws.send(JSON.stringify({
        type: 'start_session',
        sessionId: this.sessionId,
        supportsOpus: true,
        options: { sessionId: this.sessionId, topic: 'Load test', level: 'B1', mode: 'casual', durationSeconds: 600, languageMode: 'english' },
      }));
      this.pingTimer = setInterval(() => this.safeSend(JSON.stringify({ type: 'client_ping', ts: Date.now() })), 10000);
    });
    this.ws.on('message', (data, isBinary) => this.onMessage(data, isBinary));
    this.ws.on('error', (e) => this.m.errors.push(`ws:${e.message}`));
    this.ws.on('close', () => {
      if (!this.stopped) this.m.closedEarly = true;
      this.cleanup();
    });
  }

  safeSend(d) {
    try { if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(d); } catch {}
  }

  onMessage(data, isBinary) {
    if (isBinary) return;
    let msg;
    try { msg = JSON.parse(data.toString()); } catch { return; }
    const now = Date.now();
    switch (msg.type) {
      case 'ping': this.safeSend('pong'); break;
      case 'ready': if (!this.speaking && !this.awaitingReply) this.scheduleUserTurn(1500); break;
      case 'audio':
      case 'audio_opus':
        this.m.audioFrames++;
        if (this.turnSentAt) { this.m.firstAudioMs.push(now - this.turnSentAt); this.turnSentAt = null; }
        if (this.lastFrameAt) this.m.frameGapsMs.push(now - this.lastFrameAt);
        this.lastFrameAt = now;
        break;
      case 'turn_complete':
        this.lastFrameAt = null;
        this.awaitingReply = false;
        this.scheduleUserTurn(800 + Math.random() * 1500);
        break;
      case 'error': this.m.errors.push(`srv:${msg.message}`); break;
    }
  }

  scheduleUserTurn(delayMs) {
    if (this.stopped || this.speaking) return;
    clearTimeout(this.turnTimer);
    this.turnTimer = setTimeout(() => this.speak(), delayMs);
  }

  speak() {
    if (this.stopped) return;
    this.speaking = true;
    const frames = Math.round((3000 + Math.random() * 3000) / FRAME_MS); // 3-6 s of speech
    let n = 0;
    this.speakTimer = setInterval(() => {
      if (this.stopped) return clearInterval(this.speakTimer);
      this.safeSend(speechFrame(n));
      if (++n >= frames) {
        clearInterval(this.speakTimer);
        this.speaking = false;
        this.awaitingReply = true;
        this.m.turns++;
        this.turnSentAt = Date.now();
        this.safeSend(JSON.stringify({ type: 'turn_complete' }));
        // If no reply arrives, keep the conversation going anyway
        this.turnTimer = setTimeout(() => { this.awaitingReply = false; this.scheduleUserTurn(0); }, 20000);
      }
    }, FRAME_MS);
  }

  stop() {
    this.stopped = true;
    this.cleanup();
    try { this.ws?.close(1000, 'loadtest done'); } catch {}
  }

  cleanup() {
    clearInterval(this.pingTimer);
    clearInterval(this.speakTimer);
    clearTimeout(this.turnTimer);
  }
}

async function guardOk() {
  if (!GUARD) return true;
  const t = Date.now();
  try {
    const r = await fetch(GUARD, { signal: AbortSignal.timeout(5000) });
    return r.ok && Date.now() - t < 3000;
  } catch { return false; }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  console.log(`Target ${URL_} | steps ${STEPS.join(' -> ')} | hold ${HOLD_S}s | guard ${GUARD || 'off'}`);
  const users = [];
  const results = [];
  let aborted = null;
  let guardFails = 0;
  const guardTimer = setInterval(async () => {
    if (await guardOk()) guardFails = 0;
    else if (++guardFails >= 2) aborted = 'production health check failed/slow twice';
  }, 5000);

  for (const target of STEPS) {
    if (aborted) break;
    const toAdd = target - users.length;
    for (let i = 0; i < toAdd; i++) {
      const u = new SimUser(users.length + 1);
      users.push(u);
      u.start();
      await sleep(RAMP_MS / Math.max(1, toAdd));
    }
    // reset per-step metrics after ramp so each step measures steady state
    for (const u of users) Object.assign(u.m, { firstAudioMs: [], frameGapsMs: [], audioFrames: 0, turns: 0 });
    const stepStart = new Date().toISOString();
    for (let s = 0; s < HOLD_S && !aborted; s += 5) await sleep(5000);

    const all = (k) => users.flatMap((u) => u.m[k]);
    const r = {
      concurrency: target,
      startedAt: stepStart,
      endedAt: new Date().toISOString(),
      turns: users.reduce((a, u) => a + u.m.turns, 0),
      audioFrames: users.reduce((a, u) => a + u.m.audioFrames, 0),
      firstAudioMs: { p50: pct(all('firstAudioMs'), 50), p95: pct(all('firstAudioMs'), 95), max: pct(all('firstAudioMs'), 100) },
      frameGapMs: { p50: pct(all('frameGapsMs'), 50), p95: pct(all('frameGapsMs'), 95), p99: pct(all('frameGapsMs'), 99), max: pct(all('frameGapsMs'), 100) },
      closedEarly: users.filter((u) => u.m.closedEarly).length,
      errors: [...new Set(users.flatMap((u) => u.m.errors))].slice(0, 10),
    };
    results.push(r);
    console.log(
      `[${target} sessions] turns=${r.turns} firstAudio p50/p95=${r.firstAudioMs.p50}/${r.firstAudioMs.p95}ms ` +
        `frameGap p95/p99/max=${r.frameGapMs.p95}/${r.frameGapMs.p99}/${r.frameGapMs.max}ms dropped=${r.closedEarly} errors=${r.errors.length}`,
    );
  }

  clearInterval(guardTimer);
  users.forEach((u) => u.stop());
  if (aborted) console.log(`ABORTED: ${aborted}`);
  writeFileSync(OUT, JSON.stringify({ url: URL_, holdSeconds: HOLD_S, aborted, results }, null, 2));
  console.log(`Wrote ${OUT}. All sessions closed; watch RAM return to baseline on the VPS for ~2-3 min.`);
  setTimeout(() => process.exit(0), 1500);
}

main();
