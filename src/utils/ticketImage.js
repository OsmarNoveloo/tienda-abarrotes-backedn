const path = require('path')
const fs = require('fs')
const { Jimp } = require('jimp')

const LOGO_PATH = path.join(__dirname, '..', 'assets', 'logo.png')
const BLACK_THRESHOLD = 180

function logoExists() {
  return fs.existsSync(LOGO_PATH)
}

// Lee ancho/alto directo del chunk IHDR sin depender de una librería de imágenes.
function getPngDimensions(filePath) {
  const buf = Buffer.alloc(24)
  const fd = fs.openSync(filePath, 'r')
  try {
    fs.readSync(fd, buf, 0, 24, 0)
  } finally {
    fs.closeSync(fd)
  }
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) }
}

// Convierte el logo a un bitmap de 1 bit (blanco/negro) empacado para el
// comando ESC/POS de imagen raster: GS v 0.
async function buildLogoRaster(widthPx) {
  const img = await Jimp.read(LOGO_PATH)
  img.resize({ w: widthPx })
  img.greyscale()

  const height = img.bitmap.height
  const bytesPerLine = Math.ceil(widthPx / 8)
  const bitmap = Buffer.alloc(bytesPerLine * height, 0)

  img.scan(0, 0, widthPx, height, function (x, y, idx) {
    const gray = this.bitmap.data[idx]
    if (gray < BLACK_THRESHOLD) {
      const byteIndex = y * bytesPerLine + (x >> 3)
      const bitIndex = 7 - (x % 8)
      bitmap[byteIndex] |= 1 << bitIndex
    }
  })

  const xL = bytesPerLine & 0xff
  const xH = (bytesPerLine >> 8) & 0xff
  const yL = height & 0xff
  const yH = (height >> 8) & 0xff
  const header = Buffer.from([0x1d, 0x76, 0x30, 0x00, xL, xH, yL, yH])

  return Buffer.concat([header, bitmap])
}

module.exports = { LOGO_PATH, logoExists, getPngDimensions, buildLogoRaster }
