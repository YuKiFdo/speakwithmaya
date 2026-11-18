/**
 * Click-Free Continuous FIFO AudioWorklet Player with Jitter Buffer and Hardware Resampling.
 * Queues incoming 24kHz Float32 PCM chunks sequentially.
 * Each chunk is played exactly once and immediately discarded, making duplicate audio,
 * echoes, and buffer loop-backs physically impossible.
 */
class PCMPlayerProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.sourceSampleRate = 24000;
    this.queue = [];
    this.readOffset = 0.0;
    this.totalBufferedSamples = 0;
    this.isPlaying = false;
    this.isFlushing = false;
    // Initial pre-buffer (~150ms at 24kHz = 3600 samples) to absorb network jitter
    this.prebufferTarget = 3600;
    // Grace frames allowed during packet arrival delay before assuming speech ended (~350ms)
    this.underflowFrames = 0;
    // A mid-turn gap (server/CPU stall) waits this long for more audio before treating the
    // turn as over. Was ~350ms, which cut Maya off mid-sentence during multi-second stalls.
    this.maxUnderflowFrames = 700; // ~2s at 44.1-48 kHz with 128-frame quanta
    // Rebuffering: when the queue runs dry mid-turn, hold output until the cushion refills
    // instead of playing each late chunk the instant it lands (that sounded like stutter).
    this.rebuffering = false;
    // Adaptive extra cushion: +100ms per mid-turn underrun (max +300ms), -50ms per clean turn.
    this.adaptiveExtra = 0;
    this.underrunThisTurn = false;

    this.port.onmessage = (event) => {
      const msg = event.data;
      if (!msg) return;

      if (msg.type === 'set_jitter_buffer' && typeof msg.prebufferSamples === 'number') {
        this.prebufferTarget = Math.max(1200, Math.min(12000, msg.prebufferSamples));
        return;
      }

      if (msg.type === 'audio' && msg.samples) {
        const samples = msg.samples;
        if (samples.length > 0) {
          this.queue.push(samples);
          this.totalBufferedSamples += samples.length;
          this.underflowFrames = 0;

          // Start playing when pre-buffer threshold is reached, or resume immediately if already active
          if (!this.isPlaying && this.totalBufferedSamples >= this.prebufferTarget + this.adaptiveExtra) {
            this.isPlaying = true;
            // Prepend 60ms of zero-samples (~1440 samples at 24kHz) to allow physical DACs / OS mixers
            // to unmute smoothly without clipping the first spoken syllable/consonant.
            const leadInSilence = new Float32Array(1440);
            this.queue.unshift(leadInSilence);
            this.totalBufferedSamples += 1440;
            this.port.postMessage({ state: 'speaking' });
          }
        }
      } else if (msg.type === 'flush') {
        this.isFlushing = true;
        this.rebuffering = false; // turn complete: play out whatever is left
        if (!this.underrunThisTurn) this.adaptiveExtra = Math.max(0, this.adaptiveExtra - 1200);
        this.underrunThisTurn = false;
        // If there's pending audio, start playing immediately even if below prebuffer threshold
        if (this.totalBufferedSamples > 0 && !this.isPlaying) {
          this.isPlaying = true;
          const leadInSilence = new Float32Array(1440);
          this.queue.unshift(leadInSilence);
          this.totalBufferedSamples += 1440;
          this.port.postMessage({ state: 'speaking' });
        } else if (this.totalBufferedSamples === 0) {
          this.isPlaying = false;
          this.isFlushing = false;
          this.port.postMessage({ state: 'idle' });
        }
      } else if (msg.type === 'clear') {
        // Instant interruption (barge-in): discard all audio immediately
        this.queue = [];
        this.readOffset = 0.0;
        this.totalBufferedSamples = 0;
        this.isPlaying = false;
        this.isFlushing = false;
        this.underflowFrames = 0;
        this.rebuffering = false;
        this.underrunThisTurn = false;
        this.port.postMessage({ state: 'idle' });
      }
    };
  }

  process(inputs, outputs) {
    const output = outputs[0];
    if (!output || !output[0]) return true;
    const channelCount = output.length;
    const outputFrames = output[0].length; // typically 128 frames

    if (!this.isPlaying) {
      for (let c = 0; c < channelCount; c++) {
        output[c].fill(0);
      }
      return true;
    }

    // Rebuffering after a mid-turn underrun: stay silent (consume nothing) until the cushion
    // is back, so a stall is heard as one short pause rather than choppy fragments.
    if (this.rebuffering) {
      if (this.isFlushing || this.totalBufferedSamples >= this.prebufferTarget + this.adaptiveExtra) {
        this.rebuffering = false;
        this.underflowFrames = 0;
      } else {
        for (let c = 0; c < channelCount; c++) output[c].fill(0);
        this.underflowFrames++;
        if (this.underflowFrames >= this.maxUnderflowFrames) {
          this.rebuffering = false;
          this.isPlaying = false;
          this.port.postMessage({ state: 'idle' });
        }
        return true;
      }
    }

    // Step ratio for hardware resampling
    const step = this.sourceSampleRate / sampleRate;

    for (let i = 0; i < outputFrames; i++) {
      if (this.queue.length === 0) {
        // Output silence for remaining frames in this buffer
        for (let c = 0; c < channelCount; c++) {
          output[c].fill(0, i);
        }

        if (this.isFlushing) {
          // Model turn is complete and queue is fully drained
          this.isPlaying = false;
          this.isFlushing = false;
          this.port.postMessage({ state: 'idle' });
        } else {
          // Model is still streaming but audio is late: rebuffer, and grow the cushion so the
          // rest of this connection's turns absorb similar stalls.
          if (!this.underrunThisTurn) {
            this.adaptiveExtra = Math.min(7200, this.adaptiveExtra + 2400);
            this.underrunThisTurn = true;
          }
          this.rebuffering = true;
          this.underflowFrames++;
        }
        break;
      }

      this.underflowFrames = 0;
      const currentChunk = this.queue[0];
      const idx0 = Math.floor(this.readOffset);
      const frac = this.readOffset - idx0;

      const s0 = (idx0 < currentChunk.length) ? currentChunk[idx0] : 0;
      let s1 = s0;

      if (idx0 + 1 < currentChunk.length) {
        s1 = currentChunk[idx0 + 1];
      } else if (this.queue.length > 1 && this.queue[1].length > 0) {
        s1 = this.queue[1][0];
      }

      const sample = s0 + frac * (s1 - s0);

      // Copy to all output channels
      for (let c = 0; c < channelCount; c++) {
        output[c][i] = sample;
      }

      this.readOffset += step;

      // When finished reading current chunk, immediately discard it
      while (this.queue.length > 0 && this.readOffset >= this.queue[0].length) {
        this.readOffset -= this.queue[0].length;
        this.totalBufferedSamples -= this.queue[0].length;
        this.queue.shift();
      }
    }

    return true;
  }
}

registerProcessor('pcm-player-processor', PCMPlayerProcessor);
