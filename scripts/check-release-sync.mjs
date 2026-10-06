// Checks that npm and GitHub agree on every release of this package:
//
//   - every version on npm has a published GitHub release `v<version>`, and its tag points at the
//     commit npm recorded as the version's `gitHead` (the commit the tarball was built from);
//   - every published (non-draft) GitHub release `v<version>` is on npm.
//
//   node scripts/check-release-sync.mjs
//
// Needs `npm` and an authenticated `gh` (GH_TOKEN in CI), run from a clone with tags fetched.
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

// Published before releases went through the publish workflow: no gitHead, no release.
const IGNORED = new Set(['0.0.0-stage'])

const run = (cmd, args) => execFileSync(cmd, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim()
const { name } = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))

const npmVersions = JSON.parse(run('npm', ['view', name, 'versions', '--json', '--prefer-online']))
const releases = JSON.parse(run('gh', ['release', 'list', '--limit', '200', '--json', 'tagName,isDraft']))
  .filter(r => !r.isDraft)
  .map(r => r.tagName)

function tagCommit(tag) {
  try {
    return run('git', ['rev-parse', `${tag}^{commit}`])
  } catch {
    return null
  }
}

const problems = []
for (const version of npmVersions) {
  if (IGNORED.has(version)) continue
  const tag = `v${version}`
  const gitHead = run('npm', ['view', `${name}@${version}`, 'gitHead', '--prefer-online'])
  if (!releases.includes(tag)) {
    problems.push(`npm ${version} has no GitHub release ${tag} (built from ${gitHead || 'an unknown commit'})`)
    continue
  }
  const commit = tagCommit(tag)
  if (!commit) problems.push(`release ${tag} exists but its tag is not in this clone (fetch tags)`)
  else if (gitHead && commit !== gitHead) problems.push(`release ${tag} points at ${commit}, but npm ${version} was built from ${gitHead}`)
  else console.log(`ok  ${version}  ${commit}`)
}
for (const tag of releases) {
  const version = tag.replace(/^v/, '')
  if (!npmVersions.includes(version)) problems.push(`GitHub release ${tag} is not on npm`)
}

if (problems.length) {
  for (const p of problems) console.error(`::error::${p}`)
  process.exit(1)
}
console.log(`npm and GitHub releases agree for ${name}.`)
