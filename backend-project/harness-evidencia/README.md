# Evidencia real de los errores

Esta carpeta no forma parte de la API en si: es la prueba de que los 12
errores documentados (en forma cifrada en `docs/errores-encriptados.json`)
son reales y fueron efectivamente disparados, no solo descritos en teoria.

- `demo-fallas.js`: ejecuta el codigo REAL de `src/` (controllers y
  middleware), sustituyendo unicamente el acceso a MongoDB por un modelo
  en memoria (no se modifica ningun archivo de `src/` ni de `scripts/`
  para esto). Para cada bug, fuerza la condicion que lo dispara y
  muestra/registra la falla real: una excepcion real, un valor incorrecto
  real devuelto por la API, o un header HTTP real capturado contra una
  instancia real del servidor Express.
- `evidencia.json`: la salida real (resumida) de la ultima corrida.

## Como volver a correrlo

```bash
cd harness-evidencia
node demo-fallas.js
```

Requiere que `node_modules` de la raiz del proyecto este instalado
(`npm install` en la raiz) — no necesita MongoDB corriendo.
