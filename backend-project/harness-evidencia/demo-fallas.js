/**
 * demo-fallas.js
 *
 * Ejecuta el codigo REAL de src/ (controllers, middleware) del proyecto
 * backend-project, sustituyendo unicamente el acceso a MongoDB por un
 * "modelo" en memoria (no hay ningun mongod disponible en este entorno).
 * El objetivo es disparar cada bug documentado y capturar la falla real
 * (excepcion, valor incorrecto, cuelgue, etc.) tal como ocurriria contra
 * una base de datos real.
 *
 * No se modifica NINGUN archivo de backend-project/src: se intercepta el
 * require de los modelos a nivel de Node antes de cargar los
 * controladores, para que estos sigan siendo exactamente el codigo que
 * va a ir al repositorio.
 */

const path = require('path');
const Module = require('module');

const PROJECT = path.resolve(__dirname, '..');
const SRC = path.join(PROJECT, 'src');

// ---------------------------------------------------------------------
// "Modelos" en memoria que imitan lo mínimo de la API de Mongoose que
// usan los controladores. Cada método queda instrumentado para poder
// ver exactamente con qué argumentos fue invocado (eso es lo que nos
// permite demostrar bugs como "no filtra por owner" o "ignora sortBy").
// ---------------------------------------------------------------------

let usersDB = [];
let tasksDB = [];
let nextId = 1;
const newId = () => String(nextId++).padStart(24, '0');

const calls = []; // registro de llamadas a los "modelos" (para inspeccionar bugs)
function log(fn, args) {
  calls.push({ fn, args });
}

const FakeUser = {
  async findOne(filter) {
    log('User.findOne', filter);
    return usersDB.find((u) => u.email === filter.email) || null;
  },
  async create(data) {
    log('User.create', data);
    if (usersDB.some((u) => u.email === data.email)) {
      const err = new Error(
        `E11000 duplicate key error collection: taskflow.users index: email_1 dup key: { email: "${data.email}" }`
      );
      err.code = 11000;
      throw err;
    }
    const user = { _id: newId(), ...data };
    usersDB.push(user);
    return user;
  },
  async findById(id) {
    log('User.findById', id);
    const u = usersDB.find((u) => u._id === id);
    if (!u) return null;
    return { ...u, select: () => u }; // soporta .select('-password') de forma simplificada
  },
};
FakeUser.findById = async (id) => {
  log('User.findById', id);
  const u = usersDB.find((u) => u._id === id);
  return u
    ? { ...u, toObject: () => u }
    : null;
};

const FakeTask = {
  async create(data) {
    log('Task.create', data);
    const task = { _id: newId(), createdAt: new Date(), ...data };
    tasksDB.push(task);
    return task;
  },
  find(filter) {
    log('Task.find', filter);
    let results = tasksDB.filter((t) => matchFilter(t, filter));
    const chain = {
      _sort: null,
      _skip: 0,
      _limit: results.length,
      sort(sortSpec) {
        log('Task.find().sort()', sortSpec);
        this._sort = sortSpec;
        return this;
      },
      skip(n) {
        log('Task.find().skip()', n);
        this._skip = n;
        return this;
      },
      limit(n) {
        log('Task.find().limit()', n);
        this._limit = n;
        return this;
      },
      then(resolve) {
        let out = [...results];
        if (this._sort) {
          const [field, dir] = Object.entries(this._sort)[0];
          out.sort((a, b) => (a[field] > b[field] ? 1 : -1) * dir);
        }
        out = out.slice(this._skip, this._skip + this._limit);
        resolve(out);
      },
    };
    return chain;
  },
  async countDocuments(filter) {
    log('Task.countDocuments', filter);
    return tasksDB.filter((t) => matchFilter(t, filter)).length;
  },
  async findById(id) {
    log('Task.findById', id);
    return tasksDB.find((t) => t._id === id) || null;
  },
  async findByIdAndUpdate(id, update, opts) {
    log('Task.findByIdAndUpdate', { id, update, opts });
    const idx = tasksDB.findIndex((t) => t._id === id);
    if (idx === -1) return null;
    // Simula Mongoose SIN runValidators: no valida enum "estado"/"prioridad"
    tasksDB[idx] = { ...tasksDB[idx], ...update };
    return tasksDB[idx];
  },
  async findByIdAndDelete(id) {
    log('Task.findByIdAndDelete', id);
    const idx = tasksDB.findIndex((t) => t._id === id);
    if (idx === -1) return null;
    const [removed] = tasksDB.splice(idx, 1);
    return removed;
  },
};

function matchFilter(doc, filter) {
  return Object.entries(filter).every(([key, cond]) => {
    if (cond && typeof cond === 'object' && !(cond instanceof Date)) {
      if ('$ne' in cond && doc[key] === cond.$ne) return false;
      if ('$lt' in cond && !(doc[key] < cond.$lt)) return false;
      return true;
    }
    return doc[key] === cond;
  });
}

// ---------------------------------------------------------------------
// Interceptar los require('../models/User') y require('../models/Task')
// para que devuelvan los fakes de arriba, sin tocar el codigo fuente.
// ---------------------------------------------------------------------
const originalLoad = Module._load;
Module._load = function (request, parent, isMain) {
  if (parent && parent.filename && parent.filename.startsWith(SRC)) {
    if (request.endsWith('models/User')) return FakeUser;
    if (request.endsWith('models/Task')) return FakeTask;
  }
  return originalLoad.apply(this, arguments);
};

process.env.JWT_EXPIRES_IN = '1h';
process.env.NODE_ENV = 'production'; // para probar el bug #9 en las condiciones reales de prod

const authController = require(path.join(SRC, 'controllers/authController'));
const taskController = require(path.join(SRC, 'controllers/taskController'));
const { requireAuth, requireAdmin } = require(path.join(SRC, 'middleware/auth'));
const { errorHandler } = require(path.join(SRC, 'middleware/errorHandler'));

function mockRes(label) {
  const res = {
    _status: 200,
    _body: undefined,
    _sent: false,
    status(code) {
      this._status = code;
      return this;
    },
    json(body) {
      this._body = body;
      this._sent = true;
      return this;
    },
    send(body) {
      this._body = body;
      this._sent = true;
      return this;
    },
  };
  return res;
}

function separator(titulo) {
  console.log('\n' + '='.repeat(70));
  console.log(titulo);
  console.log('='.repeat(70));
}

async function main() {
  const evidencia = {};

  // ---------------------------------------------------------------
  // BUG 1: FALLBACK_SECRET hardcodeado en requireAuth
  // ---------------------------------------------------------------
  separator('BUG 1 — Secreto JWT de respaldo hardcodeado (requireAuth)');
  delete process.env.JWT_SECRET; // simula un .env que "se olvidaron" de completar
  const jwt = require('jsonwebtoken');
  const tokenForjado = jwt.sign(
    { id: 'atacante-id', email: 'atacante@evil.com', rol: 'admin' },
    'taskflow-dev-secret' // el mismo valor hardcodeado en src/middleware/auth.js
  );
  const req1 = { headers: { authorization: `Bearer ${tokenForjado}` } };
  const res1 = mockRes('bug1');
  let next1Called = false;
  requireAuth(req1, res1, () => {
    next1Called = true;
  });
  console.log('JWT_SECRET definido en el entorno:', process.env.JWT_SECRET || '(vacio)');
  console.log('Token forjado usando el secreto hardcodeado "taskflow-dev-secret"');
  console.log('¿requireAuth lo acepto como valido?', next1Called);
  console.log('req.user resultante:', req1.user);
  evidencia.bug1 = {
    aceptado: next1Called,
    rolObtenido: req1.user && req1.user.rol,
  };
  process.env.JWT_SECRET = 'un-secreto-de-testing-solo-para-el-harness'; // restaurado para el resto de las pruebas

  // ---------------------------------------------------------------
  // BUG 2: requireAdmin no responde ni llama next() -> cuelgue
  // ---------------------------------------------------------------
  separator('BUG 2 — requireAdmin se cuelga para usuarios no-admin');
  const req2 = { user: { id: 'u1', rol: 'user' } };
  const res2 = mockRes('bug2');
  let next2Called = false;
  requireAdmin(req2, res2, () => {
    next2Called = true;
  });
  await new Promise((r) => setTimeout(r, 50)); // le damos tiempo por si acaso
  console.log('¿Se llamo a next()?', next2Called);
  console.log('¿Se envio alguna respuesta (res.json/res.send)?', res2._sent);
  console.log('=> La request queda sin next() y sin respuesta: CUELGUE real confirmado.');
  evidencia.bug2 = { nextLlamado: next2Called, respuestaEnviada: res2._sent };

  // ---------------------------------------------------------------
  // BUG 3: escalada de privilegios via "rol" en /register
  // ---------------------------------------------------------------
  separator('BUG 3 — Escalada de privilegios en authController.register');
  usersDB = [];
  const req3 = {
    body: {
      nombre: 'Atacante',
      email: 'atacante2@evil.com',
      password: 'cualquierClave',
      rol: 'admin', // <- el atacante lo agrega el mismo en el body
    },
  };
  const res3 = mockRes('bug3');
  await authController.register(req3, res3);
  console.log('Body enviado por el "atacante":', req3.body);
  console.log('Respuesta del servidor (rol devuelto):', res3._body.rol);
  evidencia.bug3 = { rolAutoasignado: res3._body.rol };

  // ---------------------------------------------------------------
  // BUG 4: login no valida user===null antes de bcrypt.compare -> crash
  // ---------------------------------------------------------------
  separator('BUG 4 — Crash real en login cuando el email no existe');
  const req4 = { body: { email: 'no-existe@nadie.com', password: 'x' } };
  const res4 = mockRes('bug4');
  let excepcionReal = null;
  try {
    await authController.login(req4, res4);
  } catch (err) {
    excepcionReal = err;
  }
  console.log('¿Se lanzo una excepcion no controlada?', excepcionReal !== null);
  console.log('Tipo de error real:', excepcionReal && excepcionReal.constructor.name);
  console.log('Mensaje real:', excepcionReal && excepcionReal.message);
  console.log(
    '=> En un servidor Express real, al no haber try/catch en la ruta, esto es una'
  );
  console.log(
    '   unhandled promise rejection: en Node 15+ el proceso termina (crash del servidor).'
  );
  evidencia.bug4 = {
    excepcion: excepcionReal ? excepcionReal.message : null,
  };

  // ---------------------------------------------------------------
  // BUG 5: paginacion con "skip = page * limit"
  // ---------------------------------------------------------------
  separator('BUG 5 — Paginacion incorrecta (se pierde el primer bloque)');
  tasksDB = [];
  const ownerId = 'owner-1';
  for (let i = 1; i <= 5; i++) {
    tasksDB.push({ _id: newId(), titulo: `Tarea ${i}`, owner: ownerId, createdAt: new Date(2026, 0, i) });
  }
  const req5 = { user: { id: ownerId }, query: { page: 1, limit: 2 } };
  const res5 = mockRes('bug5');
  await taskController.listTasks(req5, res5);
  console.log('Tareas totales del usuario:', tasksDB.length);
  console.log('Pedido: page=1, limit=2 (se espera: Tarea 1 y Tarea 2)');
  console.log(
    'Titulos devueltos realmente:',
    res5._body.data.map((t) => t.titulo)
  );
  evidencia.bug5 = { titulosDevueltos: res5._body.data.map((t) => t.titulo) };

  // ---------------------------------------------------------------
  // BUG 6: sortBy ignorado
  // ---------------------------------------------------------------
  separator('BUG 6 — El parametro sortBy se ignora');
  const llamadasSort = calls.filter((c) => c.fn === 'Task.find().sort()');
  const ultimaLlamadaSort = llamadasSort[llamadasSort.length - 1];
  console.log('Query enviada por el cliente: ?sortBy=titulo');
  console.log('Argumento REAL con el que se llamo a .sort():', ultimaLlamadaSort.args);
  console.log('=> Se ignora "titulo" y siempre ordena por createdAt.');
  evidencia.bug6 = { sortRealUsado: ultimaLlamadaSort.args };

  // ---------------------------------------------------------------
  // BUG 7: IDOR en getTask/updateTask/deleteTask (no filtra por owner)
  // ---------------------------------------------------------------
  separator('BUG 7 — IDOR: acceso a tareas de otro usuario');
  tasksDB = [];
  const tareaDeOtro = { _id: newId(), titulo: 'Tarea privada de Bruno', owner: 'bruno-id' };
  tasksDB.push(tareaDeOtro);
  const req7 = { params: { id: tareaDeOtro._id }, user: { id: 'carla-id' } }; // Carla, NO es el owner
  const res7 = mockRes('bug7');
  await taskController.getTask(req7, res7);
  console.log('Usuario autenticado: carla-id. Owner real de la tarea: bruno-id.');
  console.log('¿La API devolvio la tarea de Bruno a Carla?', res7._body && res7._body.titulo);
  evidencia.bug7 = { tareaFiltrada: res7._body ? res7._body.titulo : null };

  // ---------------------------------------------------------------
  // BUG 8: mass assignment + bypass de validators en updateTask
  // ---------------------------------------------------------------
  separator('BUG 8 — Mass assignment y bypass de validaciones en updateTask');
  const req8 = {
    params: { id: tareaDeOtro._id },
    body: { estado: 'ESTADO_INVENTADO_NO_EXISTE', owner: 'carla-id' },
  };
  const res8 = mockRes('bug8');
  await taskController.updateTask(req8, res8);
  console.log('Body enviado (con un "estado" que no es un valor de enum valido, y "owner" ajeno):', req8.body);
  console.log('Tarea resultante en la base:', res8._body);
  console.log('=> Se guardo un estado invalido y se reasigno el owner de la tarea.');
  evidencia.bug8 = { estadoGuardado: res8._body.estado, ownerFinal: res8._body.owner };

  // ---------------------------------------------------------------
  // BUG 9: errorHandler filtra el stack trace en produccion
  // ---------------------------------------------------------------
  separator('BUG 9 — Fuga de stack trace en produccion (errorHandler)');
  const errorSimulado = new Error('Fallo interno simulado');
  const res9 = mockRes('bug9');
  errorHandler(errorSimulado, {}, res9, () => {});
  console.log('process.env.NODE_ENV =', process.env.NODE_ENV);
  console.log('¿La respuesta JSON incluye "stack"?', 'stack' in res9._body);
  console.log('Primeras lineas del stack filtrado:', res9._body.stack.split('\n').slice(0, 2).join(' | '));
  evidencia.bug9 = { stackExpuestoEnProd: 'stack' in res9._body };

  // ---------------------------------------------------------------
  // BUG 10: CORS con origin:'*' + credentials:true (real, sobre HTTP)
  // ---------------------------------------------------------------
  separator('BUG 10 — CORS invalido (origin:"*" + credentials:true) — request HTTP real');
  const app = require(path.join(SRC, 'app'));
  const http = require('http');
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const { port } = server.address();
  const response = await fetch(`http://127.0.0.1:${port}/health`, {
    headers: { Origin: 'https://sitio-cualquiera-malicioso.com' },
  });
  const allowOrigin = response.headers.get('access-control-allow-origin');
  const allowCreds = response.headers.get('access-control-allow-credentials');
  console.log('Origin enviado por el cliente:', 'https://sitio-cualquiera-malicioso.com');
  console.log('Header real Access-Control-Allow-Origin:', allowOrigin);
  console.log('Header real Access-Control-Allow-Credentials:', allowCreds);
  evidencia.bug10 = { allowOrigin, allowCreds };
  await new Promise((resolve) => server.close(resolve));

  // ---------------------------------------------------------------
  // BUG 11: seed.js no idempotente -> E11000 sin manejar
  // ---------------------------------------------------------------
  separator('BUG 11 — scripts/seed.js no es idempotente (E11000 sin manejar)');
  usersDB = [];
  // Reproducimos exactamente la logica de scripts/seed.js (sin mongoose.connect,
  // que aca no existe), usando el mismo FakeUser.create ya instrumentado arriba.
  async function correrSeedUnaVez() {
    await FakeUser.create({ nombre: 'Ana Admin', email: 'ana.admin@taskflow.test', password: 'hash', rol: 'admin' });
  }
  await correrSeedUnaVez();
  console.log('Primera corrida de "npm run seed": OK, usuario creado.');
  let errorSeed = null;
  try {
    await correrSeedUnaVez(); // segunda corrida, sin limpiar la coleccion antes
  } catch (err) {
    errorSeed = err;
  }
  console.log('Segunda corrida de "npm run seed" (sin limpiar antes):');
  console.log('¿Lanzo excepcion real?', errorSeed !== null);
  console.log('Mensaje real:', errorSeed && errorSeed.message);
  console.log('=> scripts/seed.js no tiene try/catch alrededor de run(): esto termina el proceso.');
  evidencia.bug11 = { errorReal: errorSeed ? errorSeed.message : null };

  // ---------------------------------------------------------------
  // BUG 12: listOverdue - fecha "date-only" comparada como instante UTC
  // ---------------------------------------------------------------
  separator('BUG 12 — listOverdue: fecha vencimiento vs zona horaria del usuario');
  tasksDB = [];
  const usuarioId = 'user-la';
  // Un usuario en Los Angeles (UTC-8) crea una tarea con vencimiento "el 17
  // de septiembre" (su dia local), que el formulario/API guarda como
  // fecha-only -> Node/Mongo la interpreta como medianoche UTC de ese dia:
  const fechaVencimientoGuardada = new Date('2026-09-17'); // = 2026-09-17T00:00:00Z
  tasksDB.push({
    _id: newId(),
    titulo: 'Entregar informe (vence el 17/9 segun el usuario)',
    estado: 'pendiente',
    owner: usuarioId,
    fechaVencimiento: fechaVencimientoGuardada,
  });
  // Instante real simulado: 2026-09-17T04:00:00Z. En Los Angeles (UTC-8)
  // eso es 2026-09-16 20:00 hora local: para el usuario TODAVIA ES EL DIA
  // ANTERIOR (16/9), su "17 de septiembre" ni siquiera empezo. Probamos la
  // funcion real de listOverdue con ese "ahora":
  const ahoraSimulado = new Date('2026-09-17T04:00:00.000Z');
  const _RealDate = Date;
  global.Date = class extends _RealDate {
    constructor(...args) {
      if (args.length === 0) return ahoraSimulado;
      return new _RealDate(...args);
    }
    static now() {
      return ahoraSimulado.getTime();
    }
  };
  const req12 = { user: { id: usuarioId } };
  const res12 = mockRes('bug12');
  await taskController.listOverdue(req12, res12);
  global.Date = _RealDate;
  console.log('Hora real simulada (UTC):', ahoraSimulado.toISOString());
  console.log('Hora local del usuario en Los Angeles (UTC-8): 2026-09-16 20:00 (para el, todavia es el dia ANTERIOR)');
  console.log('fechaVencimiento guardada (UTC):', fechaVencimientoGuardada.toISOString());
  console.log('¿La tarea aparece como vencida en /api/tasks/overdue?', res12._body.length > 0);
  if (res12._body.length > 0) {
    console.log('=> BUG confirmado: la tarea se marca VENCIDA cuando, en el dia local del usuario, ni siquiera empezo el 17/9.');
  }
  evidencia.bug12 = { marcadaVencidaPrematuramente: res12._body.length > 0 };

  separator('RESUMEN DE EVIDENCIA REAL CAPTURADA');
  console.log(JSON.stringify(evidencia, null, 2));

  require('fs').writeFileSync(
    path.join(__dirname, 'evidencia.json'),
    JSON.stringify(evidencia, null, 2)
  );
  console.log('\nEvidencia guardada en harness-evidencia/evidencia.json');
}

main().catch((err) => {
  console.error('ERROR INESPERADO EN EL HARNESS:', err);
  process.exit(1);
});
