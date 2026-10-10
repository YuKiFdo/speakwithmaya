import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const soundsDir = path.resolve(__dirname, '../assets/sounds');
if (!fs.existsSync(soundsDir)) {
  fs.mkdirSync(soundsDir, { recursive: true });
}

function createWavBuffer(samples, sampleRate = 44100) {
  const numChannels = 1;
  const bitsPerSample = 16;
  const byteRate = (sampleRate * numChannels * bitsPerSample) / 8;
  const blockAlign = (numChannels * bitsPerSample) / 8;
  const dataSize = samples.length * 2;
  const buffer = Buffer.alloc(44 + dataSize);

  // RIFF header
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write('WAVE', 8);

  // fmt subchunk
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16); // Subchunk1Size (16 for PCM)
  buffer.writeUInt16LE(1, 20); // AudioFormat (1 for PCM)
  buffer.writeUInt16LE(numChannels, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(byteRate, 28);
  buffer.writeUInt16LE(blockAlign, 32);
  buffer.writeUInt16LE(bitsPerSample, 34);

  // data subchunk
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);

  for (let i = 0; i < samples.length; i++) {
    // Clamp to 16-bit signed integer [-32768, 32767]
    const s = Math.max(-1, Math.min(1, samples[i]));
    const val = s < 0 ? s * 32768 : s * 32767;
    buffer.writeInt16LE(Math.floor(val), 44 + i * 2);
  }

  return buffer;
}

const SAMPLE_RATE = 44100;

// 1. Step Pop Sound (gamified high-tech UI checkmark pop: ~180ms)
function generateStepPop() {
  const duration = 0.18;
  const totalSamples = Math.floor(SAMPLE_RATE * duration);
  const samples = new Float32Array(totalSamples);

  for (let i = 0; i < totalSamples; i++) {
    const t = i / SAMPLE_RATE;
    const env = Math.exp(-t * 26); // fast exponential decay
    // Gentle frequency sweep from 580Hz down to 420Hz for a satisfying juicy pop
    const freq = 580 - t * 800;
    const wave1 = Math.sin(2 * Math.PI * freq * t);
    const wave2 = Math.sin(2 * Math.PI * freq * 2 * t) * 0.25;
    samples[i] = (wave1 + wave2) * env * 0.45;
  }
  return samples;
}

// 2. Gentle Soft Whoosh / Wind Shimmer Sweep (~3.4s)
function generateScanningRadar() {
  const duration = 3.4;
  const totalSamples = Math.floor(SAMPLE_RATE * duration);
  const samples = new Float32Array(totalSamples);

  // Filter state for a smooth 2-pole resonant low-pass filter
  let lp1 = 0;
  let lp2 = 0;
  let lp3 = 0;

  for (let i = 0; i < totalSamples; i++) {
    const t = i / SAMPLE_RATE;
    const progress = t / duration; // 0.0 to 1.0

    // Smooth breath / wind swell envelope: rises gently, sustains, and fades gracefully
    const swell = Math.sin(Math.PI * Math.pow(progress, 0.85));
    const masterEnv = Math.pow(swell, 1.4);

    // 1. Organic airy noise generator (uniform random with smoothing)
    const rawNoise = (Math.random() * 2 - 1);

    // Dynamic cutoff sweeps smoothly from ~220Hz up to ~950Hz then gently settles
    const cutoffHz = 220 + 750 * Math.sin(Math.PI * progress);
    const alpha = Math.min(1, (2 * Math.PI * cutoffHz) / SAMPLE_RATE);

    // 3-stage gentle low-pass smoothing for warm organic wind texture
    lp1 += alpha * (rawNoise - lp1);
    lp2 += alpha * (lp1 - lp2);
    lp3 += alpha * (lp2 - lp3);
    const windNoise = lp3 * 1.8;

    // 2. Delicate crystalline ambient shimmer (ethereal glass sine layers)
    const shimmerMod = Math.sin(2 * Math.PI * 3.5 * t) * 0.5 + 0.5;
    const shimmer1 = Math.sin(2 * Math.PI * 880 * t) * 0.025;
    const shimmer2 = Math.sin(2 * Math.PI * 1320 * t) * 0.018;
    const shimmer3 = Math.sin(2 * Math.PI * 1760 * t) * 0.012;
    const shimmerLayer = (shimmer1 + shimmer2 + shimmer3) * (0.4 + 0.6 * shimmerMod);

    // Combine wind whoosh + delicate shimmer with smooth master envelope
    samples[i] = (windNoise * 0.28 + shimmerLayer) * masterEnv * 0.65;
  }
  return samples;
}

// 3. Celebratory Analysis Complete Chime (~0.8s: C-E-G-C major chord)
function generateCompleteChime() {
  const duration = 0.85;
  const totalSamples = Math.floor(SAMPLE_RATE * duration);
  const samples = new Float32Array(totalSamples);

  // Frequencies for C5 (523.25), E5 (659.25), G5 (783.99), C6 (1046.50)
  const freqs = [523.25, 659.25, 783.99, 1046.50];

  for (let i = 0; i < totalSamples; i++) {
    const t = i / SAMPLE_RATE;
    let sum = 0;

    freqs.forEach((freq, idx) => {
      // Stagger each note slightly by 40ms for a sparkling arpeggio harp effect
      const noteDelay = idx * 0.045;
      if (t >= noteDelay) {
        const noteT = t - noteDelay;
        const env = Math.exp(-noteT * 5.5);
        const wave = Math.sin(2 * Math.PI * freq * noteT);
        const harmonic = Math.sin(2 * Math.PI * freq * 2 * noteT) * 0.2;
        sum += (wave + harmonic) * env * 0.22;
      }
    });

    samples[i] = sum * 0.6;
  }
  return samples;
}

// Write files
fs.writeFileSync(path.join(soundsDir, 'step_pop.wav'), createWavBuffer(generateStepPop()));
fs.writeFileSync(path.join(soundsDir, 'scanning_radar.wav'), createWavBuffer(generateScanningRadar()));
fs.writeFileSync(path.join(soundsDir, 'analysis_complete.wav'), createWavBuffer(generateCompleteChime()));

console.log('✅ Sound assets successfully generated in assets/sounds/:');
console.log(' - step_pop.wav');
console.log(' - scanning_radar.wav');
console.log(' - analysis_complete.wav');
