const functions = require('firebase-functions');
const admin = require('firebase-admin');
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// Inicializar Firebase Admin
admin.initializeApp();
const db = admin.firestore();

const app = express();

// Middleware
app.use(cors({ origin: true }));
app.use(express.json());

// JWT Secret (usar Firebase Config en producción)
const JWT_SECRET = functions.config().jwt?.secret || 'Fr103xpr355';

// Middleware de autenticación
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Token de acceso requerido' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Token inválido' });
    }
    req.user = user;
    next();
  });
}

// Rutas de autenticación
app.post('/auth/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;
    
    // Verificar si el usuario ya existe
    const usersRef = db.collection('users');
    const existingUser = await usersRef.where('email', '==', email).get();
    
    if (!existingUser.empty) {
      return res.status(400).json({ error: 'El usuario ya existe' });
    }

    // Hashear la contraseña
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Crear usuario en Firestore
    const userRef = await usersRef.add({
      username,
      email,
      password: hashedPassword,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });

    // Generar token JWT
    const token = jwt.sign(
      { userId: userRef.id, email },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.status(201).json({
      message: 'Usuario registrado exitosamente',
      token,
      user: { id: userRef.id, username, email }
    });
  } catch (error) {
    console.error('Error en registro:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

app.post('/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    // Buscar usuario
    const usersRef = db.collection('users');
    const userQuery = await usersRef.where('email', '==', email).get();
    
    if (userQuery.empty) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    const userDoc = userQuery.docs[0];
    const userData = userDoc.data();
    
    // Verificar contraseña
    const validPassword = await bcrypt.compare(password, userData.password);
    if (!validPassword) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    // Generar token JWT
    const token = jwt.sign(
      { userId: userDoc.id, email: userData.email },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      message: 'Login exitoso',
      token,
      user: { 
        id: userDoc.id, 
        username: userData.username, 
        email: userData.email 
      }
    });
  } catch (error) {
    console.error('Error en login:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

app.post('/auth/google', async (req, res) => {
  try {
    const { idToken } = req.body;
    if (!idToken) {
      return res.status(400).json({ error: 'idToken requerido' });
    }

    const decoded = await admin.auth().verifyIdToken(idToken);
    const email = decoded.email;

    const usersRef = db.collection('users');
    const query = await usersRef.where('email', '==', email).get();

    let userId;
    let userData;
    if (query.empty) {
      const username = decoded.name || email;
      const userRef = await usersRef.add({
        username,
        email,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });
      userId = userRef.id;
      userData = { username, email };
    } else {
      userId = query.docs[0].id;
      userData = query.docs[0].data();
    }

    const token = jwt.sign(
      { userId, email },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      token,
      user: { id: userId, username: userData.username || '', email }
    });
  } catch (error) {
    console.error('Error en auth/google:', error);
    res.status(401).json({ error: 'ID token inválido' });
  }
});
// Rutas de vehículos
app.get('/vehicles', authenticateToken, async (req, res) => {
  try {
    const vehiclesRef = db.collection('vehicles');
    const snapshot = await vehiclesRef.where('userId', '==', req.user.userId).get();
    
    const vehicles = [];
    snapshot.forEach(doc => {
      vehicles.push({ id: doc.id, ...doc.data() });
    });
    
    res.json(vehicles);
  } catch (error) {
    console.error('Error al obtener vehículos:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

app.post('/vehicles', authenticateToken, async (req, res) => {
  try {
    const { brand, model, year, mileage, licensePlate } = req.body;
    
    const vehicleData = {
      brand,
      model,
      year: parseInt(year),
      mileage: parseInt(mileage),
      licensePlate,
      userId: req.user.userId,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    };
    
    const docRef = await db.collection('vehicles').add(vehicleData);
    
    res.status(201).json({
      message: 'Vehículo creado exitosamente',
      vehicle: { id: docRef.id, ...vehicleData }
    });
  } catch (error) {
    console.error('Error al crear vehículo:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

app.put('/vehicles/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { brand, model, year, mileage, licensePlate } = req.body;
    
    const vehicleRef = db.collection('vehicles').doc(id);
    const vehicleDoc = await vehicleRef.get();
    
    if (!vehicleDoc.exists) {
      return res.status(404).json({ error: 'Vehículo no encontrado' });
    }
    
    if (vehicleDoc.data().userId !== req.user.userId) {
      return res.status(403).json({ error: 'No autorizado' });
    }
    
    await vehicleRef.update({
      brand,
      model,
      year: parseInt(year),
      mileage: parseInt(mileage),
      licensePlate,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    
    res.json({ message: 'Vehículo actualizado exitosamente' });
  } catch (error) {
    console.error('Error al actualizar vehículo:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

app.delete('/vehicles/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    const vehicleRef = db.collection('vehicles').doc(id);
    const vehicleDoc = await vehicleRef.get();
    
    if (!vehicleDoc.exists) {
      return res.status(404).json({ error: 'Vehículo no encontrado' });
    }
    
    if (vehicleDoc.data().userId !== req.user.userId) {
      return res.status(403).json({ error: 'No autorizado' });
    }
    
    // Eliminar mantenimientos relacionados
    const maintenancesSnapshot = await db.collection('maintenances')
      .where('vehicleId', '==', id).get();
    
    const batch = db.batch();
    maintenancesSnapshot.forEach(doc => {
      batch.delete(doc.ref);
    });
    
    // Eliminar recordatorios relacionados
    const remindersSnapshot = await db.collection('reminders')
      .where('vehicleId', '==', id).get();
    
    remindersSnapshot.forEach(doc => {
      batch.delete(doc.ref);
    });
    
    // Eliminar vehículo
    batch.delete(vehicleRef);
    
    await batch.commit();
    
    res.json({ message: 'Vehículo eliminado exitosamente' });
  } catch (error) {
    console.error('Error al eliminar vehículo:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Rutas de mantenimientos
app.get('/maintenances', authenticateToken, async (req, res) => {
  try {
    const { vehicleId } = req.query;
    
    let query = db.collection('maintenances');
    if (vehicleId) {
      query = query.where('vehicleId', '==', vehicleId);
    }
    
    const snapshot = await query.orderBy('date', 'desc').get();
    
    const maintenances = [];
    snapshot.forEach(doc => {
      const data = doc.data();
      maintenances.push({
        id: doc.id,
        ...data,
        date: data.date?.toDate?.() || data.date
      });
    });
    
    res.json(maintenances);
  } catch (error) {
    console.error('Error al obtener mantenimientos:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

app.post('/maintenances', authenticateToken, async (req, res) => {
  try {
    const { vehicleId, type, description, cost, mileage, date } = req.body;
    
    const maintenanceData = {
      vehicleId,
      type,
      description,
      cost: parseFloat(cost),
      mileage: parseInt(mileage),
      date: admin.firestore.Timestamp.fromDate(new Date(date)),
      userId: req.user.userId,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    };
    
    const docRef = await db.collection('maintenances').add(maintenanceData);
    
    // Crear recordatorio automático para "Cambio de Aceite"
    if (type === 'Cambio de Aceite') {
      const reminderData = {
        vehicleId,
        type: 'Cambio de Aceite',
        description: 'Recordatorio automático: Próximo cambio de aceite',
        dueDate: admin.firestore.Timestamp.fromDate(
          new Date(Date.now() + (90 * 24 * 60 * 60 * 1000)) // 90 días
        ),
        dueMileage: parseInt(mileage) + 5000,
        userId: req.user.userId,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      };
      
      await db.collection('reminders').add(reminderData);
    }
    
    res.status(201).json({
      message: 'Mantenimiento creado exitosamente',
      maintenance: { id: docRef.id, ...maintenanceData }
    });
  } catch (error) {
    console.error('Error al crear mantenimiento:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Rutas de recordatorios
app.get('/reminders', authenticateToken, async (req, res) => {
  try {
    const { vehicleId } = req.query;
    
    let query = db.collection('reminders');
    if (vehicleId) {
      query = query.where('vehicleId', '==', vehicleId);
    }
    
    const snapshot = await query.orderBy('dueDate', 'asc').get();
    
    const reminders = [];
    snapshot.forEach(doc => {
      const data = doc.data();
      reminders.push({
        id: doc.id,
        ...data,
        dueDate: data.dueDate?.toDate?.() || data.dueDate
      });
    });
    
    res.json(reminders);
  } catch (error) {
    console.error('Error al obtener recordatorios:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

app.post('/reminders', authenticateToken, async (req, res) => {
  try {
    const { vehicleId, type, description, dueDate, dueMileage } = req.body;
    
    const reminderData = {
      vehicleId,
      type,
      description,
      dueDate: admin.firestore.Timestamp.fromDate(new Date(dueDate)),
      dueMileage: dueMileage ? parseInt(dueMileage) : null,
      userId: req.user.userId,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    };
    
    const docRef = await db.collection('reminders').add(reminderData);
    
    res.status(201).json({
      message: 'Recordatorio creado exitosamente',
      reminder: { id: docRef.id, ...reminderData }
    });
  } catch (error) {
    console.error('Error al crear recordatorio:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

app.delete('/reminders/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    const reminderRef = db.collection('reminders').doc(id);
    const reminderDoc = await reminderRef.get();
    
    if (!reminderDoc.exists) {
      return res.status(404).json({ error: 'Recordatorio no encontrado' });
    }
    
    if (reminderDoc.data().userId !== req.user.userId) {
      return res.status(403).json({ error: 'No autorizado' });
    }
    
    await reminderRef.delete();
    
    res.json({ message: 'Recordatorio eliminado exitosamente' });
  } catch (error) {
    console.error('Error al eliminar recordatorio:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Exportar la función
exports.api = functions.https.onRequest(app);