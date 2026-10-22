import {
  createContext,
  useContext,
  useState
} from 'react'

const MesereArteContext = createContext(null)

export function MesereArteProvider({ children }) {

  const [salas, setSalas] = useState([
    {
      id: 1,
      nombre: 'Equipo MesereArte',
      descripcion: 'Equipo principal de meseros',
      codigo: 'MESA2026',
      administrador: 'Arleth Gathe',
      estado: 'Activa'
    },
    {
      id: 2,
      nombre: 'Salón El Triunfo',
      descripcion: 'Equipo de servicio del salón',
      codigo: 'MESA4X8P',
      administrador: 'Arleth Gathe',
      estado: 'Activa'
    }
  ])

  const [meseros, setMeseros] = useState([
    {
      id: 1,
      nombre: 'María',
      apellidos: 'López',
      correo: 'maria@meserearte.com',
      telefono: '5512345678',
      salaId: 1,
      eventosParticipados: 15,
      estado: 'Activo',
      disponibilidad: 'Disponible'
    },
    {
      id: 2,
      nombre: 'Juan',
      apellidos: 'Pérez',
      correo: 'juan@meserearte.com',
      telefono: '5587654321',
      salaId: 1,
      eventosParticipados: 8,
      estado: 'Activo',
      disponibilidad: 'Disponible'
    },
    {
      id: 3,
      nombre: 'Ana',
      apellidos: 'Torres',
      correo: 'ana@meserearte.com',
      telefono: '5566778899',
      salaId: 1,
      eventosParticipados: 11,
      estado: 'Activo',
      disponibilidad: 'Disponible'
    },
    {
      id: 4,
      nombre: 'Luis',
      apellidos: 'Gómez',
      correo: 'luis@meserearte.com',
      telefono: '5511223344',
      salaId: 2,
      eventosParticipados: 9,
      estado: 'Inactivo',
      disponibilidad: 'No disponible'
    }
  ])

  const [eventos, setEventos] = useState([
    {
      id: 1,
      salaId: 1,
      nombre: 'Boda Hernández & Ruiz',
      tipo: 'Boda',
      fecha: '2026-06-14',
      horario: '18:00',
      ubicacion: 'Jardín Los Encinos',
      invitados: 180,
      meserosRequeridos: 12,
      uniforme: 'Camisa blanca, pantalón negro',
      observaciones: 'Llegar una hora antes.',
      estado: 'Programado'
    },
    {
      id: 2,
      salaId: 1,
      nombre: 'XV años Valentina',
      tipo: 'XV años',
      fecha: '2026-06-21',
      horario: '17:00',
      ubicacion: 'Salón Imperial',
      invitados: 150,
      meserosRequeridos: 10,
      uniforme: 'Camisa negra y corbata vino',
      observaciones: '',
      estado: 'Pendiente'
    },
    {
      id: 3,
      salaId: 1,
      nombre: 'Graduación ESCOM',
      tipo: 'Graduación',
      fecha: '2026-06-28',
      horario: '19:00',
      ubicacion: 'Centro de Convenciones',
      invitados: 300,
      meserosRequeridos: 15,
      uniforme: 'Camisa blanca y corbata negra',
      observaciones: '',
      estado: 'Confirmado'
    }
  ])

  const [asignaciones, setAsignaciones] = useState([
    {
      id: 1,
      eventoId: 1,
      meseroId: 1,
      rol: 'Mesero'
    },
    {
      id: 2,
      eventoId: 1,
      meseroId: 2,
      rol: 'Capitán'
    },
    {
      id: 3,
      eventoId: 1,
      meseroId: 3,
      rol: 'Mesero'
    }
  ])

  return (
    <MesereArteContext.Provider
      value={{
        salas,
        setSalas,

        meseros,
        setMeseros,

        eventos,
        setEventos,

        asignaciones,
        setAsignaciones
      }}
    >
      {children}
    </MesereArteContext.Provider>
  )
}

export function useMesereArte() {
  const contexto = useContext(MesereArteContext)

  if (!contexto) {
    throw new Error(
      'useMesereArte debe utilizarse dentro de MesereArteProvider'
    )
  }

  return contexto
}