// Builds a minimal node_modules for the production image: ONLY the packages the bundled app
// loads at runtime (the `external` list in scripts/bundle.mjs that is installed) plus their own
// dependencies. Everything else is already inside dist/main.js, so shipping the full
// node_modules (~1 GB) only made the image huge and slow to unpack on the CPU-starved VPS.
//
// Also:
//  - onnxruntime-web is skipped: it is only a fallback when the native onnxruntime-node fails,
//    which never happens on the Linux x64 server (verified in production logs).
//  - onnxruntime-node keeps only the linux/x64 binaries (darwin / win32 / linux-arm64 removed).
//
// Usage (Dockerfile): node scripts/runtime-deps.mjs /runtime   -> /runtime/node_modules/...
import fs from 'node:fs';
import path from 'node:path';

const OUT = path.resolve(process.argv[2] || 'runtime');
const ROOT = process.cwd();
const SKIP = new Set(['onnxruntime-web']);
// Packages Nest loads BY NAME at runtime (loadPackage / require(name)), invisible to esbuild,
// so they are not in the external list but must still be installed. Found by booting the image.
const RUNTIME_LOADED = ['ws'];

// The external list is the single source of truth: read it from bundle.mjs
const bundleSrc = fs.readFileSync(path.join(ROOT, 'scripts/bundle.mjs'), 'utf8');
const listSrc = bundleSrc.match(/const external = \[([\s\S]*?)\];/);
if (!listSrc) throw new Error('Could not find `const external = [...]` in scripts/bundle.mjs');
const externals = [...listSrc[1].matchAll(/'([^']+)'/g)]
  .map((m) => m[1])
  .filter((name) => !name.endsWith('/*'))
  .map((name) => (name.startsWith('@') ? name.split('/').slice(0, 2).join('/') : name.split('/')[0]));

/** Node-style lookup of `name` starting at `fromDir` (walks up through node_modules folders). */
function locate(name, fromDir) {
  let dir = fromDir;
  for (;;) {
    const candidate = path.join(dir, 'node_modules', name);
    if (fs.existsSync(path.join(candidate, 'package.json'))) return candidate;
    const parent = path.dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

const copied = new Set();
let bytes = 0;

function copyPackage(pkgDir) {
  if (copied.has(pkgDir)) return;
  copied.add(pkgDir);
  const rel = path.relative(ROOT, pkgDir);
  const dest = path.join(OUT, rel);
  fs.cpSync(pkgDir, dest, {
    recursive: true,
    dereference: true,
    // nested node_modules are copied separately when they are real dependencies
    filter: (src) => {
      const inner = path.relative(pkgDir, src);
      return !inner.split(path.sep).includes('node_modules');
    },
  });

  const pkg = JSON.parse(fs.readFileSync(path.join(pkgDir, 'package.json'), 'utf8'));
  const deps = { ...(pkg.dependencies || {}), ...(pkg.optionalDependencies || {}) };
  for (const dep of Object.keys(deps)) {
    const found = locate(dep, pkgDir);
    if (found) copyPackage(found);
    else if (!(pkg.optionalDependencies || {})[dep]) console.warn(`  ! ${pkg.name}: dependency ${dep} not installed`);
  }
}

for (const name of new Set([...externals, ...RUNTIME_LOADED])) {
  if (SKIP.has(name)) continue;
  const found = locate(name, ROOT);
  if (!found) continue; // optional integration that is not installed (expected)
  copyPackage(found);
}

// onnxruntime-node: keep only the binaries this server can load
const ortBin = path.join(OUT, 'node_modules/onnxruntime-node/bin');
if (fs.existsSync(ortBin)) {
  for (const napi of fs.readdirSync(ortBin)) {
    for (const platform of fs.readdirSync(path.join(ortBin, napi))) {
      const platformDir = path.join(ortBin, napi, platform);
      if (platform !== 'linux') {
        fs.rmSync(platformDir, { recursive: true, force: true });
        continue;
      }
      for (const arch of fs.readdirSync(platformDir)) {
        if (arch !== 'x64') fs.rmSync(path.join(platformDir, arch), { recursive: true, force: true });
      }
    }
  }
}

function sizeOf(dir) {
  let total = 0;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    total += entry.isDirectory() ? sizeOf(p) : fs.statSync(p).size;
  }
  return total;
}
bytes = fs.existsSync(path.join(OUT, 'node_modules')) ? sizeOf(path.join(OUT, 'node_modules')) : 0;
console.log(`runtime node_modules: ${copied.size} packages, ${(bytes / 1024 / 1024).toFixed(1)} MB`);
for (const p of [...copied].sort()) console.log('  ' + path.relative(ROOT, p));
