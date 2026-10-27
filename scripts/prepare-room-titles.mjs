import { execFileSync } from 'node:child_process'
import { Buffer } from 'node:buffer'
import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath, URL } from 'node:url'
import { inflateSync } from 'node:zlib'
import process from 'node:process'

const directory = new URL('../src/assets/room-titles/', import.meta.url)
const manifest = JSON.parse(readFileSync(new URL('generation-manifest.json', directory), 'utf8'))
const alphaThreshold = 8
const padding = 4
// The night title has a long left lightning flourish before the first actual glyph.
const cropOverrides = {
  night: { left: 290, reason: 'Shorten the left ornamental lightning tail before 전교' },
}
const sha256 = (buffer) => createHash('sha256').update(buffer).digest('hex')

/** Read the existing non-interlaced RGBA PNG without changing its pixels. */
function titleBounds(png) {
  if (!png.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) {
    throw new Error('Expected a PNG title master')
  }
  const width = png.readUInt32BE(16)
  const height = png.readUInt32BE(20)
  if (png[24] !== 8 || png[25] !== 6 || png[28] !== 0) {
    throw new Error('Title masters must use non-interlaced 8-bit RGBA PNG')
  }
  const chunks = []
  for (let offset = 8; offset < png.length;) {
    const length = png.readUInt32BE(offset)
    if (png.toString('ascii', offset + 4, offset + 8) === 'IDAT') {
      chunks.push(png.subarray(offset + 8, offset + 8 + length))
    }
    offset += length + 12
  }
  const decoded = inflateSync(Buffer.concat(chunks))
  const stride = width * 4
  let previous = Buffer.alloc(stride)
  let left = width,
    top = height,
    right = -1,
    bottom = -1
  for (let y = 0; y < height; y++) {
    const filter = decoded[y * (stride + 1)]
    const row = Buffer.from(decoded.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1)))
    if (filter > 4) throw new Error(`Unsupported PNG row filter ${filter}`)
    for (let index = 0; index < stride; index++) {
      const a = index >= 4 ? row[index - 4] : 0
      const b = previous[index]
      const c = index >= 4 ? previous[index - 4] : 0
      let predictor = 0
      if (filter === 1) predictor = a
      else if (filter === 2) predictor = b
      else if (filter === 3) predictor = Math.floor((a + b) / 2)
      else if (filter === 4) {
        const p = a + b - c
        const pa = Math.abs(p - a),
          pb = Math.abs(p - b),
          pc = Math.abs(p - c)
        predictor = pa <= pb && pa <= pc ? a : pb <= pc ? b : c
      }
      row[index] = (row[index] + predictor) & 255
    }
    for (let x = 0; x < width; x++) {
      if (row[x * 4 + 3] < alphaThreshold) continue
      left = Math.min(left, x)
      right = Math.max(right, x)
      top = Math.min(top, y)
      bottom = Math.max(bottom, y)
    }
    previous = row
  }
  if (right < left) throw new Error('Title has no visible lettering')
  // cwebp uses even crop origins. Keep a small safe edge around faint brushwork.
  const x = Math.floor(Math.max(0, left - padding) / 2) * 2
  const y = Math.floor(Math.max(0, top - padding) / 2) * 2
  return {
    width,
    height,
    crop: {
      x,
      y,
      width: Math.min(width, right + padding + 1) - x,
      height: Math.min(height, bottom + padding + 1) - y,
    },
  }
}

const assets = manifest.assets.map((asset) => {
  const master = new URL(asset.master, directory)
  const png = readFileSync(master)
  if (sha256(png) !== asset.masterSha256) {
    throw new Error(`${asset.id}: master changed; update its generation manifest first`)
  }
  const { width, height, crop: alphaBoundsCrop } = titleBounds(png)
  const override = cropOverrides[asset.id]
  const crop = { ...alphaBoundsCrop }
  if (override) {
    const x = Math.floor(Math.max(crop.x, override.left) / 2) * 2
    crop.width -= x - crop.x
    crop.x = x
  }
  const output = asset.master.replace(/\.png$/, override ? '-compact-trimmed.webp' : '-trimmed.webp')
  const destination = new URL(output, directory)
  execFileSync('cwebp', [
    '-quiet',
    '-crop',
    String(crop.x),
    String(crop.y),
    String(crop.width),
    String(crop.height),
    '-q',
    '90',
    '-alpha_q',
    '100',
    '-m',
    '6',
    fileURLToPath(master),
    '-o',
    fileURLToPath(destination),
  ])
  const web = readFileSync(destination)
  return {
    id: asset.id,
    master: asset.master,
    sourceWeb: asset.web,
    output,
    sourceWidth: width,
    sourceHeight: height,
    crop,
    ...(override ? { decorationCrop: override, alphaBoundsCrop } : {}),
    removed: {
      left: crop.x,
      top: crop.y,
      right: width - crop.x - crop.width,
      bottom: height - crop.y - crop.height,
    },
    masterSha256: sha256(png),
    outputSha256: sha256(web),
    outputBytes: web.length,
  }
})
writeFileSync(
  new URL('crop-manifest.json', directory),
  JSON.stringify(
    {
      method: 'Alpha bounds, deterministic crop; no regeneration or aspect-ratio distortion',
      alphaThreshold,
      padding,
      assets,
    },
    null,
    2,
  ) + '\n',
)
for (const asset of assets) {
  process.stdout.write(
    `${asset.id}: ${asset.sourceWidth}×${asset.sourceHeight} → ${asset.crop.width}×${asset.crop.height}\n`,
  )
}
