require("dotenv").config();

const { Pool } = require("pg");

// En la nube (Neon, Supabase, Render...) se usa DATABASE_URL con SSL.
// DB_SSL=no-verificar solo si el proveedor usa un certificado propio;
// DB_SSL=desactivado para conexiones sin SSL (red interna o pruebas locales).
// En local se usan las variables DB_HOST, DB_PORT, etc.
// Tiempos límite: si la base no responde, se devuelve un error en vez de quedarse colgado.
const TIEMPOS = {
    connectionTimeoutMillis: 10000,
    idleTimeoutMillis: 30000,
    query_timeout: 20000
};

// El SSL se configura con la opción ssl; se quita sslmode de la URL para evitar
// el aviso de pg sobre los modos de SSL (el comportamiento es el mismo: verificar).
function urlSinSslmode(url) {
    try {
        const direccion = new URL(url);
        direccion.searchParams.delete("sslmode");
        direccion.searchParams.delete("channel_binding");
        return direccion.toString();
    } catch {
        return url;
    }
}

const pool = process.env.DATABASE_URL
    ? new Pool({
        connectionString: urlSinSslmode(process.env.DATABASE_URL),
        ssl: process.env.DB_SSL === "desactivado"
            ? false
            : { rejectUnauthorized: process.env.DB_SSL !== "no-verificar" },
        ...TIEMPOS
    })
    : new Pool({
        host: process.env.DB_HOST,
        port: Number(process.env.DB_PORT),
        database: process.env.DB_NAME,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        ...TIEMPOS
    });

// Si la base de datos cierra una conexión inactiva (por ejemplo, Neon se suspende
// tras unos minutos sin uso), solo se registra el aviso: la siguiente consulta abre
// una conexión nueva. Sin esto, el error tumbaría todo el servidor.
pool.on("error", (error) => {
    console.error("Conexión con la base de datos cerrada:", error.message);
});

module.exports = pool;
