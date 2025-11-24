require("dotenv").config();
const express = require("express");
const { Pool } = require("pg");
const cors = require("cors");
const path = require("path");
// Librerías para token
const session = require("express-session");
const crypto = require("crypto");

const app = express();
const port = process.env.PORT || 3000;

// Conexión a la base de datos Postgre en Render
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl:
    process.env.NODE_ENV === "production"
      ? { rejectUnauthorized: false }
      : false,
});

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Configurar la sesión
app.use(
  session({
    secret: "400M7S1K4",
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false, maxAge: 1000 * 60 * 60 },
  })
);

app.use(express.static("public"));

// Middleware de seguridad
app.use((req, res, next) => {
  // Si no existe un token, se crea uno
  if (!req.session.token) {
    // Generar token aleatorio
    req.session.token = crypto.randomBytes(32).toString("hex");
    console.log("Nueva sesión iniciada");
    console.log("Token generado:", req.session.token);
  }
  next();
});

// Proteger rutas
const requerirAuth = (req, res, next) => {
  if (req.session && req.session.token) {
    next();
  } else {
    res.status(403).json({ error: "Acceso denegado. No hay sesion." });
  }
};

// Inicializar tablas Playlist y Ratings si no existen
const crearTablas = async () => {
  try {
    // Tabla Playlist
    await pool.query(`
        CREATE TABLE IF NOT EXISTS playlist (
        id SERIAL PRIMARY KEY,
        track_id VARCHAR(50),
        track_name TEXT,
        artist_name TEXT,
        artwork_url TEXT,
        preview_url TEXT
      );
      `);
    // Tabla Ratings
    await pool.query(`
        CREATE TABLE IF NOT EXISTS ratings (
        track_id VARCHAR(50) PRIMARY KEY,
        rating_sum INTEGER DEFAULT 0,
        rating_count INTEGER DEFAULT 0
      );
      `);
  } catch (err) {}
};
crearTablas();

// ENDPOINTS API
// Obtener playlist guardada
app.get("/api/playlist", async (req, res) => {
  try {
    const resultado = await pool.query(
      "SELECT * FROM playlist ORDER BY id DESC"
    );
    res.json(resultado.rows);
  } catch (error) {
    res.status(500).json({ error: "Error al obtener playlist" });
  }
});

// Agregar canción a la playlist
app.post("/api/playlist", requerirAuth, async (req, res) => {
  const { track_id, track_name, artist_name, artwork_url, preview_url } =
    req.body;
  try {
    // Verificar si existe
    const existe = await pool.query(
      "SELECT * FROM playlist WHERE track_id = $1",
      [track_id]
    );
    if (existe.rows.length > 0) {
      return res
        .status(400)
        .json({ error: "La canción ya está en la playlist" });
    }

    const resultado = await pool.query(
      "INSERT INTO playlist (track_id, track_name, artist_name, artwork_url, preview_url) VALUES ($1, $2, $3, $4, $5) RETURNING *",
      [track_id, track_name, artist_name, artwork_url, preview_url]
    );
    res.json(resultado.rows[0]);
  } catch (err) {
    res.status(500).json({ error: "Error al agregar" });
  }
});

// Eliminar canción de playlist
app.delete("/api/playlist/:id", requerirAuth, async (req, res) => {
  const id = req.params.id;
  try {
    await pool.query("DELETE FROM playlist WHERE id = $1", [id]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Error al eliminar" });
  }
});

// Calificar canción (guardar o actualizar)
app.post("/api/rate", requerirAuth, async (req, res) => {
  const { track_id, rating } = req.body;
  try {
    const query = `
      INSERT INTO ratings (track_id, rating_sum, rating_count) VALUES ($1, $2, 1)
      ON CONFLICT (track_id) DO UPDATE SET 
      rating_sum = ratings.rating_sum + $2, 
      rating_count = ratings.rating_count + 1
      RETURNING *
    `;
    const resultado = await pool.query(query, [track_id, rating]);
    res.json(resultado.rows[0]);
  } catch (error) {
    res.status(500).json({ error: "Error al calificar" });
  }
});

// Obtener calificación de una canción
app.get("/api/rating/:track_id", async (req, res) => {
  const { track_id } = req.params;
  try {
    const resultado = await pool.query(
      "SELECT * FROM ratings WHERE track_id = $1",
      [track_id]
    );
    if (resultado.rows.length > 0) {
      res.json(resultado.rows[0]);
    } else {
      res.json({ rating_sum: 0, rating_count: 0 });
    }
  } catch (error) {
    res.status(500).json({ error: "Error obteniendo calificación" });
  }
});

// Iniciar servidor
app.listen(port, () => {
  console.log(`Servidor corriendo en puerto ${port}`);
});
