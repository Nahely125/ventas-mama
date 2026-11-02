require("dotenv").config();

const express = require("express");
const compression = require("compression");
const path = require("path");
const fs = require("fs");
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

// 3 MB: alcanza para la foto de un producto ya reducida por el navegador.
// Respuestas comprimidas (el motor que edita las fotos pesa ~14 MB; comprimido, ~4 MB).
app.use(compression());
app.use(express.json({ limit: "5mb" }));

// Revisión de estado para el hosting: responde 200 si el servidor y la base de datos funcionan.
// Va antes de las sesiones para no crear ni leer sesiones en cada revisión.
// Si la base tarda más de 5 s, responde 503 en lugar de dejar esperando al hosting.
app.get("/api/salud", async (req, res) => {
    let temporizador;

    try {
        await Promise.race([
            pool.query("SELECT 1"),
            new Promise((_, rechazar) => {
                temporizador = setTimeout(() => rechazar(new Error("la base de datos no respondió en 5 s")), 5000);
            })
        ]);
        res.json({ estado: "ok" });
    } catch (error) {
        console.error("Revisión de estado fallida:", error.message);
        res.status(503).json({ estado: "sin base de datos" });
    } finally {
        clearTimeout(temporizador);
    }
});

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

app.use("/api/publico", require("./rutas/publico"));
app.use("/api/productos", require("./rutas/productos").router);
app.use("/api/ventas", require("./rutas/ventas").router);
app.use("/api/resumen", require("./rutas/resumen"));
app.use("/api/usuarios", require("./rutas/usuarios"));
app.use("/api/gastos", require("./rutas/gastos"));
app.use("/api/secciones", require("./rutas/secciones"));
app.use("/api/clientes", require("./rutas/clientes").router);
app.use("/api/compras", require("./rutas/compras"));
app.use("/api/inversiones", require("./rutas/inversiones"));
app.use("/api/ajustes", require("./rutas/ajustes").router);
app.use("/api/reportes", require("./rutas/reportes"));
const tienda = require("./rutas/tienda");
app.use("/api/tienda", tienda.router);

/* Frontend en React: archivos compilados con "npm run build" en client/dist.
   La propia app decide si mostrar el login o el panel según /api/sesion. */

const carpetaFrontend = path.join(__dirname, "..", "client", "dist");

// Códigos QR de pago (solo con sesión iniciada).
const IMAGENES_PERMITIDAS = ["qr-yape.png", "qr-plin.png"];

app.get("/imagenes/:archivo", requiereSesion, (req, res) => {
    if (!IMAGENES_PERMITIDAS.includes(req.params.archivo)) {
        return res.status(404).end();
    }

    res.sendFile(
        path.join(__dirname, "..", "public", "imagenes", req.params.archivo)
    );
});

app.use(express.static(carpetaFrontend, {
    index: false,
    setHeaders(res, ruta) {
        if (ruta.includes(`${path.sep}assets${path.sep}`)) {
            res.set("Cache-Control", "public, max-age=31536000, immutable");
        } else if (!ruta.endsWith(".html")) {
            res.set("Cache-Control", "public, max-age=604800");
        }
    }
}));

// Páginas de la app React: el panel y las boletas.
app.get(["/", "/boleta/:token"], (req, res) => {
    // La página siempre se revisa: así, al publicar una versión nueva, se ve enseguida.
    res.set("Cache-Control", "no-cache");
    res.sendFile(path.join(carpetaFrontend, "index.html"));
});

function escaparHtml(texto) {
    return String(texto).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}

/* Catálogo: la misma página, pero con la vista previa para cuando se comparte el enlace
   por WhatsApp o redes (título, descripción con las promociones vigentes e imagen). */
app.get("/catalogo", async (req, res) => {
    try {
        const html = await fs.promises.readFile(path.join(carpetaFrontend, "index.html"), "utf8");
        const datos = await tienda.leerTienda();
        const origen = process.env.URL_PUBLICA || `${req.protocol}://${req.get("host")}`;
        const promociones = [
            datos.cupon.activo && `${datos.cupon.porcentaje}% OFF en tu primera compra con el código ${datos.cupon.codigo}`,
            datos.envio.activo && `envío gratis en compras mayores a S/ ${Number(datos.envio.gratisDesde).toString()}`
        ].filter(Boolean).join(" · ");
        const titulo = "Mil Deseos | Adornos, luces, útiles y regalos";
        const descripcion = `${promociones ? `${promociones[0].toUpperCase()}${promociones.slice(1)}. ` : ""}Precios por unidad, media docena y docena. Arma tu pedido y envíalo por WhatsApp.`;
        const etiquetas = [
            `<meta name="description" content="${escaparHtml(descripcion)}">`,
            `<meta property="og:type" content="website">`,
            `<meta property="og:site_name" content="Mil Deseos">`,
            `<meta property="og:locale" content="es_PE">`,
            `<meta property="og:title" content="${escaparHtml(titulo)}">`,
            `<meta property="og:description" content="${escaparHtml(descripcion)}">`,
            `<meta property="og:url" content="${escaparHtml(`${origen}/catalogo`)}">`,
            `<meta property="og:image" content="${escaparHtml(`${origen}/compartir.jpg`)}">`,
            `<meta property="og:image:width" content="1200">`,
            `<meta property="og:image:height" content="630">`,
            `<meta property="og:image:alt" content="Mil Deseos: adornos, luces, útiles y regalos">`,
            `<meta name="twitter:card" content="summary_large_image">`
        ].join("\n    ");

        res.set("Cache-Control", "no-cache");
        res.type("html").send(
            html
                .replace("<title>Mil Deseos</title>", `<title>${escaparHtml(titulo)}</title>`)
                .replace("<!--vista-previa-->", etiquetas)
                // Si un cliente lo agrega a su pantalla de inicio, que abra el catálogo (no el login).
                .replace("/manifest.webmanifest", "/manifest-catalogo.webmanifest")
        );
    } catch (error) {
        console.error("Error al preparar el catálogo:", error.message);
        res.sendFile(path.join(carpetaFrontend, "index.html"));
    }
});

// Iniciar servidor (primero se actualiza la estructura de la base de datos).
const inicio = Date.now();
console.log("Conectando con la base de datos y revisando su estructura...");

ejecutarMigraciones()
    .then(() => {
        console.log(`Base de datos lista en ${Date.now() - inicio} ms.`);
        app.listen(PORT, "0.0.0.0", () => {
            console.log(`Servidor iniciado en http://localhost:${PORT}`);
        });
    })
    .catch((error) => {
        console.error("No se pudo actualizar la base de datos:", error.message);
        process.exit(1);
    });
