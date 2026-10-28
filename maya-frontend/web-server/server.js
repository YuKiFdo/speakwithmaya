const http = require('http');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const PORT = Number(process.env.PORT || process.env.PM2_SERVE_PORT || 8080);

const STATIC_ROOT = path.resolve(
  process.env.STATIC_ROOT ||
    process.env.PM2_SERVE_PATH ||
    (fs.existsSync(path.join(__dirname, 'index.html'))
      ? __dirname
      : path.join(__dirname, '..', 'dist'))
);

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.wav': 'audio/wav',
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg',
  '.m4a': 'audio/mp4',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.wasm': 'application/wasm',
};

// All extensions that benefit significantly from Brotli / Gzip compression
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

// Byte-bounded in-memory cache (128 MB) so large JS bundles, TTF fonts, and HTML never thrash
const MAX_CACHE_BYTES = 128 * 1024 * 1024;
let currentCacheBytes = 0;
const compressedCache = new Map();
const inflightCompressions = new Map();

function getCachedBuffer(key) {
  const entry = compressedCache.get(key);
  if (!entry) return null;
  // Refresh LRU order
  compressedCache.delete(key);
  compressedCache.set(key, entry);
  return entry;
}

function setCachedBuffer(key, buffer) {
  if (!buffer || buffer.length > MAX_CACHE_BYTES / 2) return;
  if (compressedCache.has(key)) {
    const prev = compressedCache.get(key);
    currentCacheBytes -= prev ? prev.length : 0;
    compressedCache.delete(key);
  }
  while (currentCacheBytes + buffer.length > MAX_CACHE_BYTES && compressedCache.size > 0) {
    const oldestKey = compressedCache.keys().next().value;
    if (!oldestKey) break;
    const oldestBuf = compressedCache.get(oldestKey);
    currentCacheBytes -= oldestBuf ? oldestBuf.length : 0;
    compressedCache.delete(oldestKey);
  }
  compressedCache.set(key, buffer);
  currentCacheBytes += buffer.length;
}

/**
 * RFC 9110 compliant Accept-Encoding parser.
 * Respects q=0 exclusions and selects the best supported encoding: br > gzip > deflate.
 */
function negotiateEncoding(acceptEncodingHeader) {
  if (!acceptEncodingHeader || typeof acceptEncodingHeader !== 'string') {
    return null;
  }

  const parsed = new Map();
  const parts = acceptEncodingHeader.toLowerCase().split(',');

  for (let i = 0; i < parts.length; i++) {
    const segments = parts[i].trim().split(';');
    const name = segments[0].trim();
    if (!name) continue;

    let q = 1.0;
    for (let j = 1; j < segments.length; j++) {
      const param = segments[j].trim();
      if (param.startsWith('q=')) {
        const val = parseFloat(param.slice(2));
        if (!Number.isNaN(val)) {
          q = val;
        }
      }
    }
    parsed.set(name, q);
  }

  const getQuality = (enc) => {
    if (parsed.has(enc)) return parsed.get(enc);
    if (parsed.has('*')) return parsed.get('*');
    return 0;
  };

  const candidates = [
    { enc: 'br', q: getQuality('br') },
    { enc: 'gzip', q: getQuality('gzip') || getQuality('x-gzip') },
    { enc: 'deflate', q: getQuality('deflate') },
  ].filter((c) => c.q > 0);

  if (candidates.length === 0) return null;

  // Sort by quality descending; ties preserve preference order (br > gzip > deflate)
  candidates.sort((a, b) => b.q - a.q);
  return candidates[0].enc;
}

/**
 * Resolve or compress buffer with in-memory LRU caching, disk sidecar lookup (.br / .gz),
 * and in-flight deduplication without unnecessary raw file disk reads.
 */
function resolveCompressedAsset(filePath, mtimeKey, encoding, rawDataOrNull, callback) {
  const cacheKey = `${filePath}:${mtimeKey}:${encoding}`;
  const cached = getCachedBuffer(cacheKey);
  if (cached) {
    return callback(null, cached);
  }

  // Deduplicate concurrent requests for the same asset
  if (inflightCompressions.has(cacheKey)) {
    inflightCompressions.get(cacheKey).push(callback);
    return;
  }

  inflightCompressions.set(cacheKey, [callback]);

  const finish = (err, result) => {
    if (!err && result) {
      setCachedBuffer(cacheKey, result);
    }
    const waiters = inflightCompressions.get(cacheKey) || [];
    inflightCompressions.delete(cacheKey);
    for (let i = 0; i < waiters.length; i++) {
      waiters[i](err, result);
    }
  };

  const compressRawBuffer = (rawData) => {
    if (encoding === 'br') {
      zlib.brotliCompress(
        rawData,
        {
          params: {
            [zlib.constants.BROTLI_PARAM_QUALITY]: 5,
            [zlib.constants.BROTLI_PARAM_SIZE_HINT]: rawData.length,
          },
        },
        finish
      );
    } else if (encoding === 'gzip') {
      zlib.gzip(rawData, { level: 6 }, finish);
    } else if (encoding === 'deflate') {
      zlib.deflate(rawData, { level: 6 }, finish);
    } else {
      finish(new Error(`Unsupported encoding: ${encoding}`), null);
    }
  };

  const loadRawAndCompress = () => {
    if (rawDataOrNull) {
      return compressRawBuffer(rawDataOrNull);
    }
    fs.readFile(filePath, (readErr, rawData) => {
      if (readErr || !rawData) {
        return finish(readErr || new Error('Failed to read file'), null);
      }
      compressRawBuffer(rawData);
    });
  };

  // Prefer build-time pre-compressed sidecar (.br or .gz) if present on disk
  if (encoding === 'br' || encoding === 'gzip') {
    const sidecarPath = filePath + (encoding === 'br' ? '.br' : '.gz');
    fs.readFile(sidecarPath, (scErr, sidecarData) => {
      if (!scErr && sidecarData && sidecarData.length > 0) {
        return finish(null, sidecarData);
      }
      loadRawAndCompress();
    });
    return;
  }

  loadRawAndCompress();
}

const server = http.createServer((req, res) => {
  const parsedUrl = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);

  let pathname;
  try {
    pathname = decodeURIComponent(parsedUrl.pathname);
  } catch {
    res.writeHead(400, {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-store',
    });
    return res.end('Bad Request');
  }

  // Strip trailing slashes (except root "/") so "/onboarding/call/" resolves cleanly
  if (pathname.length > 1) {
    pathname = pathname.replace(/\/+$/, '');
  }

  if (pathname === '/') {
    pathname = '/index.html';
  }

  const filePath = path.resolve(STATIC_ROOT, '.' + pathname);

  // Prevent directory traversal outside STATIC_ROOT or direct requests to .gz/.br sidecars
  if (
    (filePath !== STATIC_ROOT && !filePath.startsWith(STATIC_ROOT + path.sep)) ||
    pathname.endsWith('.gz') ||
    pathname.endsWith('.br')
  ) {
    res.writeHead(403, {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-store',
    });
    return res.end('Forbidden');
  }

  fs.stat(filePath, (err, stats) => {
    if (!err && stats.isFile()) {
      return serveFile(filePath, pathname, stats, req, res);
    }

    const ext = path.extname(pathname);
    if (ext && ext !== '.html') {
      // Never allow browsers or CDN edges to cache a 404 on static chunks/assets
      res.writeHead(404, {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
        'CDN-Cache-Control': 'no-store',
        'Cloudflare-CDN-Cache-Control': 'no-store',
      });
      return res.end(`File not found: ${pathname}`);
    }

    const htmlPath = filePath + '.html';
    fs.stat(htmlPath, (htmlErr, htmlStats) => {
      if (!htmlErr && htmlStats.isFile()) {
        return serveFile(htmlPath, pathname, htmlStats, req, res);
      }

      const indexPath = path.join(filePath, 'index.html');
      fs.stat(indexPath, (indexErr, indexStats) => {
        if (!indexErr && indexStats.isFile()) {
          return serveFile(indexPath, pathname, indexStats, req, res);
        }

        const fallbackPath = path.join(STATIC_ROOT, 'index.html');
        fs.stat(fallbackPath, (fbErr, fbStats) => {
          if (fbErr || !fbStats || !fbStats.isFile()) {
            res.writeHead(404, {
              'Content-Type': 'text/plain; charset=utf-8',
              'Cache-Control': 'no-store',
            });
            return res.end('Not Found');
          }
          return serveFile(fallbackPath, '/index.html', fbStats, req, res);
        });
      });
    });
  });
});

function serveFile(filePath, requestPath, stats, req, res) {
  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';
  const isImmutableAsset =
    requestPath.startsWith('/_expo/') || requestPath.startsWith('/assets/');

  const mtimeKey = stats && stats.mtimeMs ? Math.floor(stats.mtimeMs) : 0;
  const fileSize = stats && typeof stats.size === 'number' ? stats.size : 0;
  const shouldCompress = COMPRESSIBLE_EXTS.has(ext) && fileSize > 512;
  const rangeHeader = req.headers['range'];

  // Do not apply content-encoding compression if client explicitly requests a byte Range (e.g. Safari/iOS audio)
  const negotiatedEncoding =
    shouldCompress && !rangeHeader
      ? negotiateEncoding(req.headers['accept-encoding'])
      : null;

  const etag = `W/"${fileSize.toString(16)}-${mtimeKey.toString(16)}-${negotiatedEncoding || 'identity'}"`;
  const lastModified = stats && stats.mtime ? stats.mtime.toUTCString() : undefined;

  const headers = {
    'Content-Type': contentType,
    'Access-Control-Allow-Origin': '*',
    'X-Content-Type-Options': 'nosniff',
    'Accept-Ranges': 'bytes',
    Vary: 'Accept-Encoding',
    ETag: etag,
  };

  if (lastModified) {
    headers['Last-Modified'] = lastModified;
  }

  if (ext === '.html') {
    headers['Cache-Control'] =
      'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0';
    headers['CDN-Cache-Control'] = 'no-store';
    headers['Cloudflare-CDN-Cache-Control'] = 'no-store';
    headers['Pragma'] = 'no-cache';
    headers['Expires'] = '0';
  } else if (isImmutableAsset) {
    headers['Cache-Control'] = 'public, max-age=31536000, immutable';
  } else {
    headers['Cache-Control'] = 'public, max-age=3600, must-revalidate';
  }

  // Handle conditional ETag (304 Not Modified) for non-HTML assets
  const ifNoneMatch = req.headers['if-none-match'];
  if (ext !== '.html' && ifNoneMatch && ifNoneMatch === etag) {
    res.writeHead(304, headers);
    return res.end();
  }

  // Zero-disk-I/O fast path when compressed buffer is cached or has a pre-compressed sidecar
  if (negotiatedEncoding && !rangeHeader) {
    return resolveCompressedAsset(
      filePath,
      mtimeKey,
      negotiatedEncoding,
      null,
      (compErr, compressed) => {
        if (!compErr && compressed) {
          headers['Content-Encoding'] = negotiatedEncoding;
          headers['Content-Length'] = compressed.length;
          res.writeHead(200, headers);
          return req.method === 'HEAD' ? res.end() : res.end(compressed);
        }
        // Fallback to raw file if compression failed
        fs.readFile(filePath, (readErr, rawData) => {
          if (readErr || !rawData) {
            res.writeHead(500, {
              'Content-Type': 'text/plain; charset=utf-8',
              'Cache-Control': 'no-store',
            });
            return res.end('Internal Server Error');
          }
          headers['Content-Length'] = rawData.length;
          res.writeHead(200, headers);
          return req.method === 'HEAD' ? res.end() : res.end(rawData);
        });
      }
    );
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(500, {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-store',
      });
      return res.end('Internal Server Error');
    }

    // Handle HTTP Byte-Range requests (206 Partial Content) for audio/media streaming
    if (rangeHeader && typeof rangeHeader === 'string' && rangeHeader.startsWith('bytes=')) {
      const total = data.length;
      const rangeParts = rangeHeader.replace(/bytes=/, '').split('-');
      const start = parseInt(rangeParts[0], 10);
      const end = rangeParts[1] ? parseInt(rangeParts[1], 10) : total - 1;

      if (!Number.isNaN(start) && !Number.isNaN(end) && start >= 0 && start <= end && end < total) {
        const chunk = data.subarray(start, end + 1);
        headers['Content-Range'] = `bytes ${start}-${end}/${total}`;
        headers['Content-Length'] = chunk.length;
        res.writeHead(206, headers);
        return req.method === 'HEAD' ? res.end() : res.end(chunk);
      } else {
        res.writeHead(416, {
          'Content-Range': `bytes */${total}`,
          'Cache-Control': 'no-store',
        });
        return res.end();
      }
    }

    headers['Content-Length'] = data.length;
    res.writeHead(200, headers);
    if (req.method === 'HEAD') {
      return res.end();
    }
    res.end(data);
  });
}

/**
 * Proactively pre-loads/pre-compresses critical boot assets (JS bundles, TTF/OTF fonts, CSS, and HTML shells)
 * into memory on server startup so the very first user after a deploy receives instant Gzip/Brotli.
 */
function prewarmCriticalAssets(dir) {
  fs.readdir(dir, { withFileTypes: true }, (err, entries) => {
    if (err || !entries) return;
    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        prewarmCriticalAssets(fullPath);
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase();
        if (ext === '.js' || ext === '.mjs' || ext === '.css' || ext === '.ttf' || ext === '.otf' || ext === '.html') {
          fs.stat(fullPath, (stErr, stats) => {
            if (stErr || !stats || stats.size <= 512) return;
            const mtimeKey = stats.mtimeMs ? Math.floor(stats.mtimeMs) : 0;
            resolveCompressedAsset(fullPath, mtimeKey, 'gzip', null, () => {});
            resolveCompressedAsset(fullPath, mtimeKey, 'br', null, () => {});
          });
        }
      }
    }
  });
}

server.listen(PORT, '0.0.0.0', () => {
  console.log(`[Maya Web] Server running on port ${PORT} serving ${STATIC_ROOT}`);
  prewarmCriticalAssets(STATIC_ROOT);
});
