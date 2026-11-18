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

const external = [
  // native add-ons and packages that read their own files at runtime
  'onnxruntime-node',
  'onnxruntime-web',
  'opusscript',
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
  entryPoints: ['dist/main.js'],
  outfile: 'dist/main.bundle.js',
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
console.log('Bundled dist/main.bundle.js');
