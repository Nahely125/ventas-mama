const express = require("express");
const pool = require("./db");
const session = require("express-session");
const bcrypt = require("bcrypt");

const app = express();
const PORT = 3000;

app.use(express.json());

app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
        httpOnly: true,
        secure: false,
        sameSite: "lax",
        maxAge: 1000 * 60 * 60 * 8
    }
}));

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

        if (resultado.rows.length === 0) {
            return res.status(401).json({
                error: "Usuario o contraseña incorrectos."
            });
        }

        const cuenta = resultado.rows[0];
        const passwordValida = await bcrypt.compare(
            password,
            cuenta.password_hash
        );

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
                    console.error(
                        "Error al guardar la sesión:",
                        errorGuardar.message
                    );

                    return res.status(500).json({
                        error: "No se pudo guardar la sesión."
                    });
                }

                return res.json({
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

app.get("/api/sesion", (req, res) => {
    if (!req.session.usuario) {
        return res.status(401).json({
            autenticado: false,
            error: "No has iniciado sesión."
        });
    }

    res.json({
        autenticado: true,
        usuario: req.session.usuario
    });
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

        res.json({
            mensaje: "Sesión cerrada correctamente."
        });
    });
});

function requiereSesion(req, res, next) {
    if (!req.session.usuario) {
        return res.status(401).json({
            error: "Debes iniciar sesión para continuar."
        });
    }

    next();
}

function requiereJefe(req, res, next) {
    if (!req.session.usuario) {
        return res.status(401).json({
            error: "Debes iniciar sesión para continuar."
        });
    }

    if (req.session.usuario.rol !== "jefe") {
        return res.status(403).json({
            error: "No tienes permisos para realizar esta acción."
        });
    }

    next();
}


 // Ruta principal: mostrar la pantalla correspondiente.
app.get("/", (req, res) => {
    if (!req.session.usuario) {
        return res.sendFile(
            process.cwd() + "/public/login.html"
        );
    }

    res.sendFile(
        process.cwd() + "/public/index.html"
    );
});

app.get("/styles.css", (req, res) => {
    res.sendFile(process.cwd() + "/public/styles.css");
});

app.get("/login.js", (req, res) => {
    res.sendFile(process.cwd() + "/public/login.js");
});

app.get("/app.js", requiereSesion, (req, res) => {
    res.sendFile(process.cwd() + "/public/app.js");
});

app.get("/index.html", (req, res) => {
    res.redirect("/");
});


// Consultar todos los productos.
app.get("/api/productos", requiereSesion, async (req, res) => {
    try {
        let consulta;

        if (req.session.usuario.rol === "jefe") {
            consulta = `
                SELECT
                    id,
                    nombre,
                    precio,
                    precio_minimo AS "precioMinimo",
                    
                    precio_compra AS "precioCompra",
                    unidades_por_caja AS "unidadesPorCaja",
                    stock

                FROM productos
                ORDER BY id
            `;
        } else {
            consulta = `
                SELECT
                    id,
                    nombre,
                    precio,
                    stock
                FROM productos
                ORDER BY id
            `;
        }

        const resultado = await pool.query(consulta);

        res.json(resultado.rows);
    } catch (error) {
        console.error("Error al consultar los productos:", error.message);

        res.status(500).json({
            error: "Error al consultar los productos"
        });
    }
});



 // Consultar productos con stock bajo.
app.get("/api/productos/stock-bajo", requiereSesion, async (req, res) => {
    try {
        let consulta;

        if (req.session.usuario.rol === "jefe") {
            consulta = `
                SELECT
                    id,
                    nombre,
                    precio,
                    precio_minimo AS "precioMinimo",
                    stock,
                    GREATEST(5 - stock, 0) AS "unidadesParaReponer"
                FROM productos
                WHERE stock <= 5
                ORDER BY stock ASC
            `;
        } else {
            consulta = `
                SELECT
                    id,
                    nombre,
                    precio,
                    stock,
                    GREATEST(5 - stock, 0) AS "unidadesParaReponer"
                FROM productos
                WHERE stock <= 5
                ORDER BY stock ASC
            `;
        }

        const resultado = await pool.query(consulta);
        res.json(resultado.rows);
    } catch (error) {
        console.error(error.message);
        res.status(500).json({
            error: "Error al consultar productos con stock bajo"
        });
    }
});



// Buscar productos por nombre.
app.get("/api/productos/buscar/:nombre", requiereSesion, async (req, res) => {
    try {
        const nombre = req.params.nombre.trim();

        if (nombre === "") {
            return res.status(400).json({
                error: "Debes indicar el nombre del producto"
            });
        }

        let consulta;

        if (req.session.usuario.rol === "jefe") {
            consulta = `
                SELECT
                    id,
                    nombre,
                    precio,
                    precio_minimo AS "precioMinimo",
                    stock
                FROM productos
                WHERE nombre ILIKE $1
                ORDER BY nombre ASC
            `;
        } else {
            consulta = `
                SELECT
                    id,
                    nombre,
                    precio,
                    stock
                FROM productos
                WHERE nombre ILIKE $1
                ORDER BY nombre ASC
            `;
        }

        const resultado = await pool.query(consulta, [`%${nombre}%`]);
        res.json(resultado.rows);
    } catch (error) {
        console.error(error.message);
        res.status(500).json({
            error: "Error al buscar productos por nombre"
        });
    }
});



 // Buscar un producto por su ID.
app.get("/api/productos/:id", requiereSesion, async (req, res) => {
    try {
        const id = Number(req.params.id);

        if (!Number.isInteger(id) || id <= 0) {
            return res.status(400).json({
                error: "ID de producto inválido"
            });
        }

        let consulta;

        if (req.session.usuario.rol === "jefe") {
            consulta = `
                SELECT
                    id,
                    nombre,
                    precio,
                    precio_minimo AS "precioMinimo",
                    stock
                FROM productos
                WHERE id = $1
            `;
        } else {
            consulta = `
                SELECT
                    id,
                    nombre,
                    precio,
                    stock
                FROM productos
                WHERE id = $1
            `;
        }

        const resultado = await pool.query(consulta, [id]);

        if (resultado.rows.length === 0) {
            return res.status(404).json({
                error: "Producto no encontrado"
            });
        }

        res.json(resultado.rows[0]);
    } catch (error) {
        console.error(error.message);
        res.status(500).json({
            error: "Error al buscar el producto"
        });
    }
});

 
// Registrar un producto nuevo.
app.post("/api/productos", requiereJefe, async (req, res) => {
    try {
        const {
            nombre,
            precio,
            precioMinimo,
            precioCompra,
            unidadesPorCaja,
            stock
        } = req.body;

        if (
            typeof nombre !== "string" ||
            nombre.trim() === "" ||
            typeof precio !== "number" ||
            typeof precioMinimo !== "number" ||
            typeof precioCompra !== "number" ||
            typeof unidadesPorCaja !== "number" ||
            typeof stock !== "number" ||
            !Number.isFinite(precio) ||
            !Number.isFinite(precioMinimo) ||
            !Number.isFinite(precioCompra) ||
            !Number.isInteger(unidadesPorCaja) ||
            !Number.isInteger(stock) ||
            precio < 0 ||
            precioMinimo < 0 ||
            precioCompra < 0 ||
            unidadesPorCaja < 1 ||
            stock < 0 ||
            precio < precioMinimo
        ) {
            return res.status(400).json({
                error: "Datos inválidos. Verifica el nombre, los precios, las unidades por caja y el stock."
            });
        }

        // El precioCompra recibido es el precio de compra
        // de una unidad o de la caja completa.
        const costoUnitario = precioCompra / unidadesPorCaja;

        const resultado = await pool.query(
            `INSERT INTO productos
                (
                    nombre,
                    precio,
                    precio_minimo,
                    precio_compra,
                    unidades_por_caja,
                    stock
                )
             VALUES ($1, $2, $3, $4, $5, $6)
             RETURNING
                id,
                nombre,
                precio,
                precio_minimo AS "precioMinimo",
                precio_compra AS "precioCompra",
                unidades_por_caja AS "unidadesPorCaja",
                stock`,
            [
                nombre.trim(),
                precio,
                precioMinimo,
                Number(costoUnitario.toFixed(2)),
                unidadesPorCaja,
                stock
            ]
        );

        res.status(201).json({
            mensaje: "Producto registrado correctamente",
            producto: resultado.rows[0]
        });
    } catch (error) {
        console.error("Error al registrar el producto:", error.message);

        res.status(500).json({
            error: "Error al registrar el producto"
        });
    }
});


 // Actualizar un producto existente.

        app.put("/api/productos/:id", requiereJefe, async (req, res) => {
            try {
                const id = Number(req.params.id);

                const {
                    nombre,
                    precio,
                    precioMinimo,
                    precioCompra,
                    unidadesPorCaja,
                    stock
                } = req.body;

                if (!Number.isInteger(id) || id <= 0) {
                    return res.status(400).json({
                        error: "ID de producto inválido"
                    });
                }

                if (
                    typeof nombre !== "string" ||
                    nombre.trim() === "" ||
                    typeof precio !== "number" ||
                    typeof precioMinimo !== "number" ||
                    typeof precioCompra !== "number" ||
                    typeof unidadesPorCaja !== "number" ||
                    typeof stock !== "number" ||
                    !Number.isFinite(precio) ||
                    !Number.isFinite(precioMinimo) ||
                    !Number.isFinite(precioCompra) ||
                    !Number.isInteger(unidadesPorCaja) ||
                    !Number.isInteger(stock) ||
                    precio < 0 ||
                    precioMinimo < 0 ||
                    precioCompra < 0 ||
                    unidadesPorCaja < 1 ||
                    stock < 0 ||
                    precio < precioMinimo
                ) {
                    return res.status(400).json({
                        error: "Datos inválidos. Verifica nombre, precios, unidades por caja y stock."
                    });
                }

                const costoUnitario = Number(
                    (precioCompra / unidadesPorCaja).toFixed(2)
                );

                const resultado = await pool.query(
                    `UPDATE productos
                    SET nombre = $1,
                        precio = $2,
                        precio_minimo = $3,
                        precio_compra = $4,
                        unidades_por_caja = $5,
                        stock = $6
                    WHERE id = $7
                    RETURNING
                        id,
                        nombre,
                        precio,
                        precio_minimo AS "precioMinimo",
                        precio_compra AS "precioCompra",
                        unidades_por_caja AS "unidadesPorCaja",
                        stock`,
                    [
                        nombre.trim(),
                        precio,
                        precioMinimo,
                        costoUnitario,
                        unidadesPorCaja,
                        stock,
                        id
                    ]
                );

                if (resultado.rows.length === 0) {
                    return res.status(404).json({
                        error: "Producto no encontrado"
                    });
                }

                res.json({
                    mensaje: "Producto actualizado correctamente",
                    producto: resultado.rows[0]
                });
            } catch (error) {
                console.error(
                    "Error al actualizar el producto:",
                    error.message
                );

                res.status(500).json({
                    error: "Error al actualizar el producto"
                });
            }
        });

 // Eliminar un producto existente.
app.delete("/api/productos/:id", requiereJefe, async (req, res) => {
    try {
        const id = Number(req.params.id);

        if (!Number.isInteger(id) || id <= 0) {
            return res.status(400).json({
                error: "ID de producto inválido"
            });
        }

        const resultado = await pool.query(
            `DELETE FROM productos
             WHERE id = $1
             RETURNING
                 id,
                 nombre,
                 precio,
                 precio_minimo AS "precioMinimo",
                 precio_compra AS "precioCompra",
                 stock`,
            [id]
        );

        if (resultado.rows.length === 0) {
            return res.status(404).json({
                error: "Producto no encontrado"
            });
        }

        res.json({
            mensaje: "Producto eliminado correctamente",
            producto: resultado.rows[0]
        });
    } catch (error) {
        console.error("Error al eliminar el producto:", error.message);

        res.status(500).json({
            error: "Error al eliminar el producto"
        });
    }
});


// Resumen general del inventario.
app.get("/api/resumen", requiereSesion, async (req, res) => {
    try {
        const resultado = await pool.query(
            `SELECT
                COUNT(*) AS "totalProductos",
                COALESCE(SUM(stock), 0) AS "unidadesTotales",
                COUNT(*) FILTER (WHERE stock <= 5) AS "productosStockBajo"
             FROM productos`
        );

        const resumen = resultado.rows[0];

        if (req.session.usuario.rol === "jefe") {
            const valor = await pool.query(
                `SELECT COALESCE(SUM(precio * stock), 0)
                 AS "valorInventario"
                 FROM productos`
            );

            resumen.valorInventario = valor.rows[0].valorInventario;
        }

        res.json(resumen);
    } catch (error) {
        console.error("Error al generar el resumen:", error.message);

        res.status(500).json({
            error: "Error al generar el resumen del inventario"
        });
    }
});


/* Registrar una venta. */

app.post("/api/ventas", requiereSesion, async (req, res) => {
    const { productoId, cantidad } = req.body;

    if (
        !Number.isInteger(Number(productoId)) ||
        Number(productoId) <= 0 ||
        !Number.isInteger(cantidad) ||
        cantidad <= 0
    ) {
        return res.status(400).json({
            error: "El producto y la cantidad deben ser válidos."
        });
    }

    let client;
    let transaccionIniciada = false;

    try {
        client = await pool.connect();

        await client.query("BEGIN");
        transaccionIniciada = true;

        const resultado = await client.query(
            `SELECT id, nombre, precio, precio_compra, stock
             FROM productos
             WHERE id = $1
             FOR UPDATE`,
            [Number(productoId)]
        );

        if (resultado.rows.length === 0) {
            await client.query("ROLLBACK");
            transaccionIniciada = false;

            return res.status(404).json({
                error: "El producto no existe."
            });
        }

        const producto = resultado.rows[0];

        if (producto.stock < cantidad) {
            await client.query("ROLLBACK");
            transaccionIniciada = false;

            return res.status(400).json({
                error: `Stock insuficiente. Solo quedan ${producto.stock} unidades.`
            });
        }

        const precioUnitario = Number(producto.precio);
        const costoUnitario = Number(producto.precio_compra);
        const total = Number((precioUnitario * cantidad).toFixed(2));
        const ganancia = Number(
            ((precioUnitario - costoUnitario) * cantidad).toFixed(2)
        );

        const venta = await client.query(
            `INSERT INTO ventas
                (
                    producto_id,
                    cantidad,
                    precio_unitario,
                    costo_unitario,
                    total,
                    usuario_id,
                    fecha
                )
             VALUES (
                $1, $2, $3, $4, $5, $6,
                CURRENT_TIMESTAMP AT TIME ZONE 'America/Lima'
             )
             RETURNING
                id,
                producto_id,
                cantidad,
                precio_unitario,
                costo_unitario,
                total,
                fecha,
                usuario_id`,
            [
                producto.id,
                cantidad,
                precioUnitario,
                costoUnitario,
                total,
                req.session.usuario.id
            ]
        );

        await client.query(
            `UPDATE productos
             SET stock = stock - $1
             WHERE id = $2`,
            [cantidad, producto.id]
        );

        await client.query("COMMIT");
        transaccionIniciada = false;

        res.status(201).json({
            mensaje: "Venta registrada correctamente.",
            venta: venta.rows[0],
            producto: producto.nombre,
            stockRestante: producto.stock - cantidad,
            ganancia
        });
    } catch (error) {
        if (client && transaccionIniciada) {
            try {
                await client.query("ROLLBACK");
            } catch (errorRollback) {
                console.error(
                    "Error al deshacer la transacción:",
                    errorRollback.message
                );
            }
        }

        console.error(
            "Error al registrar la venta:",
            error.message
        );

        if (!res.headersSent) {
            res.status(500).json({
                error: "No se pudo registrar la venta."
            });
        }
    } finally {
        if (client) {
            client.release();
        }
    }
});


/* Consultar el historial de ventas. */

app.get("/api/ventas", requiereSesion, async (req, res) => {
    try {
        const esJefe = req.session.usuario.rol === "jefe";

        const resultado = await pool.query(`
            SELECT
                ventas.id,
                productos.nombre AS producto,
                ventas.cantidad,
                ventas.precio_unitario AS "precioUnitario",
                ventas.total,
                TO_CHAR(
                    ventas.fecha,
                    'YYYY-MM-DD"T"HH24:MI:SS.MS'
                ) AS fecha,
                COALESCE(usuarios.nombre, 'No registrado') AS vendedor
                ${esJefe ? `,
                ventas.costo_unitario AS "costoUnitario",
                CASE
                    WHEN ventas.costo_unitario IS NOT NULL
                    THEN ROUND(
                        (
                            ventas.precio_unitario -
                            ventas.costo_unitario
                        ) * ventas.cantidad,
                        2
                    )
                    ELSE NULL
                END AS ganancia` : ""}
            FROM ventas
            INNER JOIN productos
                ON ventas.producto_id = productos.id
            LEFT JOIN usuarios
                ON ventas.usuario_id = usuarios.id
            ORDER BY ventas.fecha DESC, ventas.id DESC
        `);

        res.json(resultado.rows);
    } catch (error) {
        console.error(
            "Error al consultar las ventas:",
            error.message
        );

        res.status(500).json({
            error: "No se pudo consultar el historial de ventas."
        });
    }
});

// Iniciar servidor.
app.listen(PORT, () => {
    console.log(`Servidor iniciado en http://localhost:${PORT}`);
});
