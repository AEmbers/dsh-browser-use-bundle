/**
 * Populate the vendored provider packages from npm.
 *
 * Why this exists: this bundle ships three pinned `@deepseek-ai` provider packages under `vendor/`.
 * They are published on npm by DeepSeek, so committing their contents here would be re-distribution
 * of somebody else's package. Instead the tree stays free of them and this script fetches the exact
 * published versions at install time.
 *
 * Why `prepare` and not `postinstall`: for a git dependency npm/pnpm run ONLY the `prepare`
 * lifecycle script — never `prepack`/`prepublishOnly`, and never a workspace build. `postinstall` is
 * additionally subject to pnpm's build-script allowlist, which is a second thing a caller would have
 * to configure. `prepare` runs for git installs and for local development.
 *
 * The three `file:./vendor/<dir>` dependencies in package.json cannot resolve until this has run, so
 * the pinned versions here MUST stay in step with those paths.
 */
import { execFileSync } from 'node:child_process'
import { cp, mkdtemp, readFile, readdir, rm } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

// This script lives in <package root>/scripts/, so the package root is one level up.
// `scripts` is not a package, so resolving from the script's own dir would put vendor content under
// scripts/vendor — which the `file:./vendor/<dir>` dependencies would never find.
const scriptDir = dirname(fileURLToPath(import.meta.url))
const root = dirname(scriptDir)
const vendorRoot = join(root, 'vendor')

/** Keep in step with the `file:./vendor/<dir>` dependency paths in package.json. */
const VENDORED = [
  { dir: 'browser-use', package: '@deepseek-ai/dsh-browser-use', version: '0.1.6-alpha.1' },
  { dir: 'browser-use-runtime', package: '@deepseek-ai/dsh-experimental-browser-use-runtime', version: '0.1.6-alpha.1' },
  { dir: 'browser-use-chrome-devtools-mcp', package: '@deepseek-ai/dsh-experimental-browser-use-chrome-devtools-mcp', version: '0.1.6-alpha.1' },
]

const forced = process.argv.includes('--force')
const isWindows = process.platform === 'win32'

/** Run a node_modules/.bin-free CLI without going through a shell (avoids unescaped-argument issues). */
function runCli(command, args) {
  if (isWindows) {
    // On Windows npm/tar are .cmd shims; resolve them through cmd.exe without shell arg concatenation.
    execFileSync(process.env.ComSpec ?? 'cmd.exe', ['/d', '/s', '/c', command, ...args], { stdio: 'inherit' })
  } else {
    execFileSync(command, args, { stdio: 'inherit' })
  }
}

async function alreadyPopulated(dir) {
  return existsSync(join(vendorRoot, dir, 'package.json'))
}

let fetched = 0
for (const entry of VENDORED) {
  if (!forced && (await alreadyPopulated(entry.dir))) {
    console.log(`prepare: vendor/${entry.dir} already present — skipping`)
    continue
  }

  const stage = await mkdtemp(join(tmpdir(), 'browser-use-vendor-'))
  try {
    const spec = `${entry.package}@${entry.version}`
    runCli('npm', ['pack', spec, '--pack-destination', stage, '--silent'])

    const tgz = (await readdir(stage)).find((f) => f.endsWith('.tgz'))
    if (!tgz) throw new Error(`prepare: npm pack produced no tarball for ${spec}`)

    runCli('tar', ['-xzf', join(stage, tgz), '-C', stage])

    const extracted = join(stage, 'package')
    if (!existsSync(join(extracted, 'package.json'))) {
      throw new Error(`prepare: tar did not produce ${extracted}/package.json`)
    }

    const manifest = JSON.parse(await readFile(join(extracted, 'package.json'), 'utf8'))
    if (manifest.version !== entry.version) {
      throw new Error(`prepare: ${manifest.name} resolved to ${manifest.version}, expected ${entry.version}`)
    }

    await rm(join(vendorRoot, entry.dir), { recursive: true, force: true })
    await cp(extracted, join(vendorRoot, entry.dir), { recursive: true })

    if (!(await alreadyPopulated(entry.dir))) {
      throw new Error(`prepare: copy to vendor/${entry.dir} did not land`)
    }

    fetched += 1
    console.log(`prepare: vendored ${manifest.name}@${manifest.version} -> vendor/${entry.dir}`)
  } finally {
    await rm(stage, { recursive: true, force: true })
  }
}

console.log(`prepare: ${fetched} of ${VENDORED.length} provider package(s) fetched from npm`)
for (const entry of VENDORED) {
  if (!(await alreadyPopulated(entry.dir))) {
    throw new Error(`prepare: vendor/${entry.dir} is missing after prepare`)
  }
}
