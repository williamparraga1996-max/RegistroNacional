const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const XLSX = require('xlsx');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Conexión a PostgreSQL usando DATABASE_URL
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false } // Necesario para Railway
});

// Crear tabla si no existe
async function crearTabla() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS personas (
        id SERIAL PRIMARY KEY,
        nombre VARCHAR(100) NOT NULL,
        apellido VARCHAR(100) NOT NULL,
        ciudad VARCHAR(100),
        ocupacion VARCHAR(100),
        relato TEXT,
        fecha TIMESTAMP DEFAULT NOW()
      )
    `);
    console.log('✅ Tabla personas lista');

    // 👇 Cambiar tipo de dato de fecha a TIMESTAMP si está como DATE
    await pool.query(`
      ALTER TABLE personas
      ALTER COLUMN fecha TYPE TIMESTAMP DEFAULT NOW()
    `);
    console.log('✅ Columna fecha convertida a TIMESTAMP');

  } catch (error) {
    console.error('❌ Error creando tabla:', error);
  }
}

// ============================================
// 📋 ENDPOINT 1: LISTAR TODOS
// ============================================
app.get('/api/personas', async (req, res) => {
  try {
    // 👇 ORDENAMIENTO POR ID DESC (más nuevos/altos primero)
    const result = await pool.query('SELECT * FROM personas ORDER BY id DESC');
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// ✏️ ENDPOINT 2: CREAR REGISTRO
// ============================================
app.post('/api/personas', async (req, res) => {
  const { nombre, apellido, ciudad, ocupacion, relato } = req.body;
  try {
    // 👇 Asignar fecha y hora explícitamente con NOW()
    const result = await pool.query(
      'INSERT INTO personas (nombre, apellido, ciudad, ocupacion, relato, fecha) VALUES ($1, $2, $3, $4, $5, NOW()) RETURNING id, nombre, apellido, ciudad, ocupacion, relato, fecha',
      [nombre, apellido, ciudad, ocupacion, relato]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// 🔍 ENDPOINT 3: BUSCAR AVANZADO
// ============================================
app.get('/api/personas/buscar', async (req, res) => {
  const { nombre, ciudad } = req.query;
  try {
    let query = 'SELECT * FROM personas WHERE 1=1';
    const params = [];
    
    // Búsqueda en nombre O apellido (solo 1 parámetro)
    if (nombre) {
      const searchTerm = `%${nombre}%`;
      query += ` AND (nombre ILIKE $1 OR apellido ILIKE $1)`;
      params.push(searchTerm);
    }
    
    // Búsqueda en ciudad
    if (ciudad) {
      query += ` AND ciudad ILIKE $${params.length + 1}`;
      params.push(`%${ciudad}%`);
    }
    
    // 👇 ORDENAMIENTO POR ID DESC (más nuevos/altos primero)
    query += ' ORDER BY id DESC';
    
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// 📊 ENDPOINT 4: DESCARGAR EXCEL
// ============================================
app.get('/api/personas/descargar/excel', async (req, res) => {
  try {
    // 👇 ORDENAMIENTO POR ID DESC (más nuevos/altos primero)
    const result = await pool.query('SELECT * FROM personas ORDER BY id DESC');
    const personas = result.rows;

    // Formatear datos para Excel
    const datosExcel = personas.map(p => ({
      'ID': p.id,
      'Nombre': p.nombre,
      'Apellido': p.apellido,
      'Ciudad': p.ciudad || '',
      'Ocupación': p.ocupacion || '',
      'Relato': p.relato || '',
      'Fecha': p.fecha ? new Date(p.fecha).toLocaleDateString('es-EC') : ''
    }));

    // Crear workbook
    const ws = XLSX.utils.json_to_sheet(datosExcel);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Registro');

    // Ajustar ancho de columnas
    ws['!cols'] = [
      { wch: 5 },   // ID
      { wch: 15 },  // Nombre
      { wch: 15 },  // Apellido
      { wch: 15 },  // Ciudad
      { wch: 15 },  // Ocupación
      { wch: 40 },  // Relato
      { wch: 12 }   // Fecha
    ];

    // Enviar como buffer
    const buffer = XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' });
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=registro-nacional.xlsx');
    res.send(buffer);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// Iniciar servidor
// ============================================
const PORT = process.env.PORT || 8080;

(async () => {
  try {
    console.log('✅ Conectando a BD...');
    await pool.query('SELECT NOW()'); // Probar conexión
    console.log('✅ BD conectada');
    
    await crearTabla();

    // 👇 Llenar fechas NULL con NOW()
    await pool.query(`
      UPDATE personas
      SET fecha = NOW()
      WHERE fecha IS NULL
    `);
    console.log('✅ Fechas NULL actualizadas');
    
    app.listen(PORT, () => {
      console.log(`✅ Servidor en puerto ${PORT}`);
    });
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
})();
