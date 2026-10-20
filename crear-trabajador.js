
require("dotenv").config();

const bcrypt = require("bcrypt");
const pool = require("./src/db");
const readline = require("readline/promises");

const terminal = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

async function crearTrabajador() {
    try {
        console.log("\n=== Crear cuenta del trabajador ===\n");

        const nombre = (
            await terminal.question("Nombre del trabajador: ")
        ).trim();

        const usuario = (
            await terminal.question("Nombre de usuario: ")
        ).trim();

        const password = await terminal.question(
            "Contrasena del trabajador: "
        );

        if (!nombre || !usuario || !password) {
            console.log("Todos los campos son obligatorios.");
            return;
        }

        if (password.length < 12) {
            console.log(
                "La contrasena debe tener al menos 12 caracteres."
            );
            return;
        }

        const hash = await bcrypt.hash(password, 12);

        const resultado = await pool.query(
            `INSERT INTO usuarios
                (usuario, nombre, password_hash, rol)
             VALUES ($1, $2, $3, 'trabajador')
             RETURNING id, usuario, nombre, rol`,
            [usuario, nombre, hash]
        );

        console.log("\nCuenta creada correctamente:");
        console.log(resultado.rows[0]);
    } catch (error) {
        if (error.code === "23505") {
            console.log(
                "Ese nombre de usuario ya existe. Prueba otro."
            );
        } else {
            console.error(
                "No se pudo crear la cuenta:",
                error.message
            );
        }
    } finally {
        terminal.close();
        await pool.end();
    }
}

crearTrabajador();
