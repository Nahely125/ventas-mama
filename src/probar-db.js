
const pool = require("./db");

async function probarConexion() {
    try {
        const resultado = await pool.query(
            "SELECT current_database() AS base_de_datos, NOW() AS fecha"
        );

        console.log("¡Conexión a PostgreSQL exitosa!");
        console.log("Base de datos:", resultado.rows[0].base_de_datos);
        console.log("Fecha del servidor:", resultado.rows[0].fecha);
    } catch (error) {
        console.error("Error al conectar con PostgreSQL:");
        console.error(error.message);
    } finally {
        await pool.end();
    }
}

probarConexion();
