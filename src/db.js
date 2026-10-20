require("dotenv").config();

const { Pool } = require("pg");

// En la nube (Neon, Supabase, Render...) se usa DATABASE_URL con SSL.
// DB_SSL=no-verificar solo si el proveedor usa un certificado propio;
// DB_SSL=desactivado para conexiones sin SSL (red interna o pruebas locales).
// En local se usan las variables DB_HOST, DB_PORT, etc.
const pool = process.env.DATABASE_URL
    ? new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: process.env.DB_SSL === "desactivado"
            ? false
            : { rejectUnauthorized: process.env.DB_SSL !== "no-verificar" }
    })
    : new Pool({
        host: process.env.DB_HOST,
        port: Number(process.env.DB_PORT),
        database: process.env.DB_NAME,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD
    });

module.exports = pool;
