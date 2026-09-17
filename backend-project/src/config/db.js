const mongoose = require('mongoose');

async function connectDB() {
  const uri = process.env.MONGO_URI;

  try {
    await mongoose.connect(uri);
    console.log(`[db] Conectado a MongoDB en ${uri}`);
  } catch (err) {
    console.error('[db] Error al conectar a MongoDB:', err.message);
    process.exit(1);
  }
}

mongoose.connection.on('disconnected', () => {
  console.log('[db] Conexion a MongoDB perdida');
});

module.exports = connectDB;
