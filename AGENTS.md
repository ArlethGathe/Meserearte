# MesereArte — instrucciones para Codex

## Propósito y alcance
MesereArte es una aplicación web académica para gestionar equipos de meseros en eventos sociales: salas de trabajo, cuentas, eventos, asignaciones, confirmaciones, notificaciones, asistencia, reportes e historial. Antes de modificar un módulo, inspecciona el código actual y sus dependencias; el comportamiento del repositorio prevalece sobre cualquier descripción histórica. No inventes funciones implementadas.

## Tecnologías y estructura verificadas mediante revisión estática (19 de noviembre de 2026)
- Cliente: React 19, Vite 8, JavaScript/JSX, CSS; `client/src/App.jsx`, `client/src/context/MesereArteContexto.jsx`, `client/src/pages/`.
- Servidor: Node.js, Express 5, `server/src/index.js`, `server/src/db.js`, PostgreSQL con `pg` y SQL directo.
- API local actualmente fijada a `http://localhost:3001/api` en cliente: no asumir configuración correcta de producción.
- Geoapify: autocompletado de ubicación; enlaces a Google Maps, no integración directa de Google Maps API.
- Tablas referidas por el código: `usuarios`, `salas`, `meseros`, `eventos`, `asignaciones`, `disponibilidades`, `notificaciones`, `asistencias`, `reportes`, `evaluaciones_meseros`. No hay DDL/migraciones suficientes en el repositorio inspeccionado; confirmar el esquema real antes de cambiar SQL.

## Roles y autorización esperada
- Dos tipos generales de cuenta: administrador y mesero. **Capitán no es una tercera cuenta permanente**: es un mesero designado para un evento concreto.
- La designación habilita solo para ese evento consulta del personal y teléfonos, notificaciones, asistencia y reportes.
- Al perder la designación o responder `No disponible`, se revocan esos privilegios para el evento, no su cuenta de mesero.
- La autorización debe validarse **en el servidor por usuario autenticado y evento**, nunca fiándose solo de botones ocultos, IDs enviados por cliente, rol elegido en un formulario o inferencias del evento.
- Impedir consultas y operaciones entre salas ajenas; aplicar filtros de alcance también a reportes, notificaciones, historial y endpoints GET.

## Reglas de negocio actualmente detectadas en código
- Registro de administrador crea una cuenta y sala con código; registro de mesero requiere código de sala activa. Verificar consistencia del teléfono (frontend exige 10 dígitos; servidor acepta al menos 10).
- Puede crearse un evento sin meseros. La API rechaza otro evento con mismo lugar y fecha. Horarios de inicio y fin deben ser distintos; fin anterior a inicio puede significar madrugada del día siguiente.
- Las asignaciones de personal requieren **un capitán** que pertenezca al equipo. Meseros activos y de la misma sala, sin traslapes horarios. Nuevas asignaciones quedan `Pendiente`.
- La respuesta de participación se da **después** de asignar: `Confirmado` o `No disponible`. Repetir la misma devuelve el registro previo; cambiar una respuesta devuelve `409`. `No disponible` genera aviso al administrador y si es capitán requiere reemplazo.
- Avisos se guardan por destinatario y pueden marcarse como leídos. Evitar duplicados de destinatarios.
- Asistencia: únicamente el día del evento según `America/Mexico_City`, para personal asignado que confirmó. Estados del código: `Presente`, `Retardo`, `Ausente` (no sustituir silenciosamente por otros valores de documento).
- Reportes: uno por evento desde el día del evento, requieren capitán; estados `Borrador` y `Enviado`, este último no editable. Para enviar se exigen evaluaciones de 1 a 5 (desempeño, puntualidad, actitud) de cada mesero `Presente`, salvo el capitán. El código actual no exige esas evaluaciones para `Retardo`; tratarlo como tema por validar, no regla definitiva.

## Riesgos detectados: corregir antes de afirmar cumplimiento de RNF03
- El diagnóstico estático identificó comparación directa de contraseña en SQL y ausencia de middleware de sesión/token en Express. **No afirmar** que hay hashing seguro, autenticación robusta o autorización por evento verificadas.
- `GET /api/reportes` aparentemente ignora `salaId` aunque el cliente lo envía; analizar fuga de información entre salas.
- En asistencia se puede proporcionar el ID de capitán o inferirlo: verificar vinculación con la identidad autenticada; nunca autorizar por ID arbitrario.
- No imprimir secretos de `.env`, contraseñas, tokens ni credenciales al responder. No introducir datos reales en pruebas.

## Forma de trabajar
1. Antes de escribir, resume: archivos a modificar, comportamiento observado, propuesta y pruebas.
2. Haz un cambio pequeño por tarea; evita reescribir masivamente `server/src/index.js` o alterar contratos API sin necesidad.
3. No modifiques migraciones/esquema SQL basándote solo en nombres inferidos: primero consulta DDL o confirma la base de prueba.
4. Protege información existente: nada de DELETE masivo, reiniciar bases, limpiar registros ni ejecutar scripts destructivos sin autorización expresa.
5. Para cada cambio ejecuta pruebas viables, lint o comprobaciones de compilación y reporta cuáles realmente corriste. La revisión estática no equivale a prueba funcional.
6. Conserva textos de interfaz en español, sin cambiar identificadores o estados almacenados sin revisar frontend, backend y base.
7. Documenta cualquier divergencia entre **requisito deseado**, **código actual** y **comportamiento verificado**.
8. Evita tocar el documento Word del Trabajo Terminal por cambios de código; entrega un resumen de impacto documental para actualizarlo por separado.
9. Usa Git, cambios revisables y commits descriptivos. No subas secretos ni `.env`.

## Primera tarea sugerida
Realiza una auditoría de seguridad **sin modificar archivos**: autenticación de usuario, almacenamiento de contraseñas, autorización por rol/evento/sala, y control de acceso a `/api/reportes`, `/api/asistencias`, `/api/notificaciones` y `/api/meseros/:id/historial`. Da evidencias concretas con rutas y líneas, severidad, posibles efectos y plan de reparación por prioridad. Luego espera autorización antes de implementar.
