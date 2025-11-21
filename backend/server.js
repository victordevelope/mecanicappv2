const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const dotenv = require('dotenv');

dotenv.config();

const app = express();

// Configuración CORS
const allowedOrigins = (process.env.CORS_ORIGIN || 'https://tu-proyecto-firebase.web.app,http://localhost:4200')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

const corsOptions = {
  origin: (origin, callback) => {
    // Permite llamadas sin origin (server->server) y dominios en whitelist
    const allowed =
      !origin ||
      allowedOrigins.includes(origin) ||
      (origin && origin.endsWith('.vercel.app')) ||   // previews Vercel
      (origin && origin.endsWith('.web.app')) ||      // previews Firebase Hosting
      (origin && origin.includes('localhost'));       // local development
    
    console.log(`CORS check - Origin: ${origin}, Allowed: ${allowed}`);
    callback(null, allowed);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  optionsSuccessStatus: 204
};

app.use(cors(corsOptions));
// Manejo de preflight para cualquier ruta (evita '*')
app.options(/.*/, cors(corsOptions));
// Manejar preflight para cualquier ruta usando RegExp en lugar de '*'
app.options(/.*/, cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ===============================
// CONFIGURACIÓN DE POSTGRESQL
// ===============================
const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT || 5432,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  ssl: { rejectUnauthorized: false } // importante para Render
});

// Probar conexión
(async () => {
  try {
    const client = await pool.connect();
    console.log('✅ Conexión a PostgreSQL establecida correctamente');
    client.release();
  } catch (err) {
    console.error('❌ Error al conectar a PostgreSQL:', err);
    process.exit(1);
  }
})();

// ===============================
// AUTENTICACIÓN
// ===============================
app.post('/api/auth/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;

    const existing = await pool.query(
      'SELECT * FROM users WHERE username = $1 OR email = $2',
      [username, email]
    );

    if (existing.rows.length > 0) {
      return res.status(409).json({ message: 'El nombre de usuario o correo ya está en uso' });
    }

    const hashed = await bcrypt.hash(password, 10);

    const result = await pool.query(
      'INSERT INTO users (username, email, password) VALUES ($1, $2, $3) RETURNING id',
      [username, email, hashed]
    );

    const token = jwt.sign(
      { id: result.rows[0].id, username },
      process.env.JWT_SECRET || 'secret_key',
      { expiresIn: '24h' }
    );

    res.status(201).json({ id: result.rows[0].id, username, email, token });
  } catch (err) {
    console.error('Error al registrar usuario:', err);
    res.status(500).json({ message: 'Error al registrar usuario' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password)
      return res.status(400).json({ message: 'Usuario y contraseña requeridos' });

    const userRes = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
    if (userRes.rows.length === 0)
      return res.status(401).json({ message: 'Credenciales inválidas' });

    const user = userRes.rows[0];
    const valid = await bcrypt.compare(password, user.password) || password === user.password;
    if (!valid)
      return res.status(401).json({ message: 'Credenciales inválidas' });

    const token = jwt.sign(
      { id: user.id, username: user.username },
      process.env.JWT_SECRET || 'secret_key',
      { expiresIn: '24h' }
    );

    res.json({ id: user.id, username: user.username, email: user.email, token });
  } catch (err) {
    console.error('Error al iniciar sesión:', err);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
});

// ===============================
// MIDDLEWARE JWT
// ===============================
function authenticateToken(req, res, next) {
  const header = req.headers['authorization'];
  const token = header && header.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'Token no proporcionado' });

  jwt.verify(token, process.env.JWT_SECRET || 'secret_key', (err, user) => {
    if (err) return res.status(403).json({ message: 'Token inválido' });
    req.user = user;
    next();
  });
}

// ===============================
// PERFIL DE USUARIO
// ===============================
app.get('/api/user/profile', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, username, email FROM users WHERE id = $1',
      [req.user.id]
    );
    if (result.rows.length === 0)
      return res.status(404).json({ message: 'Usuario no encontrado' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error al obtener perfil:', err);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
});

// ===============================
// VEHÍCULOS
// ===============================
app.get('/api/vehicles', authenticateToken, async (req, res) => {
  try {
    const { q } = req.query;
    let sql = 'SELECT id, user_id AS "userId", brand, model, year, plate FROM vehicles WHERE user_id = $1';
    const params = [req.user.id];

    if (q) {
      sql += ' AND (brand ILIKE $2 OR model ILIKE $3 OR plate ILIKE $4)';
      const like = `%${q}%`;
      params.push(like, like, like);
    }

    const result = await pool.query(sql, params);
    res.json(result.rows);
  } catch (err) {
    console.error('Error al listar vehículos:', err);
    res.status(500).json({ message: 'Error al listar vehículos' });
  }
});

app.post('/api/vehicles', authenticateToken, async (req, res) => {
  try {
    const { brand, model, year, plate } = req.body;
    if (!brand || !model || !plate)
      return res.status(400).json({ message: 'brand, model y plate son requeridos' });

    const result = await pool.query(
      'INSERT INTO vehicles (user_id, brand, model, year, plate) VALUES ($1, $2, $3, $4, $5) RETURNING id',
      [req.user.id, brand, model, year || null, plate]
    );

    res.status(201).json({
      id: result.rows[0].id,
      userId: req.user.id,
      brand, model, year, plate
    });
  } catch (err) {
    console.error('Error al crear vehículo:', err);
    res.status(500).json({ message: 'Error al crear vehículo' });
  }
});

// ===============================
// MANTENIMIENTOS
// ===============================
app.get('/api/maintenances', authenticateToken, async (req, res) => {
  try {
    const { vehicleId } = req.query;
    let sql = `
      SELECT id, user_id AS "userId", vehicle_id AS "vehicleId", type, date, mileage, notes, cost
      FROM maintenances WHERE user_id = $1
    `;
    const params = [req.user.id];
    if (vehicleId) {
      sql += ' AND vehicle_id = $2';
      params.push(vehicleId);
    }
    sql += ' ORDER BY date DESC';
    const result = await pool.query(sql, params);
    res.json(result.rows);
  } catch (err) {
    console.error('Error al listar mantenimientos:', err);
    res.status(500).json({ message: 'Error al listar mantenimientos' });
  }
});

// ===============================
// RECORDATORIOS
// ===============================
app.get('/api/reminders', authenticateToken, async (req, res) => {
  try {
    const { vehicleId } = req.query;
    let sql = `
      SELECT id, user_id AS "userId", vehicle_id AS "vehicleId", maintenance_type AS "maintenanceType",
             due_date AS "dueDate", mileage, is_active AS "isActive"
      FROM reminders WHERE user_id = $1
    `;
    const params = [req.user.id];
    if (vehicleId) {
      sql += ' AND vehicle_id = $2';
      params.push(vehicleId);
    }
    sql += ' ORDER BY due_date ASC';
    const result = await pool.query(sql, params);
    res.json(result.rows);
  } catch (err) {
    console.error('Error al listar recordatorios:', err);
    res.status(500).json({ message: 'Error al listar recordatorios' });
  }
});

// ===============================
// INICIO SERVIDOR
// ===============================
const PORT = process.env.PORT || 10000; // usa el puerto de Render
app.listen(PORT, () => console.log(`🚀 Servidor corriendo en puerto ${PORT}`));

app.put('/api/vehicles/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { brand, model, year, plate } = req.body;

    if (!brand || !model || !plate)
      return res.status(400).json({ message: 'brand, model y plate son requeridos' });

    const result = await pool.query(
      'UPDATE vehicles SET brand = $1, model = $2, year = $3, plate = $4 WHERE id = $5 AND user_id = $6',
      [brand, model, year || null, plate, parseInt(id, 10), req.user.id]
    );

    if (result.rowCount === 0)
      return res.status(404).json({ message: 'Vehículo no encontrado' });

    res.json({ message: 'Vehículo actualizado exitosamente' });
  } catch (err) {
    console.error('Error al actualizar vehículo:', err);
    res.status(500).json({ message: 'Error al actualizar vehículo' });
  }
});

app.delete('/api/vehicles/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    await pool.query('DELETE FROM maintenances WHERE vehicle_id = $1 AND user_id = $2', [
      parseInt(id, 10),
      req.user.id
    ]);

    await pool.query('DELETE FROM reminders WHERE vehicle_id = $1 AND user_id = $2', [
      parseInt(id, 10),
      req.user.id
    ]);

    const result = await pool.query('DELETE FROM vehicles WHERE id = $1 AND user_id = $2', [
      parseInt(id, 10),
      req.user.id
    ]);

    if (result.rowCount === 0)
      return res.status(404).json({ message: 'Vehículo no encontrado' });

    res.json({ message: 'Vehículo eliminado exitosamente' });
  } catch (err) {
    console.error('Error al eliminar vehículo:', err);
    res.status(500).json({ message: 'Error al eliminar vehículo' });
  }
});

