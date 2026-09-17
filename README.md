# TaskFlow API

API backend para gestión de tareas por usuario. Construida con Node.js, Express y MongoDB (vía Mongoose). Expone únicamente endpoints JSON: no sirve vistas ni archivos estáticos.

---

## 🚀 Stack

* **Runtime:** Node.js (CommonJS)
* **Framework:** Express 4
* **Base de datos:** MongoDB + Mongoose 8
* **Autenticación:** JSON Web Tokens (`jsonwebtoken`)
* **Seguridad:** Hash de contraseñas con `bcryptjs`

---

## 📋 Requisitos previos

* **Node.js:** 18+
* Instancia de **MongoDB** accesible (local o Atlas)

---

## 🛠️ Instalación

```bash
npm install
cp .env.ejemplo .env
# completar los valores de .env (ver sección Variables de entorno)
