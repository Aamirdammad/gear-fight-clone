import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { deflateSync } from 'node:zlib'
import { fileURLToPath } from 'node:url'

const mobileRoot = join(dirname(fileURLToPath(import.meta.url)), '..')

const crc32 = (buffer) => {
  let crc = ~0
  for (const byte of buffer) {
    crc ^= byte
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1))
  }
  return ~crc >>> 0
}

const chunk = (type, data) => {
  const typeBuffer = Buffer.from(type)
  const length = Buffer.alloc(4)
  const crc = Buffer.alloc(4)
  length.writeUInt32BE(data.length)
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])))
  return Buffer.concat([length, typeBuffer, data, crc])
}

const solidPng = (size, [red, green, blue]) => {
  const rowWidth = size * 4 + 1
  const raw = Buffer.alloc(rowWidth * size)
  for (let y = 0; y < size; y += 1) {
    const start = y * rowWidth
    for (let x = 0; x < size; x += 1) {
      const index = start + 1 + x * 4
      raw[index] = red
      raw[index + 1] = green
      raw[index + 2] = blue
      raw[index + 3] = 255
    }
  }
  const header = Buffer.alloc(13)
  header.writeUInt32BE(size, 0)
  header.writeUInt32BE(size, 4)
  header[8] = 8
  header[9] = 6
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

const assets = {
  'assets/icon.png': [1024, [255, 196, 64]],
  'assets/splash-icon.png': [512, [52, 191, 224]],
  'assets/favicon.png': [48, [255, 196, 64]],
  'assets/android-icon-foreground.png': [512, [255, 214, 86]],
  'assets/android-icon-background.png': [512, [22, 143, 229]],
  'assets/android-icon-monochrome.png': [512, [8, 20, 95]],
}

for (const [relativePath, [size, color]] of Object.entries(assets)) {
  const outputPath = join(mobileRoot, relativePath)
  mkdirSync(dirname(outputPath), { recursive: true })
  writeFileSync(outputPath, solidPng(size, color))
}
