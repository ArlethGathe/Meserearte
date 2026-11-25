const relojMexico = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Mexico_City',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23'
})

export function obtenerProximosEventos(eventos, ahora = new Date()) {
  const partes = Object.fromEntries(relojMexico.formatToParts(ahora).map(({ type, value }) => [type, value]))
  // Comparamos fechas civiles de Ciudad de México en una escala común.
  const actual = Date.parse(`${partes.year}-${partes.month}-${partes.day}T${partes.hour}:${partes.minute}:${partes.second}Z`)

  return eventos
    .map((evento) => {
      const inicio = Date.parse(`${evento.fecha}T${evento.horaInicio}Z`)
      const finMismoDia = Date.parse(`${evento.fecha}T${evento.horaFin}Z`)
      const fin = finMismoDia < inicio ? finMismoDia + 86_400_000 : finMismoDia
      return { evento, inicio, fin }
    })
    .filter(({ inicio, fin }) => Number.isFinite(inicio) && fin > actual)
    .sort((a, b) => a.inicio - b.inicio)
    .map(({ evento }) => evento)
}
