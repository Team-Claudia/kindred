// Draws the placeholder app icons (a white "K" on a dark tile, matching
// public/favicon.svg) as PNGs, with no dependencies. Run from web/:
//   node scripts/generate-icons.mjs
// Replace the output with the real brand icons later; keep the file names.
import { writeFileSync } from 'node:fs'
import { deflateSync } from 'node:zlib'

const BG = [0x17, 0x17, 0x17]
const FG = [0xfa, 0xfa, 0xfa]
const SAMPLES = 4 // supersampling per axis, for smooth edges

// The "K", in a 64-unit box like favicon.svg: a stem and two diagonal arms.
const STROKE = 6.4
const SEGMENTS = [
  [23, 18, 23, 46],
  [24, 34, 42, 18],
  [30, 29, 43, 46],
]

function distanceToSegment(px, py, [x1, y1, x2, y2]) {
  const dx = x2 - x1
  const dy = y2 - y1
  const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / (dx * dx + dy * dy)))
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy))
}

function insideRoundedRect(x, y, size, radius) {
  const cx = Math.min(Math.max(x, radius), size - radius)
  const cy = Math.min(Math.max(y, radius), size - radius)
  return Math.hypot(x - cx, y - cy) <= radius
}

// glyphScale shrinks the K towards the centre (maskable icons keep it inside
// the safe zone). cornerRadius is in 64-unit space; 0 gives a full square.
function draw(size, { glyphScale = 1, cornerRadius = 14 } = {}) {
  const pixels = Buffer.alloc(size * size * 4)
  const total = SAMPLES * SAMPLES
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let tile = 0
      let glyph = 0
      for (let sy = 0; sy < SAMPLES; sy++) {
        for (let sx = 0; sx < SAMPLES; sx++) {
          const u = ((x + (sx + 0.5) / SAMPLES) / size) * 64
          const v = ((y + (sy + 0.5) / SAMPLES) / size) * 64
          if (cornerRadius === 0 || insideRoundedRect(u, v, 64, cornerRadius)) tile++
          const gu = 32 + (u - 32) / glyphScale
          const gv = 32 + (v - 32) / glyphScale
          if (SEGMENTS.some((s) => distanceToSegment(gu, gv, s) <= STROKE / 2)) glyph++
        }
      }
      const g = glyph / total
      const i = (y * size + x) * 4
      for (let c = 0; c < 3; c++) pixels[i + c] = Math.round(BG[c] * (1 - g) + FG[c] * g)
      pixels[i + 3] = Math.round((tile / total) * 255)
    }
  }
  return encodePng(size, pixels)
}

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c >>> 0
})

function crc32(buffer) {
  let c = 0xffffffff
  for (const byte of buffer) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([length, body, crc])
}

function encodePng(size, rgba) {
  const header = Buffer.alloc(13)
  header.writeUInt32BE(size, 0)
  header.writeUInt32BE(size, 4)
  header[8] = 8 // bit depth
  header[9] = 6 // RGBA
  const stride = size * 4 + 1
  const rows = Buffer.alloc(size * stride)
  for (let y = 0; y < size; y++) {
    rows[y * stride] = 0 // no filter
    rgba.copy(rows, y * stride + 1, y * size * 4, (y + 1) * size * 4)
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(rows, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

const out = new URL('../public/', import.meta.url)
writeFileSync(new URL('pwa-192x192.png', out), draw(192))
writeFileSync(new URL('pwa-512x512.png', out), draw(512))
// Maskable: full-bleed tile, K inside the central 80% safe zone.
writeFileSync(
  new URL('maskable-icon-512x512.png', out),
  draw(512, { glyphScale: 0.8, cornerRadius: 0 }),
)
// iOS rounds the corners itself and shows transparency as black, so no corners.
writeFileSync(new URL('apple-touch-icon.png', out), draw(180, { cornerRadius: 0 }))
