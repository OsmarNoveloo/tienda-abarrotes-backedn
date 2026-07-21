const { logoExists } = require('./ticketImage')

const DEFAULT_WIDTH = 40

function money(n) {
  return `$${Number(n ?? 0).toFixed(2)}`
}

function formatFecha(iso) {
  if (!iso) return ''
  const [datePart, timePart] = String(iso).split('T')
  const [y, m, d] = (datePart ?? '').split('-')
  const time = (timePart ?? '').slice(0, 5)
  return `${d}/${m}/${y}${time ? ' ' + time : ''}`
}

function wrapText(str, width) {
  const words = String(str ?? '').split(' ')
  const lines = []
  let line = ''
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word
    if (candidate.length > width) {
      if (line) lines.push(line)
      line = word
    } else {
      line = candidate
    }
  }
  if (line) lines.push(line)
  return lines.length ? lines : ['']
}

function padLine(left, right, width) {
  const space = width - left.length - right.length
  if (space >= 1) return left + ' '.repeat(space) + right
  const trimmedLeft = left.slice(0, Math.max(0, width - right.length - 1))
  return `${trimmedLeft} ${right}`
}

// Modelo intermedio de líneas: una sola fuente de verdad que luego
// se renderiza tanto a ESC/POS (impresora térmica) como a PDF (previsualización).
function buildTicketLines(ticketData, width = DEFAULT_WIDTH) {
  const { venta, items, pagos, usuarioNombre, negocio } = ticketData
  const divider = '-'.repeat(width)
  const lines = []

  if (logoExists()) {
    lines.push({ type: 'image', align: 'center' })
  }

  lines.push({ text: negocio.nombre, align: 'center', bold: true })
  if (negocio.direccion) lines.push({ text: negocio.direccion, align: 'center' })
  if (negocio.telefono) lines.push({ text: `Tel: ${negocio.telefono}`, align: 'center' })
  if (negocio.rfc) lines.push({ text: `RFC: ${negocio.rfc}`, align: 'center' })
  lines.push({ text: divider, align: 'left' })

  lines.push({ text: `Folio: ${venta.folio ?? venta.id}`, align: 'left' })
  lines.push({ text: `Fecha: ${formatFecha(venta.fecha_venta)}`, align: 'left' })
  if (usuarioNombre) lines.push({ text: `Cajero: ${usuarioNombre}`, align: 'left' })
  lines.push({ text: divider, align: 'left' })

  for (const item of items) {
    wrapText(item.nombre, width).forEach((t) => lines.push({ text: t, align: 'left' }))
    const left = `${item.cantidad} x ${money(item.precio_unitario)}`
    const right = money(item.subtotal)
    lines.push({ text: padLine(left, right, width), align: 'left' })
  }

  lines.push({ text: divider, align: 'left' })
  lines.push({ text: padLine('TOTAL', money(venta.total), width), align: 'left', bold: true })

  if (pagos.length) {
    lines.push({ text: divider, align: 'left' })
    for (const p of pagos) {
      lines.push({ text: padLine(p.metodo ?? 'Pago', money(p.monto), width), align: 'left' })
    }
  }

  lines.push({ text: '', align: 'left' })
  lines.push({ text: negocio.mensajePie, align: 'center' })

  return lines
}

module.exports = { buildTicketLines, DEFAULT_WIDTH }
