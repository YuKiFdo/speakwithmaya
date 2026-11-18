import { describe, it, expect, vi, afterEach } from 'vitest';
import { isFakeLiveUpstreamEnabled, connectFakeLiveSession } from './fake-live-upstream.js';

describe('isFakeLiveUpstreamEnabled', () => {
  it('is never enabled in production, even with the flag set', () => {
    expect(isFakeLiveUpstreamEnabled({ LIVE_FAKE_UPSTREAM: '1', NODE_ENV: 'production' })).toBe(false);
  });
  it('requires the explicit flag', () => {
    expect(isFakeLiveUpstreamEnabled({ NODE_ENV: 'loadtest' })).toBe(false);
    expect(isFakeLiveUpstreamEnabled({ LIVE_FAKE_UPSTREAM: 'true', NODE_ENV: 'loadtest' })).toBe(false);
  });
  it('is enabled with LIVE_FAKE_UPSTREAM=1 outside production', () => {
    expect(isFakeLiveUpstreamEnabled({ LIVE_FAKE_UPSTREAM: '1', NODE_ENV: 'loadtest' })).toBe(true);
  });
});

describe('FakeLiveSession', () => {
  afterEach(() => vi.useRealTimers());

  it('handshakes, then answers a user turn with audio, turnComplete and usage', async () => {
    vi.useFakeTimers();
    const msgs: any[] = [];
    let opened = false;
    const s = await connectFakeLiveSession({
      callbacks: { onopen: () => (opened = true), onmessage: (m) => msgs.push(m) },
    });
    await vi.advanceTimersByTimeAsync(100);
    expect(opened).toBe(true);
    expect(msgs[0]).toEqual({ setupComplete: {} });

    s.sendRealtimeInput({ audio: { data: Buffer.alloc(32000).toString('base64'), mimeType: 'audio/pcm;rate=16000' } });
    s.sendRealtimeInput({ activityEnd: {} });
    await vi.advanceTimersByTimeAsync(7000);

    const audio = msgs.filter((m) => m.serverContent?.modelTurn?.parts?.[0]?.inlineData);
    expect(audio.length).toBeGreaterThan(10);
    expect(Buffer.from(audio[0].serverContent.modelTurn.parts[0].inlineData.data, 'base64').length).toBe(1920);
    expect(msgs.some((m) => m.serverContent?.turnComplete)).toBe(true);
    expect(msgs.some((m) => m.usageMetadata?.totalTokenCount > 0)).toBe(true);
    s.close();
  });

  it('activityStart while replying interrupts the reply', async () => {
    vi.useFakeTimers();
    const msgs: any[] = [];
    const s = await connectFakeLiveSession({ callbacks: { onmessage: (m) => msgs.push(m) } });
    await vi.advanceTimersByTimeAsync(100);
    s.sendClientContent({ turns: [], turnComplete: true });
    await vi.advanceTimersByTimeAsync(1000); // reply streaming
    s.sendRealtimeInput({ activityStart: {} });
    expect(msgs.some((m) => m.serverContent?.interrupted)).toBe(true);
    const before = msgs.length;
    await vi.advanceTimersByTimeAsync(3000);
    expect(msgs.length).toBe(before); // no more audio after interrupt
    s.close();
  });
});
