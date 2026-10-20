require("dotenv").config();

const express = require("express");
const path = require("path");
const session = require("express-session");
const AlmacenSesiones = require("connect-pg-simple")(session);
const bcrypt = require("bcrypt");

const pool = require("./db");
const ejecutarMigraciones = require("./migraciones");
const { usuarioVigente, requiereSesion } = require("./autenticacion");

const app = express();
const PORT = process.env.PORT || 3000;
const enProduccion = process.env.NODE_ENV === "production";

if (!process.env.SESSION_SECRET) {
    console.error("Falta la variable SESSION_SECRET.");
    process.exit(1);
}

// En el hosting la app está detrás de un proxy HTTPS.
if (enProduccion) {
    app.set("trust proxy", 1);
}

app.use(express.json());

// Las sesiones se guardan en PostgreSQL (tabla "session") para que no se
// pierdan cuando el servidor se reinicia.
app.use(session({
    store: new AlmacenSesiones({
        pool,
        tableName: "session",
        createTableIfMissing: true
    }),
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
        httpOnly: true,
        secure: enProduccion,
        sameSite: "lax",
        maxAge: 1000 * 60 * 60 * 8
    }
}));

/* Sesión */

app.post("/api/login", async (req, res) => {
    try {
        const { usuario, password } = req.body;

        if (
            typeof usuario !== "string" ||
            typeof password !== "string" ||
            !usuario.trim() ||
            !password
        ) {
            return res.status(400).json({
                error: "Ingresa tu usuario y contraseña."
            });
        }

        const resultado = await pool.query(
            `SELECT id, usuario, nombre, password_hash, rol
             FROM usuarios
             WHERE usuario = $1 AND activo = TRUE`,
            [usuario.trim()]
        );

        const cuenta = resultado.rows[0];
        const passwordValida = cuenta
            ? await bcrypt.compare(password, cuenta.password_hash)
            : false;

        if (!passwordValida) {
            return res.status(401).json({
                error: "Usuario o contraseña incorrectos."
            });
        }

        req.session.regenerate((error) => {
            if (error) {
                console.error("Error al crear la sesión:", error.message);
                return res.status(500).json({
                    error: "No se pudo iniciar la sesión."
                });
            }

            req.session.usuario = {
                id: cuenta.id,
                usuario: cuenta.usuario,
                nombre: cuenta.nombre,
                rol: cuenta.rol
            };

            req.session.save((errorGuardar) => {
                if (errorGuardar) {
                    console.error("Error al guardar la sesión:", errorGuardar.message);
                    return res.status(500).json({
                        error: "No se pudo guardar la sesión."
                    });
                }

                res.json({
                    mensaje: "Sesión iniciada correctamente.",
                    usuario: req.session.usuario
                });
            });
        });
    } catch (error) {
        console.error("Error al iniciar sesión:", error.message);
        res.status(500).json({
            error: "Ocurrió un error al iniciar sesión."
        });
    }
});

app.get("/api/sesion", async (req, res) => {
    try {
        const usuario = await usuarioVigente(req);

        if (!usuario) {
            return res.status(401).json({
                autenticado: false,
                error: "No has iniciado sesión."
            });
        }

        res.json({ autenticado: true, usuario });
    } catch (error) {
        console.error("Error al consultar la sesión:", error.message);
        res.status(500).json({ error: "No se pudo verificar la sesión." });
    }
});

app.post("/api/logout", (req, res) => {
    req.session.destroy((error) => {
        if (error) {
            console.error("Error al cerrar sesión:", error.message);
            return res.status(500).json({
                error: "No se pudo cerrar la sesión."
            });
        }

        res.clearCookie("connect.sid");
        res.json({ mensaje: "Sesión cerrada correctamente." });
    });
});

/* API */

app.use("/api/productos", require("./rutas/productos").router);
app.use("/api/ventas", require("./rutas/ventas"));
app.use("/api/resumen", require("./rutas/resumen"));
app.use("/api/usuarios", require("./rutas/usuarios"));
app.use("/api/gastos", require("./rutas/gastos"));
app.use("/api/inversiones", require("./rutas/inversiones"));

/* Frontend en React: archivos compilados con "npm run build" en client/dist.
   La propia app decide si mostrar el login o el panel según /api/sesion. */

const carpetaFrontend = path.join(__dirname, "..", "client", "dist");

app.get("/imagenes/qr-yape.png", requiereSesion, (req, res) => {
    res.sendFile(
        path.join(__dirname, "..", "public", "imagenes", "qr-yape.png")
    );
});

app.use(express.static(carpetaFrontend, { index: false }));

app.get("/", (req, res) => {
    res.sendFile(path.join(carpetaFrontend, "index.html"));
});

// Iniciar servidor (primero se actualiza la estructura de la base de datos).
ejecutarMigraciones()
    .then(() => {
        app.listen(PORT, () => {
            console.log(`Servidor iniciado en http://localhost:${PORT}`);
        });
    })
    .catch((error) => {
        console.error("No se pudo actualizar la base de datos:", error.message);
        process.exit(1);
    });
