// Bundles the compiled backend (dist/main.js, produced by `nest build`) and its pure-JS
// dependencies into one file, dist/main.bundle.js.
//
// Why: on the 2-vCPU VMs the backend boot spent ~90% of its time opening and compiling
// thousands of small files under node_modules. One pre-linked file loads much faster.
//
// The input is tsc output (decorator metadata already emitted), so esbuild's lack of
// emitDecoratorMetadata support does not matter. Native / data-file / optional packages stay
// external and are loaded from node_modules at runtime as before.
import { build } from 'esbuild';
import fs from 'node:fs';

// PM2's `startOrReload` keeps the script path of an already-running app, so pointing PM2 at
// a new file never took effect. Instead the bundle REPLACES dist/main.js; the original tsc
// entry is kept as dist/main.unbundled.js (it still imports ./app.module.js etc. from dist/).
// Re-running the script bundles from main.unbundled.js, so it is idempotent.
const ENTRY = fs.existsSync('dist/main.unbundled.js') ? 'dist/main.unbundled.js' : 'dist/main.js';
const TMP_OUT = 'dist/main.bundle.tmp.js';

const external = [
  // native add-ons and packages that read their own files at runtime
  'onnxruntime-node',
  'onnxruntime-web',
  '@discordjs/opus',
  '@piper-plus/g2p',
  // optional Nest integrations required lazily inside try/catch (not installed)
  '@nestjs/microservices',
  '@nestjs/microservices/*',
  '@nestjs/platform-socket.io',
  '@fastify/static',
  '@grpc/*',
  'class-transformer/storage',
  'cache-manager',
  'kafkajs',
  'mqtt',
  'nats',
  'ioredis',
  'amqplib',
  'amqp-connection-manager',
  // optional native speedups of ws
  'bufferutil',
  'utf-8-validate',
];

await build({
  entryPoints: [ENTRY],
  outfile: TMP_OUT,
  bundle: true,
  platform: 'node',
  target: 'node22',
  format: 'esm',
  external,
  keepNames: true, // Nest uses class names for providers / logging
  sourcemap: false,
  legalComments: 'none',
  logLevel: 'warning',
  // CommonJS dependencies inside an ESM bundle still call require()/__dirname
  banner: {
    js: [
      "import { createRequire as __cr } from 'node:module';",
      "import { fileURLToPath as __fu } from 'node:url';",
      "import { dirname as __dn } from 'node:path';",
      'const require = __cr(import.meta.url);',
      'const __filename = __fu(import.meta.url);',
      'const __dirname = __dn(__filename);',
    ].join('\n'),
  },
});
if (ENTRY === 'dist/main.js') fs.renameSync('dist/main.js', 'dist/main.unbundled.js');
fs.renameSync(TMP_OUT, 'dist/main.js');

// The Piper worker is loaded with new URL('./piper-inference.worker.js', import.meta.url).
// Inside the bundle import.meta.url is dist/main.js, so the worker must sit next to it.
// Without this copy PiperWorkerClient.isAvailable() was false and ONNX inference ran
// synchronously on the main event loop (seconds-long stalls for every TTS request).
// The worker only imports node builtins and onnxruntime-*, so a plain copy is enough.
const WORKER_SRC = 'dist/sessions/piper-inference.worker.js';
if (!fs.existsSync(WORKER_SRC)) {
  throw new Error(`${WORKER_SRC} missing: run nest build before bundling`);
}
fs.copyFileSync(WORKER_SRC, 'dist/piper-inference.worker.js');

// The audio-finalize worker imports ./audio-codec.js, so bundle it into one file that sits
// next to dist/main.js (it is resolved relative to import.meta.url like the Piper worker).
await build({
  entryPoints: ['dist/sessions/audio-finalize.worker.js'],
  outfile: 'dist/audio-finalize.worker.js',
  bundle: true,
  external: ['@discordjs/opus'], // native addon, loaded from node_modules
  platform: 'node',
  target: 'node22',
  format: 'esm',
  legalComments: 'none',
  logLevel: 'warning',
});
fs.rmSync('dist/main.bundle.js', { force: true });
console.log('Bundled into dist/main.js (original entry kept as dist/main.unbundled.js)');
