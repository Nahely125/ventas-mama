
const express = require("express");

const app = express();
const PORT = 3000;

app.use(express.json());

// Productos de prueba para el inventario.
const productos = [
    {
        id: 1,
        nombre: "Arbol de Navidad",
        precio: 180,
        precioMinimo: 150,
        stock: 12
    },
    {
        id: 2,
        nombre: "Luces LED",
        precio: 25,
        precioMinimo: 20,
        stock: 40
    },
    {
        id: 3,
        nombre: "Esferas",
        precio: 15,
        precioMinimo: 10,
        stock: 3
    },
    {
        id: 4,
        nombre: "Guirnalda",
        precio: 20,
        precioMinimo: 15,
        stock: 8
    },
    {
        id: 5,
        nombre: "Estrella",
        precio: 12,
        precioMinimo: 8,
        stock: 2
    }
];

// Ruta principal.
app.get("/", (req, res) => {
    res.json({
        mensaje: "API de Ventas Mamá funcionando correctamente",
        estado: "OK"
    });
});

// Consultar todos los productos.
app.get("/api/productos", (req, res) => {
    res.json(productos);
});

 // Buscar un producto por su ID.
app.get("/api/productos/:id", (req, res) => {
    const id = Number(req.params.id);

    const producto = productos.find(
        (p) => p.id === id
    );

    if (!producto) {
        return res.status(404).json({
            error: "Producto no encontrado"
        });
    }

    res.json(producto);
});

 // Registrar un producto nuevo.
app.post("/api/productos", (req, res) => {
    const { nombre, precio, precioMinimo, stock } = req.body;

    if (
        typeof nombre !== "string" ||
        nombre.trim() === "" ||
        typeof precio !== "number" ||
        typeof precioMinimo !== "number" ||
        typeof stock !== "number" ||
        precio < 0 ||
        precioMinimo < 0 ||
        stock < 0 ||
        precio < precioMinimo
    ) {
        return res.status(400).json({
            error: "Datos invalidos. Verifica nombre, precios y stock."
        });
    }

    const nuevoProducto = {
        id: Math.max(0, ...productos.map((p) => p.id)) + 1,
        nombre: nombre.trim(),
        precio,
        precioMinimo,
        stock
    };

    productos.push(nuevoProducto);

    res.status(201).json({
        mensaje: "Producto registrado correctamente",
        producto: nuevoProducto
    });
});

 // Actualizar un producto existente.
app.put("/api/productos/:id", (req, res) => {
    const id = Number(req.params.id);

    const producto = productos.find(
        (p) => p.id === id
    );

    if (!producto) {
        return res.status(404).json({
            error: "Producto no encontrado"
        });
    }

    const { nombre, precio, precioMinimo, stock } = req.body;

    if (
        typeof nombre !== "string" ||
        nombre.trim() === "" ||
        typeof precio !== "number" ||
        typeof precioMinimo !== "number" ||
        typeof stock !== "number" ||
        precio < 0 ||
        precioMinimo < 0 ||
        stock < 0 ||
        precio < precioMinimo
    ) {
        return res.status(400).json({
            error: "Datos invalidos. Verifica nombre, precios y stock."
        });
    }

    producto.nombre = nombre.trim();
    producto.precio = precio;
    producto.precioMinimo = precioMinimo;
    producto.stock = stock;

    res.json({
        mensaje: "Producto actualizado correctamente",
        producto
    });
});

 // Actualizar un producto existente.
app.put("/api/productos/:id", (req, res) => {
    const id = Number(req.params.id);

    const producto = productos.find(
        (p) => p.id === id
    );

    if (!producto) {
        return res.status(404).json({
            error: "Producto no encontrado"
        });
    }

    const { nombre, precio, precioMinimo, stock } = req.body;

    if (
        typeof nombre !== "string" ||
        nombre.trim() === "" ||
        typeof precio !== "number" ||
        typeof precioMinimo !== "number" ||
        typeof stock !== "number" ||
        precio < 0 ||
        precioMinimo < 0 ||
        stock < 0 ||
        precio < precioMinimo
    ) {
        return res.status(400).json({
            error: "Datos invalidos. Verifica nombre, precios y stock."
        });
    }

    producto.nombre = nombre.trim();
    producto.precio = precio;
    producto.precioMinimo = precioMinimo;
    producto.stock = stock;

    res.json({
        mensaje: "Producto actualizado correctamente",
        producto
    });
});

 // Eliminar un producto existente.
app.delete("/api/productos/:id", (req, res) => {
    const id = Number(req.params.id);

    const indice = productos.findIndex(
        (p) => p.id === id
    );

    if (indice === -1) {
        return res.status(404).json({
            error: "Producto no encontrado"
        });
    }

    const productoEliminado = productos.splice(indice, 1)[0];

    res.json({
        mensaje: "Producto eliminado correctamente",
        producto: productoEliminado
    });
});

 // Eliminar un producto existente.
app.delete("/api/productos/:id", (req, res) => {
    const id = Number(req.params.id);

    const indice = productos.findIndex(
        (p) => p.id === id
    );

    if (indice === -1) {
        return res.status(404).json({
            error: "Producto no encontrado"
        });
    }

    const productoEliminado = productos.splice(indice, 1)[0];

    res.json({
        mensaje: "Producto eliminado correctamente",
        producto: productoEliminado
    });
});

// Iniciar servidor.
app.listen(PORT, () => {
    console.log(`Servidor iniciado en http://localhost:${PORT}`);
});
