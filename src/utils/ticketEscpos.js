const ESC = 0x1b
const GS = 0x1d

const ALIGN = { left: 0x00, center: 0x01, right: 0x02 }

function renderEscPos(lines) {
  const parts = [Buffer.from([ESC, 0x40])] // init

  let currentAlign = null
  let currentBold = false

  for (const line of lines) {
    const align = line.align ?? 'left'
    if (align !== currentAlign) {
      parts.push(Buffer.from([ESC, 0x61, ALIGN[align]]))
      currentAlign = align
    }
    const bold = !!line.bold
    if (bold !== currentBold) {
      parts.push(Buffer.from([ESC, 0x45, bold ? 1 : 0]))
      currentBold = bold
    }
    parts.push(Buffer.from(`${line.text}\n`, 'latin1'))
  }

  parts.push(Buffer.from('\n\n\n'))
  parts.push(Buffer.from([GS, 0x56, 0x00])) // corte total de papel

  return Buffer.concat(parts)
}

module.exports = { renderEscPos }
