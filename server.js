const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');

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
  } catch (error) {
    console.error('❌ Error creando tabla:', error);
  }
}

// Rutas
app.get('/api/personas', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM personas ORDER BY fecha DESC');
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/personas', async (req, res) => {
  const { nombre, apellido, ciudad, ocupacion, relato } = req.body;
  try {
    const result = await pool.query(
      'INSERT INTO personas (nombre, apellido, ciudad, ocupacion, relato) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [nombre, apellido, ciudad, ocupacion, relato]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/personas/buscar', async (req, res) => {
  const { nombre, ciudad } = req.query;
  try {
    let query = 'SELECT * FROM personas WHERE 1=1';
    const params = [];
    
    // Buscar en nombre Y apellido juntos
    if (nombre) {
      query += ` AND (nombre ILIKE $${params.length + 1} OR apellido ILIKE $${params.length + 1} OR CONCAT(nombre, ' ', apellido) ILIKE $${params.length + 1})`;
      params.push(`%${nombre}%`);
      params.push(`%${nombre}%`);
      params.push(`%${nombre}%`);
    }
    
    if (ciudad) {
      query += ` AND ciudad ILIKE $${params.length + 1}`;
      params.push(`%${ciudad}%`);
    }
    
    query += ' ORDER BY fecha DESC';
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/personas/:id', async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM personas WHERE id = $1 RETURNING *', [req.params.id]);
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Iniciar servidor
const PORT = process.env.PORT || 8080;

(async () => {
  try {
    console.log('✅ Conectando a BD...');
    await pool.query('SELECT NOW()'); // Probar conexión
    console.log('✅ BD conectada');
    
    await crearTabla();
    
    app.listen(PORT, () => {
      console.log(`✅ Servidor en puerto ${PORT}`);
    });
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
  // Descargar Excel con todos los datos
app.get('/api/personas/descargar/excel', async (req, res) => {
  try {
    const XLSX = require('xlsx');
    
    // Obtener todas las personas
    const result = await pool.query('SELECT * FROM personas ORDER BY fecha DESC');
    const personas = result.rows;

    // Transformar datos para Excel
    const datosExcel = personas.map(p => ({
      'ID': p.id,
      'Nombre': p.nombre,
      'Apellido': p.apellido,
      'Ciudad': p.ciudad || '',
      'Ocupación': p.ocupacion || '',
      'Relato': p.relato || '',
      'Fecha': new Date(p.fecha).toLocaleDateString('es-EC')
    }));

    // Crear workbook
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(datosExcel);
    
    // Ajustar ancho de columnas
    worksheet['!cols'] = [
      { wch: 5 },  // ID
      { wch: 15 }, // Nombre
      { wch: 15 }, // Apellido
      { wch: 15 }, // Ciudad
      { wch: 15 }, // Ocupación
      { wch: 30 }, // Relato
      { wch: 12 }  // Fecha
    ];

    XLSX.utils.book_append_sheet(workbook, worksheet, 'Personas');

    // Enviar archivo
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=registro-nacional.xlsx');
    
    const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'buffer' });
    res.send(excelBuffer);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
})();
