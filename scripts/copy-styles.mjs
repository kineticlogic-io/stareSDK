// copy-styles.mjs — copies src/styles/global.css to dist/styles.css after the tsc build step.
//
// Uses Node's fs APIs rather than a shell `cp` because the build must be OS-neutral (OpenStare's
// Hardware neutrality HARD RULE covers Windows hosts too — no shell-specific build steps).
import { mkdirSync, copyFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const projectRoot = join(__dirname, '..')

const sourcePath = join(projectRoot, 'src', 'styles', 'global.css')
const destDir = join(projectRoot, 'dist')
const destPath = join(destDir, 'styles.css')

mkdirSync(destDir, { recursive: true })
copyFileSync(sourcePath, destPath)

console.log(`@kineticlogic/staresdk: copied ${sourcePath} -> ${destPath}`)
