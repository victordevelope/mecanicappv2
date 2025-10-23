const express = require('express');
const cors = require('cors');
const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const dotenv = require('dotenv');

// Cargar variables de entorno
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
// En la configuración de middleware (agregar urlencoded)
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Configuración de la base de datos
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'mantenimiento_vehicular'
};

// Crear pool de conexiones
const pool = mysql.createPool(dbConfig);

// Verificar conexión a la base de datos
async function testConnection() {
  try {
    const connection = await pool.getConnection();
    console.log('Conexión a la base de datos establecida correctamente');
    connection.release();
  } catch (error) {
    console.error('Error al conectar a la base de datos:', error);
    process.exit(1);
  }
}

testConnection();

// Rutas de autenticación
// Modificación en la ruta de registro (alrededor de la línea 40)
app.post('/api/auth/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;
    
    // Verificar si el usuario ya existe
    const [existingUsers] = await pool.query(
      'SELECT * FROM users WHERE username = ? OR email = ?',
      [username, email]
    );
    
    if (existingUsers.length > 0) {
      return res.status(409).json({ message: 'El nombre de usuario o correo ya está en uso' });
    }
    
    // Encriptar contraseña
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Insertar nuevo usuario
    const [result] = await pool.query(
      'INSERT INTO users (username, email, password) VALUES (?, ?, ?)',
      [username, email, hashedPassword]
    );
    
    // Generar token JWT para el nuevo usuario
    const token = jwt.sign(
      { id: result.insertId, username },
      process.env.JWT_SECRET || 'secret_key',
      { expiresIn: '24h' }
    );
    
    res.status(201).json({
      id: result.insertId,
      username,
      email,
      token,
      message: 'Usuario registrado exitosamente'
    });
  } catch (error) {
    console.error('Error al registrar usuario:', error);
    res.status(500).json({ message: 'Error al registrar usuario' });
  }
});

// Ruta para autenticación con Google (simulada)
app.get('/api/auth/google', (req, res) => {
  // En un entorno real, aquí se implementaría la autenticación con Google OAuth
  // Para esta implementación, simularemos una respuesta exitosa
  
  const mockUser = {
    id: 999,
    username: 'usuario_google',
    email: 'usuario@gmail.com',
    token: 'google_mock_token_' + Date.now()
  };
  
  res.json(mockUser);
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    // Validar datos
    if (!username || !password) {
      return res.status(400).json({ message: 'Usuario y contraseña son requeridos' });
    }
    
    // Buscar usuario
    const [users] = await pool.query(
      'SELECT * FROM users WHERE username = ?',
      [username]
    );
    
    if (users.length === 0) {
      return res.status(401).json({ message: 'Credenciales inválidas' });
    }
    
    const user = users[0];
    
    // Modificación en la ruta de login (alrededor de la línea 117)
    // Verificar contraseña
    const isPasswordValid = await bcrypt.compare(password, user.password) || password === user.password;
    
    if (!isPasswordValid) {
      return res.status(401).json({ message: 'Credenciales inválidas' });
    }
    
    // Generar token JWT
    const token = jwt.sign(
      { id: user.id, username: user.username },
      process.env.JWT_SECRET || 'secret_key',
      { expiresIn: '24h' }
    );
    
    res.json({
      id: user.id,
      username: user.username,
      email: user.email,
      token
    });
  } catch (error) {
    console.error('Error al iniciar sesión:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
});

// Middleware para verificar token
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ message: 'Token no proporcionado' });
  }
  
  jwt.verify(token, process.env.JWT_SECRET || 'secret_key', (err, user) => {
    if (err) {
      return res.status(403).json({ message: 'Token inválido' });
    }
    
    req.user = user;
    next();
  });
}

// Ruta protegida de ejemplo
app.get('/api/user/profile', authenticateToken, async (req, res) => {
  try {
    const [users] = await pool.query(
      'SELECT id, username, email FROM users WHERE id = ?',
      [req.user.id]
    );
    
    if (users.length === 0) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }
    
    res.json(users[0]);
  } catch (error) {
    console.error('Error al obtener perfil:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
});

// ==========================
// Vehículos
// ==========================
app.get('/api/vehicles', authenticateToken, async (req, res) => {
  try {
    const { q } = req.query;
    let sql = 'SELECT id, user_id AS userId, brand, model, year, plate FROM vehicles WHERE user_id = ?';
    const params = [req.user.id];

    if (q) {
      sql += ' AND (brand LIKE ? OR model LIKE ? OR plate LIKE ?)';
      const like = `%${q}%`;
      params.push(like, like, like);
    }

    const [rows] = await pool.query(sql, params);
    res.json(rows);
  } catch (error) {
    console.error('Error al listar vehículos:', error);
    res.status(500).json({ message: 'Error al listar vehículos' });
  }
});

app.get('/api/vehicles/:id', authenticateToken, async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT id, user_id AS userId, brand, model, year, plate FROM vehicles WHERE id = ? AND user_id = ?',
      [req.params.id, req.user.id]
    );
    if (rows.length === 0) {
      return res.status(404).json({ message: 'Vehículo no encontrado' });
    }
    res.json(rows[0]);
  } catch (error) {
    console.error('Error al obtener vehículo:', error);
    res.status(500).json({ message: 'Error al obtener vehículo' });
  }
});

// Ruta: POST /api/vehicles
app.post('/api/vehicles', authenticateToken, async (req, res) => {
  try {
    const body = req.body || {};
    const { brand, model, year } = body;
    const plate = body.plate ?? body.licensePlate ?? null;

    if (!brand || !model || !plate) {
      return res.status(400).json({ message: 'brand, model y plate son requeridos' });
    }

    const [result] = await pool.query(
      'INSERT INTO vehicles (user_id, brand, model, year, plate) VALUES (?, ?, ?, ?, ?)',
      [req.user.id, brand, model, year || null, plate]
    );

    res.status(201).json({
      id: result.insertId,
      userId: req.user.id,
      brand, model, year, plate
    });
  } catch (error) {
    console.error('Error al crear vehículo:', error);
    res.status(500).json({ message: 'Error al crear vehículo' });
  }
});

app.put('/api/vehicles/:id', authenticateToken, async (req, res) => {
  try {
    const { brand, model, year, plate } = req.body;
    const [result] = await pool.query(
      'UPDATE vehicles SET brand = ?, model = ?, year = ?, plate = ? WHERE id = ? AND user_id = ?',
      [brand, model, year || null, plate, req.params.id, req.user.id]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Vehículo no encontrado' });
    }
    res.json({ success: true });
  } catch (error) {
    console.error('Error al actualizar vehículo:', error);
    res.status(500).json({ message: 'Error al actualizar vehículo' });
  }
});

app.delete('/api/vehicles/:id', authenticateToken, async (req, res) => {
  try {
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      await conn.query('DELETE FROM maintenances WHERE user_id = ? AND vehicle_id = ?', [req.user.id, req.params.id]);
      await conn.query('DELETE FROM reminders    WHERE user_id = ? AND vehicle_id = ?', [req.user.id, req.params.id]);
      const [result] = await conn.query('DELETE FROM vehicles WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
      await conn.commit();
      if (result.affectedRows === 0) {
        return res.status(404).json({ message: 'Vehículo no encontrado' });
      }
      res.json({ success: true });
    } catch (txErr) {
      await conn.rollback();
      throw txErr;
    } finally {
      conn.release();
    }
  } catch (error) {
    console.error('Error al eliminar vehículo:', error);
    res.status(500).json({ message: 'Error al eliminar vehículo' });
  }
});

// ==========================
// Mantenimientos
// ==========================
app.get('/api/maintenances', authenticateToken, async (req, res) => {
  try {
    const { vehicleId } = req.query;
    let sql = `
      SELECT id, user_id AS userId, vehicle_id AS vehicleId, type, date, mileage, notes, cost
      FROM maintenances WHERE user_id = ?
    `;
    const params = [req.user.id];
    if (vehicleId) {
      sql += ' AND vehicle_id = ?';
      params.push(vehicleId);
    }
    sql += ' ORDER BY date DESC';
    const [rows] = await pool.query(sql, params);
    res.json(rows);
  } catch (error) {
    console.error('Error al listar mantenimientos:', error);
    res.status(500).json({ message: 'Error al listar mantenimientos' });
  }
});

// Ruta: POST /api/maintenances (validar que el vehículo exista y pertenezca al usuario)
app.post('/api/maintenances', authenticateToken, async (req, res) => {
  try {
    const { vehicleId, type, date, mileage, notes, cost } = req.body;
    if (!vehicleId || !type || mileage == null) {
      return res.status(400).json({ message: 'vehicleId, type y mileage son requeridos' });
    }

    const [veh] = await pool.query(
      'SELECT id FROM vehicles WHERE id = ? AND user_id = ?',
      [vehicleId, req.user.id]
    );
    if (veh.length === 0) {
      return res.status(400).json({ message: 'Vehículo no existe o no pertenece al usuario' });
    }

    const [result] = await pool.query(
      'INSERT INTO maintenances (user_id, vehicle_id, type, date, mileage, notes, cost) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [req.user.id, vehicleId, type, date || new Date().toISOString(), mileage, notes || null, cost || null]
    );

    res.status(201).json({
      id: result.insertId,
      userId: req.user.id,
      vehicleId, type, date, mileage, notes, cost
    });
  } catch (error) {
    console.error('Error al crear mantenimiento:', error);
    res.status(500).json({ message: 'Error al crear mantenimiento' });
  }
});

app.put('/api/maintenances/:id', authenticateToken, async (req, res) => {
  try {
    const { vehicleId, type, date, mileage, notes, cost } = req.body;
    const [result] = await pool.query(
      'UPDATE maintenances SET vehicle_id = ?, type = ?, date = ?, mileage = ?, notes = ?, cost = ? WHERE id = ? AND user_id = ?',
      [vehicleId, type, date || new Date().toISOString(), mileage, notes || null, cost || null, req.params.id, req.user.id]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Mantenimiento no encontrado' });
    }
    res.json({ success: true });
  } catch (error) {
    console.error('Error al actualizar mantenimiento:', error);
    res.status(500).json({ message: 'Error al actualizar mantenimiento' });
  }
});

app.delete('/api/maintenances/:id', authenticateToken, async (req, res) => {
  try {
    const [result] = await pool.query(
      'DELETE FROM maintenances WHERE id = ? AND user_id = ?',
      [req.params.id, req.user.id]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Mantenimiento no encontrado' });
    }
    res.json({ success: true });
  } catch (error) {
    console.error('Error al eliminar mantenimiento:', error);
    res.status(500).json({ message: 'Error al eliminar mantenimiento' });
  }
});

// ==========================
// Recordatorios
// ==========================
app.get('/api/reminders', authenticateToken, async (req, res) => {
  try {
    const { vehicleId } = req.query;
    let sql = `
      SELECT id, user_id AS userId, vehicle_id AS vehicleId, maintenance_type AS maintenanceType, due_date AS dueDate, mileage, is_active AS isActive
      FROM reminders WHERE user_id = ?
    `;
    const params = [req.user.id];
    if (vehicleId) {
      sql += ' AND vehicle_id = ?';
      params.push(vehicleId);
    }
    sql += ' ORDER BY due_date ASC';
    const [rows] = await pool.query(sql, params);
    res.json(rows);
  } catch (error) {
    console.error('Error al listar recordatorios:', error);
    res.status(500).json({ message: 'Error al listar recordatorios' });
  }
});

// Ruta: POST /api/reminders (validar que el vehículo exista y pertenezca al usuario)
app.post('/api/reminders', authenticateToken, async (req, res) => {
  try {
    const { vehicleId, maintenanceType, dueDate, mileage, isActive } = req.body;
    if (!vehicleId || !maintenanceType || !dueDate) {
      return res.status(400).json({ message: 'vehicleId, maintenanceType y dueDate son requeridos' });
    }

    const [veh] = await pool.query(
      'SELECT id FROM vehicles WHERE id = ? AND user_id = ?',
      [vehicleId, req.user.id]
    );
    if (veh.length === 0) {
      return res.status(400).json({ message: 'Vehículo no existe o no pertenece al usuario' });
    }

    const [result] = await pool.query(
      'INSERT INTO reminders (user_id, vehicle_id, maintenance_type, due_date, mileage, is_active) VALUES (?, ?, ?, ?, ?, ?)',
      [req.user.id, vehicleId, maintenanceType, dueDate, mileage || null, isActive ? 1 : 0]
    );

    res.status(201).json({
      id: result.insertId,
      userId: req.user.id,
      vehicleId, maintenanceType, dueDate, mileage, isActive: !!isActive
    });
  } catch (error) {
    console.error('Error al crear recordatorio:', error);
    res.status(500).json({ message: 'Error al crear recordatorio' });
  }
});

app.put('/api/reminders/:id', authenticateToken, async (req, res) => {
  try {
    const { vehicleId, maintenanceType, dueDate, mileage, isActive } = req.body;
    const [result] = await pool.query(
      'UPDATE reminders SET vehicle_id = ?, maintenance_type = ?, due_date = ?, mileage = ?, is_active = ? WHERE id = ? AND user_id = ?',
      [vehicleId, maintenanceType, dueDate, mileage || null, isActive ? 1 : 0, req.params.id, req.user.id]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Recordatorio no encontrado' });
    }
    res.json({ success: true });
  } catch (error) {
    console.error('Error al actualizar recordatorio:', error);
    res.status(500).json({ message: 'Error al actualizar recordatorio' });
  }
});

app.delete('/api/reminders/:id', authenticateToken, async (req, res) => {
  try {
    const [result] = await pool.query(
      'DELETE FROM reminders WHERE id = ? AND user_id = ?',
      [req.params.id, req.user.id]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Recordatorio no encontrado' });
    }
    res.json({ success: true });
  } catch (error) {
    console.error('Error al eliminar recordatorio:', error);
    res.status(500).json({ message: 'Error al eliminar recordatorio' });
  }
});

// ==========================
// Notificaciones (registro de dispositivo)
// ==========================
app.post('/api/notifications/register-device', authenticateToken, async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) {
      return res.status(400).json({ message: 'Token de dispositivo requerido' });
    }
    await pool.query(
      'INSERT INTO devices (user_id, device_token) VALUES (?, ?)',
      [req.user.id, token]
    );
    res.json({ success: true });
  } catch (error) {
    console.error('Error al registrar dispositivo:', error);
    res.status(500).json({ message: 'Error al registrar dispositivo' });
  }
});

// ==========================
// Sincronización (mirror de datos)
// ==========================
// Nota: estos endpoints devuelven el mismo arreglo recibido.
// Si quieres persistencia real (upsert/bulk), lo implementamos después.
app.post('/api/sync/vehicles', authenticateToken, async (req, res) => {
  try {
    const { vehicles } = req.body;
    res.json({ vehicles: Array.isArray(vehicles) ? vehicles : [] });
  } catch (error) {
    console.error('Error en sync vehicles:', error);
    res.status(500).json({ message: 'Error al sincronizar vehículos' });
  }
});

app.post('/api/sync/maintenances', authenticateToken, async (req, res) => {
  try {
    const { maintenances } = req.body;
    res.json({ maintenances: Array.isArray(maintenances) ? maintenances : [] });
  } catch (error) {
    console.error('Error en sync maintenances:', error);
    res.status(500).json({ message: 'Error al sincronizar mantenimientos' });
  }
});

app.post('/api/sync/reminders', authenticateToken, async (req, res) => {
  try {
    const { reminders } = req.body;
    res.json({ reminders: Array.isArray(reminders) ? reminders : [] });
  } catch (error) {
    console.error('Error en sync reminders:', error);
    res.status(500).json({ message: 'Error al sincronizar recordatorios' });
  }
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});