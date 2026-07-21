const PDFDocument = require('pdfkit')

const FONT_SIZE = 9
const CHAR_WIDTH = FONT_SIZE * 0.6 // ancho aproximado de Courier por caracter
const LINE_HEIGHT = FONT_SIZE * 1.4
const MARGIN = 14

// Usa Courier (monoespaciada) para que el ancho en caracteres coincida
// con el mismo modelo de líneas usado por el render ESC/POS.
function renderTicketPdf(lines, width) {
  const contentWidth = width * CHAR_WIDTH
  const pageWidth = MARGIN * 2 + contentWidth
  const pageHeight = MARGIN * 2 + lines.length * LINE_HEIGHT + 10

  const doc = new PDFDocument({ size: [pageWidth, pageHeight], margin: MARGIN })

  let y = MARGIN
  for (const line of lines) {
    doc.font(line.bold ? 'Courier-Bold' : 'Courier').fontSize(FONT_SIZE)
    doc.text(line.text, MARGIN, y, { width: contentWidth, align: line.align ?? 'left' })
    y += LINE_HEIGHT
  }

  doc.end()
  return doc
}

module.exports = { renderTicketPdf }
