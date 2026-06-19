function getLocalISOString(date = new Date()) {
  const offset = date.getTimezoneOffset()
  const local = new Date(date.getTime() - offset * 60 * 1000)
  return local.toISOString().slice(0, -1)
}

module.exports = { getLocalISOString }
