const express = require('express');
const { Client } = require('pg');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const client = new Client({
    connectionString: process.env.DATABASE_URL
});

client.connect();

console.log('✅ Conectando a BD...');

// POST - Crear registro
app.post('/api/personas', async (req, res) => {
    const { nombre, apellido, ciudad, ocupacion, relato } = req.body;
    try {
        const result = await client.query(
            'INSERT INTO personas (nombre, apellido, ciudad, ocupacion, relato) VALUES ($1, $2, $3, $4, $5) RETURNING *',
            [nombre, apellido, ciudad, ocupacion, relato]
        );
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET - Listar todos
app.get('/api/personas', async (req, res) => {
    try {
        const result = await client.query('SELECT * FROM personas ORDER BY fecha DESC');
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET - Buscar
app.get('/api/personas/buscar', async (req, res) => {
    const { nombre, ciudad } = req.query;
    try {
        let query = 'SELECT * FROM personas WHERE 1=1';
        const params = [];
        let paramCount = 1;
        
        if (nombre) {
            query += ` AND (nombre ILIKE $${paramCount} OR apellido ILIKE $${paramCount + 1})`;
            params.push(`%${nombre}%`, `%${nombre}%`);
            paramCount += 2;
        }
        
        if (ciudad) {
            query += ` AND ciudad ILIKE $${paramCount}`;
            params.push(`%${ciudad}%`);
        }
        
        query += ' ORDER BY fecha DESC';
        const result = await client.query(query, params);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// DELETE - Eliminar
app.delete('/api/personas/:id', async (req, res) => {
    try {
        await client.query('DELETE FROM personas WHERE id = $1', [req.params.id]);
        res.json({ mensaje: '✅ Eliminado' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`✅ Servidor en puerto ${PORT}`);
});
