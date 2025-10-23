const admin = require('firebase-admin');
const mysql = require('mysql2/promise');
require('dotenv').config();

// Inicializar Firebase Admin
const serviceAccount = require('./serviceAccountKey.json');
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();
// Ignora propiedades undefined para evitar el error de Firestore
db.settings({ ignoreUndefinedProperties: true });

// Helpers para sanear datos
const toNumberOrNull = (val) => (val === undefined || val === null ? null : Number(val));
const toStringOrNull = (val) => (val === undefined || val === null ? null : String(val));
const toTimestampOrNull = (val) => {
  if (val === undefined || val === null) return null;
  // Si ya es Date, úsalo; si es string, conviértelo
  const d = val instanceof Date ? val : new Date(val);
  return isNaN(d.getTime()) ? null : admin.firestore.Timestamp.fromDate(d);
};

// Configuración MySQL
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'mantenimiento_vehicular'
};

async function migrateData() {
  const connection = await mysql.createConnection(dbConfig);
  
  try {
    // Migrar usuarios
    const [users] = await connection.execute('SELECT * FROM users');
    for (const user of users) {
      await db.collection('users').doc(String(user.id)).set({
        username: toStringOrNull(user.username),
        email: toStringOrNull(user.email),
        // password: user.password, // recomendado NO migrar si usarás Firebase Auth
        createdAt: toTimestampOrNull(user.created_at)
      });
    }
    
    // Migrar vehículos
    const [vehicles] = await connection.execute('SELECT * FROM vehicles');
    for (const vehicle of vehicles) {
      await db.collection('vehicles').doc(String(vehicle.id)).set({
        brand: toStringOrNull(vehicle.brand),
        model: toStringOrNull(vehicle.model),
        year: toNumberOrNull(vehicle.year),
        mileage: toNumberOrNull(vehicle.mileage),
        licensePlate: toStringOrNull(vehicle.license_plate),
        userId: vehicle.user_id === undefined || vehicle.user_id === null ? null : String(vehicle.user_id),
        createdAt: toTimestampOrNull(vehicle.created_at)
      });
    }
    
    // Migrar mantenimientos
    const [maintenances] = await connection.execute('SELECT * FROM maintenances');
    for (const maintenance of maintenances) {
      await db.collection('maintenances').doc(String(maintenance.id)).set({
        vehicleId: maintenance.vehicle_id === undefined || maintenance.vehicle_id === null ? null : String(maintenance.vehicle_id),
        type: toStringOrNull(maintenance.type),
        description: toStringOrNull(maintenance.description),
        cost: toNumberOrNull(maintenance.cost),
        mileage: toNumberOrNull(maintenance.mileage),
        date: toTimestampOrNull(maintenance.date),
        userId: maintenance.user_id === undefined || maintenance.user_id === null ? null : String(maintenance.user_id),
        createdAt: toTimestampOrNull(maintenance.created_at)
      });
    }
    
    // Migrar recordatorios
    const [reminders] = await connection.execute('SELECT * FROM reminders');
    for (const reminder of reminders) {
      await db.collection('reminders').doc(String(reminder.id)).set({
        vehicleId: reminder.vehicle_id === undefined || reminder.vehicle_id === null ? null : String(reminder.vehicle_id),
        type: toStringOrNull(reminder.type),
        description: toStringOrNull(reminder.description),
        dueDate: toTimestampOrNull(reminder.due_date),
        dueMileage: toNumberOrNull(reminder.due_mileage),
        userId: reminder.user_id === undefined || reminder.user_id === null ? null : String(reminder.user_id),
        createdAt: toTimestampOrNull(reminder.created_at)
      });
    }
    
    console.log('Migración completada exitosamente');
  } catch (error) {
    console.error('Error en la migración:', error);
  } finally {
    await connection.end();
  }
}

migrateData();