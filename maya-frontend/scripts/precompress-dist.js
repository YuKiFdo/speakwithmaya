#!/usr/bin/env node
/**
 * Build-time static asset pre-compressor (.gz and .br sidecars).
 * Pre-compresses all compressible assets in dist/ using maximum Gzip (level 9)
 * and Brotli (quality 11) so both web-server/server.js and Nginx (gzip_static / brotli_static)
 * can serve pre-compressed payloads with zero runtime CPU latency.
 */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const DIST_DIR = path.resolve(__dirname, '..', 'dist');

const COMPRESSIBLE_EXTS = new Set([
  '.html',
  '.js',
  '.mjs',
  '.css',
  '.json',
  '.map',
  '.webmanifest',
  '.xml',
  '.txt',
  '.svg',
  '.ico',
  '.wasm',
  '.ttf',
  '.otf',
  '.wav',
]);

function collectFiles(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      collectFiles(fullPath, out);
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name).toLowerCase();
      if (COMPRESSIBLE_EXTS.has(ext)) {
        out.push(fullPath);
      }
    }
  }
  return out;
}

function main() {
  if (!fs.existsSync(DIST_DIR)) {
    console.log(`[precompress] Skipping: ${DIST_DIR} does not exist.`);
    return;
  }

  const files = collectFiles(DIST_DIR);
  let totalRawBytes = 0;
  let totalGzBytes = 0;
  let totalBrBytes = 0;
  let compressedCount = 0;

  for (const filePath of files) {
    const raw = fs.readFileSync(filePath);
    if (raw.length <= 512) continue;

    totalRawBytes += raw.length;

    const gz = zlib.gzipSync(raw, { level: 9 });
    if (gz.length < raw.length) {
      fs.writeFileSync(`${filePath}.gz`, gz);
      totalGzBytes += gz.length;
    } else {
      totalGzBytes += raw.length;
    }

    const br = zlib.brotliCompressSync(raw, {
      params: {
        [zlib.constants.BROTLI_PARAM_QUALITY]: 11,
        [zlib.constants.BROTLI_PARAM_SIZE_HINT]: raw.length,
      },
    });
    if (br.length < raw.length) {
      fs.writeFileSync(`${filePath}.br`, br);
      totalBrBytes += br.length;
    } else {
      totalBrBytes += raw.length;
    }

    compressedCount++;
  }

  const toMB = (bytes) => (bytes / (1024 * 1024)).toFixed(2);
  console.log(
    `[precompress] Pre-compressed ${compressedCount} files in dist/: Raw ${toMB(totalRawBytes)} MB -> Gzip ${toMB(totalGzBytes)} MB / Brotli ${toMB(totalBrBytes)} MB`
  );
}

main();
