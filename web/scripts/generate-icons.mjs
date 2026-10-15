// Draws the app icons (the Kindred mark from public/favicon.svg on a cream
// tile) as PNGs, with no dependencies. Run from web/ after changing the mark:
//   node scripts/generate-icons.mjs
import { readFileSync, writeFileSync } from 'node:fs'
import { deflateSync } from 'node:zlib'

const BG = [0xfb, 0xf8, 0xf1] // --background
const SAMPLES = 4 // supersampling per axis, for smooth edges
const CURVE_STEPS = 16 // line segments per Bézier curve

const out = new URL('../public/', import.meta.url)

// favicon.svg holds the mark as filled paths using only M, L, C and Z with
// absolute coordinates. Each becomes a polygon, painted in document order.
const svg = readFileSync(new URL('favicon.svg', out), 'utf8')
const [, , , viewWidth, viewHeight] = svg
  .match(/viewBox="([\d.]+) ([\d.]+) ([\d.]+) ([\d.]+)"/)
  .map(Number)
const SHAPES = [...svg.matchAll(/<path fill="#([0-9a-f]{6})" d="([^"]+)"/g)].map(([, hex, d]) => ({
  colour: [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16)),
  polygon: flatten(d),
}))

function flatten(d) {
  const points = []
  for (const [, command, args] of d.matchAll(/([MLCZ])([^MLCZ]*)/g)) {
    const n = args.trim() ? args.trim().split(/\s+/).map(Number) : []
    if (command === 'M' || command === 'L') points.push([n[0], n[1]])
    if (command === 'C') {
      const [x0, y0] = points.at(-1)
      for (let s = 1; s <= CURVE_STEPS; s++) {
        const t = s / CURVE_STEPS
        const a = (1 - t) ** 3,
          b = 3 * (1 - t) ** 2 * t,
          c = 3 * (1 - t) * t ** 2,
          e = t ** 3
        points.push([
          a * x0 + b * n[0] + c * n[2] + e * n[4],
          a * y0 + b * n[1] + c * n[3] + e * n[5],
        ])
      }
    }
  }
  return points
}

function insidePolygon(x, y, polygon) {
  let inside = false
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i]
    const [xj, yj] = polygon[j]
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside
  }
  return inside
}

function insideRoundedRect(x, y, size, radius) {
  const cx = Math.min(Math.max(x, radius), size - radius)
  const cy = Math.min(Math.max(y, radius), size - radius)
  return Math.hypot(x - cx, y - cy) <= radius
}

// markHeight is the mark's height as a share of the icon (maskable icons keep
// it inside the central safe zone). cornerRadius is in 64-unit space; 0 gives
// a full square.
function draw(size, { markHeight = 0.68, cornerRadius = 14 } = {}) {
  const pixels = Buffer.alloc(size * size * 4)
  const total = SAMPLES * SAMPLES
  const scale = (markHeight * size) / viewHeight
  const left = (size - viewWidth * scale) / 2
  const top = (size - viewHeight * scale) / 2
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let tile = 0
      const colour = [0, 0, 0]
      for (let sy = 0; sy < SAMPLES; sy++) {
        for (let sx = 0; sx < SAMPLES; sx++) {
          const px = x + (sx + 0.5) / SAMPLES
          const py = y + (sy + 0.5) / SAMPLES
          const [tu, tv] = [(px / size) * 64, (py / size) * 64]
          if (cornerRadius === 0 || insideRoundedRect(tu, tv, 64, cornerRadius)) tile++
          const u = (px - left) / scale
          const v = (py - top) / scale
          let sample = BG
          for (const shape of SHAPES) if (insidePolygon(u, v, shape.polygon)) sample = shape.colour
          for (let c = 0; c < 3; c++) colour[c] += sample[c]
        }
      }
      const i = (y * size + x) * 4
      for (let c = 0; c < 3; c++) pixels[i + c] = Math.round(colour[c] / total)
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

writeFileSync(new URL('pwa-192x192.png', out), draw(192))
writeFileSync(new URL('pwa-512x512.png', out), draw(512))
// Maskable: full-bleed tile, mark inside the central 80% safe zone.
writeFileSync(
  new URL('maskable-icon-512x512.png', out),
  draw(512, { markHeight: 0.56, cornerRadius: 0 }),
)
// iOS rounds the corners itself and shows transparency as black, so no corners.
writeFileSync(new URL('apple-touch-icon.png', out), draw(180, { cornerRadius: 0 }))
