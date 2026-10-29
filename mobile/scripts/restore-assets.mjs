import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const mobileRoot = join(dirname(fileURLToPath(import.meta.url)), '..')
const manifest = JSON.parse(readFileSync(join(mobileRoot, 'scripts/assets.json'), 'utf8'))

for (const [relativePath, base64] of Object.entries(manifest)) {
  const outputPath = join(mobileRoot, relativePath)
  mkdirSync(dirname(outputPath), { recursive: true })
  writeFileSync(outputPath, Buffer.from(base64, 'base64'))
}
