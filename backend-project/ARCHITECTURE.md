# Arquitectura — TaskFlow API

## Vision general

TaskFlow API es un servicio HTTP que expone unicamente endpoints JSON para
administrar usuarios y tareas. No hay renderizado de vistas: toda la
interaccion es via API, pensada para ser consumida por un front-end
separado o por clientes HTTP (Postman, curl, etc.).

## Capas

```
Cliente HTTP
     │
     ▼
routes/          → define los endpoints y los conecta con sus controladores
     │
     ▼
middleware/      → autenticacion (JWT), manejo de errores
     │
     ▼
controllers/     → logica de cada endpoint: valida input, llama al modelo,
                    construye la respuesta
     │
     ▼
models/          → esquemas de Mongoose (User, Task) y acceso a MongoDB
     │
     ▼
MongoDB
```

### `src/config/db.js`

Encapsula la conexion a MongoDB via Mongoose (`mongoose.connect`). Se llama
una sola vez al iniciar el servidor, desde `src/server.js`.

### `src/models/`

- **User**: `nombre`, `email` (unico), `password` (hash bcrypt), `rol`
  (`user` | `admin`).
- **Task**: `titulo`, `descripcion`, `estado`, `prioridad`,
  `fechaVencimiento`, `owner` (referencia al `User` due;o de la tarea).

### `src/middleware/auth.js`

- `requireAuth`: valida el header `Authorization: Bearer <token>`, verifica
  el JWT y adjunta el payload decodificado a `req.user` para que los
  controladores sepan quien esta haciendo la request.
- `requireAdmin`: pensado para restringir rutas a usuarios con `rol: admin`.

### `src/middleware/errorHandler.js`

- `notFound`: captura cualquier ruta no definida y devuelve 404 en JSON.
- `errorHandler`: middleware de error de Express (4 argumentos) que
  centraliza la respuesta cuando un controlador lanza una excepcion.

### `src/controllers/`

- **authController**: `register`, `login`, `me`. Genera el JWT firmado con
  `JWT_SECRET` y expiracion `JWT_EXPIRES_IN`.
- **taskController**: CRUD de tareas (`createTask`, `listTasks`, `getTask`,
  `updateTask`, `deleteTask`) mas `listOverdue` para tareas vencidas.

### `src/routes/`

Define los prefijos `/api/auth` y `/api/tasks` y aplica `requireAuth` a
todas las rutas de tareas.

### `src/app.js`

Configura Express: JSON body parser, CORS, monta las rutas y los
middlewares de error al final de la cadena.

### `src/server.js`

Punto de entrada: carga variables de entorno (`dotenv`), conecta a la base
de datos y levanta el servidor HTTP en el puerto configurado.

### `scripts/seed.js`

Script standalone (no se ejecuta al levantar el servidor) que se conecta a
la misma base configurada en `MONGO_URI` y crea usuarios y tareas de
ejemplo para poder probar la API sin tener que crear datos a mano.

## Flujo de autenticacion

1. El cliente llama a `POST /api/auth/register` o `POST /api/auth/login`.
2. El servidor devuelve un JWT firmado.
3. El cliente incluye ese JWT en el header `Authorization: Bearer <token>`
   en cada request subsiguiente.
4. El middleware `requireAuth` decodifica el token y expone `req.user`
   (`id`, `email`, `rol`) a los controladores.

## Decisiones de diseño

- **Sin ORM pesado**: se usa Mongoose directamente en los controladores por
  simplicidad, sin una capa de "repository" adicional, dado el tamaño del
  proyecto.
- **JSON puro**: no se sirve HTML ni archivos estaticos; el backend es
  consumido exclusivamente como API.
- **Un solo secreto JWT**: se firma y verifica con la misma clave
  simetrica (`JWT_SECRET`), sin rotacion de claves.
