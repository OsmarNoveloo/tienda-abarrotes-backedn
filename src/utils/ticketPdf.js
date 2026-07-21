const PDFDocument = require('pdfkit')
const { LOGO_PATH, getPngDimensions } = require('./ticketImage')

const FONT_SIZE = 9
const CHAR_WIDTH = FONT_SIZE * 0.6 // ancho aproximado de Courier por caracter
const LINE_HEIGHT = FONT_SIZE * 1.4
const MARGIN = 14
const LOGO_GAP = 8

function logoLayout(contentWidth) {
  const { width, height } = getPngDimensions(LOGO_PATH)
  const imgWidth = contentWidth * 0.6
  const imgHeight = imgWidth * (height / width)
  return { imgWidth, imgHeight }
}

// Usa Courier (monoespaciada) para que el ancho en caracteres coincida
// con el mismo modelo de líneas usado por el render ESC/POS.
function renderTicketPdf(lines, width) {
  const contentWidth = width * CHAR_WIDTH
  const pageWidth = MARGIN * 2 + contentWidth
  const { imgWidth, imgHeight } = lines.some((l) => l.type === 'image')
    ? logoLayout(contentWidth)
    : { imgWidth: 0, imgHeight: 0 }

  const textLineCount = lines.filter((l) => l.type !== 'image').length
  const imageLineCount = lines.length - textLineCount
  const pageHeight =
    MARGIN * 2 + textLineCount * LINE_HEIGHT + imageLineCount * (imgHeight + LOGO_GAP) + 10

  const doc = new PDFDocument({ size: [pageWidth, pageHeight], margin: MARGIN })

  let y = MARGIN
  for (const line of lines) {
    if (line.type === 'image') {
      const x = MARGIN + (contentWidth - imgWidth) / 2
      doc.image(LOGO_PATH, x, y, { width: imgWidth, height: imgHeight })
      y += imgHeight + LOGO_GAP
      continue
    }
    doc.font(line.bold ? 'Courier-Bold' : 'Courier').fontSize(FONT_SIZE)
    doc.text(line.text, MARGIN, y, { width: contentWidth, align: line.align ?? 'left' })
    y += LINE_HEIGHT
  }

  doc.end()
  return doc
}

module.exports = { renderTicketPdf }
