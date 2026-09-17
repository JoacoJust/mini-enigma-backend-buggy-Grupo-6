# TaskFlow API

API backend para gestion de tareas por usuario. Construida con **Node.js**,
**Express** y **MongoDB** (via Mongoose). Expone unicamente endpoints JSON:
no sirve vistas ni archivos estaticos.

## Stack

- Node.js (CommonJS)
- Express 4
- MongoDB + Mongoose 8
- Autenticacion con JSON Web Tokens (jsonwebtoken)
- Hash de contraseñas con bcryptjs

## Requisitos previos

- Node.js 18+
- Una instancia de MongoDB accesible (local o Atlas)

## Instalacion

```bash
npm install
cp .env.ejemplo .env
# completar los valores de .env (ver seccion Variables de entorno)
```

## Variables de entorno

Ver `.env.ejemplo` para el detalle completo. Las variables son:

| Variable       | Descripcion                                              |
|----------------|-----------------------------------------------------------|
| `PORT`         | Puerto HTTP del servidor                                  |
| `MONGO_URI`    | Cadena de conexion a MongoDB                               |
| `JWT_SECRET`   | Secreto para firmar/verificar los tokens JWT               |
| `JWT_EXPIRES_IN` | Tiempo de expiracion de los tokens (ej: `7d`, `1h`)      |
| `NODE_ENV`     | `development` / `production` / `test`                      |
| `CORS_ORIGIN`  | Origen permitido para llamadas desde el front-end           |

## Poblar la base de datos con datos de testing

```bash
npm run seed
```

Esto crea 3 usuarios de prueba (1 admin, 2 usuarios comunes) y 5 tareas de
ejemplo distribuidas entre ellos. La contraseña de todos los usuarios de
prueba es `123456`. El script imprime en consola los emails generados.

## Levantar el servidor

```bash
npm start
# o en modo desarrollo (reinicia al detectar cambios):
npm run dev
```

El servidor queda disponible en `http://localhost:<PORT>`.

## Endpoints

### Salud

- `GET /health` — chequeo simple de disponibilidad del servicio.

### Autenticacion (`/api/auth`)

| Metodo | Ruta        | Auth | Descripcion                                  |
|--------|-------------|------|-----------------------------------------------|
| POST   | `/register` | No   | Crea un usuario nuevo. Body: `nombre`, `email`, `password`, `rol` (opcional). Devuelve el usuario creado + token. |
| POST   | `/login`    | No   | Inicia sesion. Body: `email`, `password`. Devuelve el usuario + token. |
| GET    | `/me`       | Si   | Devuelve los datos del usuario autenticado.   |

Para las rutas protegidas, enviar el header:

```
Authorization: Bearer <token>
```

### Tareas (`/api/tasks`) — todas requieren autenticacion

| Metodo | Ruta          | Descripcion                                        |
|--------|---------------|-----------------------------------------------------|
| POST   | `/`           | Crea una tarea para el usuario autenticado.          |
| GET    | `/`           | Lista las tareas del usuario. Soporta `?page=&limit=&sortBy=`. |
| GET    | `/overdue`    | Lista las tareas vencidas (no completadas) del usuario. |
| GET    | `/:id`        | Obtiene el detalle de una tarea.                     |
| PUT    | `/:id`        | Actualiza una tarea existente.                       |
| DELETE | `/:id`        | Elimina una tarea.                                   |

Campos de una tarea: `titulo` (obligatorio), `descripcion`, `estado`
(`pendiente` | `en_progreso` | `completada`), `prioridad`
(`baja` | `media` | `alta`), `fechaVencimiento` (fecha ISO opcional).

## Ejemplo de flujo completo

```bash
# 1. Registrarse
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"nombre":"Juan","email":"juan@test.com","password":"secreto123"}'

# 2. Loguearse (o usar el token que devuelve el registro)
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"juan@test.com","password":"secreto123"}'

# 3. Crear una tarea (usar el token devuelto en el paso anterior)
curl -X POST http://localhost:3000/api/tasks \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <TOKEN>" \
  -d '{"titulo":"Mi primera tarea","prioridad":"alta"}'

# 4. Listar tareas
curl http://localhost:3000/api/tasks -H "Authorization: Bearer <TOKEN>"
```

## Estructura del proyecto

Ver `ARCHITECTURE.md` para el detalle de la arquitectura interna.

## Documentacion adicional

- `ARCHITECTURE.md` — arquitectura, capas y flujo de datos.
- `docs/errores-encriptados.json` — documento cifrado con fines de
  evaluacion interna (ver `docs/COMO-DESENCRIPTAR.md`).
- `harness-evidencia/` — script que reproduce en vivo cada error listado
  en el documento cifrado, ejecutando el codigo real de `src/` (no
  requiere MongoDB).
