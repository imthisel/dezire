import { execSync } from 'node:child_process'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

/**
 * Which version of the app this is: the commit it was built from (Cloudflare's builds give it on every deploy), so each push is a new
 * version. Written into the app and into /version.json, which the app checks to offer the update (see src/appUpdate.ts).
 */
function commit() {
  // Only a real commit id counts: a branch name such as "main" would be the same on every build, and the app would never
  // see a new version. Failing both, the build time, which is different every time.
  const sha = (v: string | undefined) => (v && /^[0-9a-f]{7,40}$/i.test(v.trim()) ? v.trim().slice(0, 7).toLowerCase() : null)
  let git: string | undefined
  try {
    git = execSync('git rev-parse HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString()
  } catch {
    // not a git checkout
  }
  return sha(process.env.WORKERS_CI_COMMIT_SHA) ?? sha(git) ?? Date.now().toString(36)
}
const version = commit()
const builtAt = new Date().toISOString()

const versionFile = (): Plugin => ({
  name: 'version-file',
  apply: 'build',
  generateBundle() {
    this.emitFile({ type: 'asset', fileName: 'version.json', source: JSON.stringify({ version, builtAt }) })
  },
})

export default defineConfig(({ command }) => ({
  plugins: [react(), tailwindcss(), versionFile()],
  define: {
    __APP_VERSION__: JSON.stringify(command === 'build' ? version : 'dev'),
    __APP_BUILT__: JSON.stringify(builtAt),
  },
  // Always the same address: each address (localhost:5173, localhost:5174…) keeps its own sign-in,
  // so a different port would mean signing in again. If 5173 is taken, it says so instead of moving.
  server: { port: 5173, strictPort: true },
  preview: { port: 4173, strictPort: true },
}))
