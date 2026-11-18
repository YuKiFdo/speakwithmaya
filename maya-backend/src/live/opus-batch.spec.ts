import { describe, it, expect } from 'vitest';
import { LiveGateway } from './live.gateway.js';

// queueOpusPacket / flushOpusBatch are private; exercise them on a bare prototype instance
// with safeSendToClient stubbed, so no Nest wiring or sockets are needed.
function harness(supportsOpusBatch: boolean) {
  const sent: any[] = [];
  const gw: any = Object.create(LiveGateway.prototype);
  gw.safeSendToClient = (_state: any, payload: string) => sent.push(JSON.parse(payload));
  const state: any = { supportsOpusBatch, opusBatch: [] };
  return { gw, state, sent };
}
const pkt = (n: number) => Buffer.from([n, n, n]);

describe('LiveGateway Opus batching', () => {
  it('legacy clients get one packet per message', () => {
    const { gw, state, sent } = harness(false);
    for (let i = 1; i <= 4; i++) gw.queueOpusPacket(state, pkt(i));
    expect(sent).toHaveLength(4);
    expect(sent[0]).toEqual({ type: 'audio_opus', data: pkt(1).toString('base64') });
  });

  it('batching clients get 3 packets per message, in order, and the rest on flush', () => {
    const { gw, state, sent } = harness(true);
    for (let i = 1; i <= 7; i++) gw.queueOpusPacket(state, pkt(i));
    expect(sent).toHaveLength(2);
    expect(sent[0].packets).toEqual([1, 2, 3].map((n) => pkt(n).toString('base64')));
    expect(sent[1].packets).toEqual([4, 5, 6].map((n) => pkt(n).toString('base64')));
    gw.flushOpusBatch(state); // end of model turn
    expect(sent).toHaveLength(3);
    expect(sent[2].packets).toEqual([pkt(7).toString('base64')]);
    gw.flushOpusBatch(state); // nothing left: no empty message
    expect(sent).toHaveLength(3);
  });
});
