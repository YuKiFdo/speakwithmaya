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
    this.maxUnderflowFrames = 120; // 120 * 128 frames / 44100 ~= 350ms

    this.port.onmessage = (event) => {
      const msg = event.data;
      if (!msg) return;

      if (msg.type === 'audio' && msg.samples) {
        const samples = msg.samples;
        if (samples.length > 0) {
          this.queue.push(samples);
          this.totalBufferedSamples += samples.length;
          this.underflowFrames = 0;

          // Start playing when pre-buffer threshold is reached, or resume immediately if already active
          if (!this.isPlaying && this.totalBufferedSamples >= this.prebufferTarget) {
            this.isPlaying = true;
            this.port.postMessage({ state: 'speaking' });
          }
        }
      } else if (msg.type === 'flush') {
        this.isFlushing = true;
        // If there's pending audio, start playing immediately even if below prebuffer threshold
        if (this.totalBufferedSamples > 0 && !this.isPlaying) {
          this.isPlaying = true;
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
          // Model is still streaming; give a grace period before declaring idle
          this.underflowFrames++;
          if (this.underflowFrames >= this.maxUnderflowFrames) {
            this.isPlaying = false;
            this.port.postMessage({ state: 'idle' });
          }
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
