let usuarioActual = null;

async function cargarProductos(busqueda = "") {
    const contenedor = document.querySelector(".inventario");

    try {
        const respuesta = await fetch("/api/productos");

        if (!respuesta.ok) {
            throw new Error("No se pudieron consultar los productos");
        }

        const productos = await respuesta.json();

        const productosFiltrados = productos.filter((producto) =>
            producto.nombre.toLowerCase().includes(busqueda.toLowerCase())
        );

        let lista = document.querySelector("#lista-productos");

        if (!lista) {
            lista = document.createElement("div");
            lista.id = "lista-productos";
            contenedor.appendChild(lista);
        }

        lista.innerHTML = "";

        if (productosFiltrados.length === 0) {
            lista.textContent = busqueda
                ? "No se encontraron productos con ese nombre."
                : "Todavía no hay productos registrados.";
            return;
        }

        
            productosFiltrados.forEach((producto, indice) => {
                const tarjeta = document.createElement("article");
                tarjeta.className = "producto";
                tarjeta.style.animationDelay = `${Math.min(indice * 70, 490)}ms`;


            const nombre = document.createElement("h3");
            nombre.textContent = producto.nombre;

            const precio = document.createElement("p");
            precio.textContent =
                `Precio: S/ ${Number(producto.precio).toFixed(2)}`;

            const stock = document.createElement("p");
            stock.textContent =
                `Stock disponible: ${producto.stock} unidades`;

            
            const costoCompra = document.createElement("p");
            const unidadesPorCaja = Number(producto.unidadesPorCaja ?? 1);
            const costoUnitario = Number(producto.precioCompra);

            costoCompra.textContent =
                `Costo de compra por caja: S/ ${(costoUnitario * unidadesPorCaja).toFixed(2)}`;

            const detalleCosto = document.createElement("p");
            detalleCosto.textContent =
                `Costo por unidad: S/ ${costoUnitario.toFixed(2)} (${unidadesPorCaja} unidades por caja)`;
            
            const gananciaUnidad = Number(producto.precio) - costoUnitario;

            const detalleGanancia = document.createElement("p");
            detalleGanancia.textContent =
                `Ganancia por unidad: S/ ${gananciaUnidad.toFixed(2)}`;

            const gananciaCaja = gananciaUnidad * unidadesPorCaja;

            const detalleGananciaCaja = document.createElement("p");
            detalleGananciaCaja.textContent =
                `Ganancia estimada por caja: S/ ${gananciaCaja.toFixed(2)}`;


const botonEditar = document.createElement("button");
botonEditar.textContent = "Editar";
botonEditar.className = "boton-editar";

botonEditar.addEventListener("click", async () => {
    const nuevoNombre = prompt(
        "Nombre del producto:",
        producto.nombre
    );

    if (nuevoNombre === null) {
        return;
    }

    const nombre = nuevoNombre.trim();

    if (!nombre) {
        alert("El nombre no puede estar vacío.");
        return;
    }

    const nuevoPrecio = prompt(
        "Precio de venta:",
        producto.precio
    );

    if (nuevoPrecio === null) {
        return;
    }

    const precio = Number(nuevoPrecio);

    
    const nuevoPrecioMinimo = prompt(
    "Precio mínimo:",
    producto.precioMinimo
);


    if (nuevoPrecioMinimo === null) {
        return;
    }

    const precioMinimo = Number(nuevoPrecioMinimo);
    
const nuevoPrecioCompra = prompt(
    "Costo de compra por caja (S/):",
    (
        Number(producto.precioCompra) *
        Number(producto.unidadesPorCaja ?? 1)
    ).toFixed(2)
);

if (nuevoPrecioCompra === null) {
    return;
}

const precioCompra = Number(nuevoPrecioCompra);

const nuevasUnidadesPorCaja = prompt(
    "¿Cuántas unidades contiene la caja?",
    producto.unidadesPorCaja ?? 1
);

if (nuevasUnidadesPorCaja === null) {
    return;
}

const unidadesPorCaja = Number(nuevasUnidadesPorCaja);

    const nuevoStock = prompt(
        "Stock disponible:",
        producto.stock
    );

    if (nuevoStock === null) {
        return;
    }

    const stock = Number(nuevoStock);

    
    if (
        !nombre ||
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
        alert(
            "Datos inválidos. Verifica los precios, el costo de compra, las unidades por caja y el stock."
        );
        return;
    }


    try {
        const respuesta = await fetch(
            `/api/productos/${producto.id}`,
            {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    nombre,
                    precio,
                    precioMinimo,
                    precioCompra,
                    unidadesPorCaja,
                    stock
                })
            }
        );

        const resultado = await respuesta.json();

        if (!respuesta.ok) {
            throw new Error(
                resultado.error || "No se pudo actualizar el producto."
            );
        }

        await cargarProductos(buscador.value.trim());
        await cargarResumen();
        await cargarAlertas();

        alert("Producto actualizado correctamente.");
    } catch (error) {
        alert(error.message);
        console.error("Error al editar:", error);
    }
});
       
const botonEliminar = document.createElement("button");
botonEliminar.textContent = "Eliminar producto";
botonEliminar.className = "boton-eliminar";

botonEliminar.addEventListener("click", async () => {
    const confirmar = confirm(
        `¿Seguro que deseas eliminar "${producto.nombre}"?`
    );

    if (!confirmar) {
        return;
    }

    try {
        const respuesta = await fetch(
            `/api/productos/${producto.id}`,
            {
                method: "DELETE"
            }
        );

        const resultado = await respuesta.json();

        if (!respuesta.ok) {
            throw new Error(
                resultado.error || "No se pudo eliminar el producto."
            );
        }

        await cargarProductos(buscador.value.trim());
        await cargarResumen();
        await cargarAlertas();

        alert("Producto eliminado correctamente.");
    } catch (error) {
        alert(error.message);
        console.error("Error al eliminar:", error);
    }
});


if (document.body.dataset.rol === "jefe") {
    tarjeta.append(
        nombre,
        precio,
        stock,
        costoCompra,
        detalleCosto,
        detalleGanancia,
        detalleGananciaCaja,
        botonEditar,
        botonEliminar
    );
} else {
    tarjeta.append(nombre, precio, stock);
}

lista.appendChild(tarjeta);



        });
    } catch (error) {
        console.error("Error al cargar productos:", error);
        contenedor.textContent =
            "No se pudieron cargar los productos. Verifica que el servidor esté funcionando.";
    }
}

cargarProductos();

const formulario = document.querySelector("#form-producto");
const mensajeFormulario = document.querySelector("#mensaje-formulario");

function mostrarMensajeFormulario(texto, tipo) {
    mensajeFormulario.textContent = texto;
    mensajeFormulario.classList.remove("mensaje-exito", "mensaje-error");
    mensajeFormulario.classList.add(
        tipo === "exito" ? "mensaje-exito" : "mensaje-error"
    );
}


        formulario.addEventListener("submit", async (evento) => {
            evento.preventDefault();

            const nombre = document.querySelector("#nombre").value.trim();
            const precio = Number(document.querySelector("#precio").value);
            const precioMinimo = Number(
                document.querySelector("#precioMinimo").value
            );
            const precioCompra = Number(
                document.querySelector("#precioCompra").value
            );
            const unidadesPorCaja = Number(
                document.querySelector("#unidadesPorCaja").value
            );
            const stock = Number(document.querySelector("#stock").value);

            if (
                !nombre ||
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
                mostrarMensajeFormulario(
                "Verifica los datos ingresados. Los precios no pueden ser negativos, las unidades por caja deben ser un entero mayor que cero y el stock debe ser un entero no negativo.",
                "error"
            );
                return;
            }

            try {
                const respuesta = await fetch("/api/productos", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    
                    body: JSON.stringify({
                        nombre,
                        precio,
                        precioMinimo,
                        precioCompra,
                        unidadesPorCaja,
                        stock
                    })

                });

                const resultado = await respuesta.json();

                if (!respuesta.ok) {
                    throw new Error(
                        resultado.error || "No se pudo registrar el producto."
                    );
                }

                mostrarMensajeFormulario(
                "¡Producto registrado correctamente!",
                "exito"
            );

                formulario.reset();

                calcularCostoUnitario();

                await cargarProductos();
                await cargarResumen();
                await cargarAlertas();

            } catch (error) {
                mostrarMensajeFormulario(error.message, "error");
            }
        });


function animarNumero(elemento, valorFinal, formato = "numero") {
    if (!elemento) return;

    const destino = Number(valorFinal) || 0;
    const textoActual = elemento.textContent.trim();

    const valorInicial = formato === "moneda"
        ? Number(textoActual.replace("S/", "").trim()) || 0
        : Number(textoActual) || 0;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        elemento.textContent = formato === "moneda"
            ? `S/ ${destino.toFixed(2)}`
            : Math.round(destino).toString();
        return;
    }

    const duracion = 700;
    const inicio = performance.now();

    function actualizar(tiempo) {
        const progreso = Math.min((tiempo - inicio) / duracion, 1);
        const suave = 1 - Math.pow(1 - progreso, 3);
        const valor = valorInicial + (destino - valorInicial) * suave;

        elemento.textContent = formato === "moneda"
            ? `S/ ${valor.toFixed(2)}`
            : Math.round(valor).toString();

        if (progreso < 1) {
            requestAnimationFrame(actualizar);
        }
    }

    requestAnimationFrame(actualizar);
}

async function cargarResumen() {
    try {
        const respuesta = await fetch("/api/resumen");

        if (!respuesta.ok) {
            throw new Error("No se pudo cargar el resumen");
        }

        const resumen = await respuesta.json();

        
            animarNumero(
                document.querySelector("#total-productos"),
                resumen.totalProductos
            );

            animarNumero(
                document.querySelector("#unidades-totales"),
                resumen.unidadesTotales
            );

            animarNumero(
                document.querySelector("#productos-stock-bajo"),
                resumen.productosStockBajo
            );


        // Mostrar el valor del inventario solo al jefe.
        const valorInventario = document.querySelector(
            "#valor-inventario"
        );

        
        
        if (document.body.dataset.rol === "jefe") {
            animarNumero(
                valorInventario,
                resumen.valorInventario,
                "moneda"
            );

            const gananciaTotal = document.querySelector("#ganancia-total");

            if (gananciaTotal) {
                animarNumero(
                    gananciaTotal,
                    resumen.gananciaTotal ?? 0,
                    "moneda"
                );
            }
        }


    } catch (error) {
        console.error("Error al cargar el resumen:", error);
    }
}

cargarResumen();

async function cargarAlertas() {
    const listaAlertas = document.querySelector("#lista-alertas");

    try {
        const respuesta = await fetch("/api/productos/stock-bajo");

        if (!respuesta.ok) {
            throw new Error("No se pudieron cargar las alertas.");
        }

        const productos = await respuesta.json();
        


        listaAlertas.innerHTML = "";

        if (productos.length === 0) {
            listaAlertas.textContent =
                "¡Excelente! No hay productos con stock bajo.";
            return;
        }

        productos.forEach((producto) => {
            const alerta = document.createElement("div");

            alerta.classList.add("alerta-producto");

            alerta.textContent =
                `${producto.nombre}: quedan ${producto.stock} unidades. ` +
                `Debes reponer ${producto.unidadesParaReponer} unidades.`;

            listaAlertas.appendChild(alerta);
        });
    } catch (error) {
        listaAlertas.textContent = error.message;
        console.error("Error al cargar las alertas:", error);
    }
}

cargarAlertas();

async function cargarProductosParaVenta() {
    const selector = document.querySelector("#producto-venta");

    try {
        const respuesta = await fetch("/api/productos");

        if (!respuesta.ok) {
            throw new Error("No se pudieron cargar los productos");
        }

        const productos = await respuesta.json();

        selector.innerHTML =
            '<option value="">Selecciona un producto</option>';

        productos.forEach((producto) => {
            const opcion = document.createElement("option");

            opcion.value = producto.id;
            opcion.textContent =
                `${producto.nombre} | S/ ${Number(producto.precio).toFixed(2)} | Stock: ${producto.stock}`;

            if (producto.stock === 0) {
                opcion.disabled = true;
            }

            selector.appendChild(opcion);
        });
    } catch (error) {
        console.error("Error al cargar productos para la venta:", error);
        selector.innerHTML =
            '<option value="">No se pudieron cargar los productos</option>';
    }
}

function actualizarResumenVenta() {
    const selector = document.querySelector("#producto-venta");
    const campoCantidad = document.querySelector("#cantidad-venta");

    const precioElemento = document.querySelector("#precio-unitario-venta");
    const stockElemento = document.querySelector("#stock-disponible-venta");
    const cantidadElemento = document.querySelector("#cantidad-resumen-venta");
    const totalElemento = document.querySelector("#total-venta");

    const opcionSeleccionada = selector.options[selector.selectedIndex];
    const productoId = selector.value;
    const cantidad = Number(campoCantidad.value);

    if (!productoId || !opcionSeleccionada) {
        precioElemento.textContent = "S/ 0.00";
        stockElemento.textContent = "0 unidades";
        cantidadElemento.textContent = "0 unidades";
        totalElemento.textContent = "S/ 0.00";
        return;
    }

    const textoOpcion = opcionSeleccionada.textContent;
    const coincidencia = textoOpcion.match(/S\/\s*([\d.]+).*Stock:\s*(\d+)/);

    if (!coincidencia) {
        return;
    }

    const precio = Number(coincidencia[1]);
    const stock = Number(coincidencia[2]);
    const cantidadValida = Number.isInteger(cantidad) && cantidad > 0
        ? cantidad
        : 0;

    precioElemento.textContent = `S/ ${precio.toFixed(2)}`;
    stockElemento.textContent = `${stock} unidades`;
    cantidadElemento.textContent = `${cantidadValida} unidades`;
    totalElemento.textContent = `S/ ${(precio * cantidadValida).toFixed(2)}`;

    if (cantidadValida > stock) {
        totalElemento.textContent += " (stock insuficiente)";
    }
}

cargarProductosParaVenta();

const buscador = document.querySelector("#buscar-producto");

const selectorProductoVenta = document.querySelector("#producto-venta");
const campoCantidadVenta = document.querySelector("#cantidad-venta");

selectorProductoVenta.addEventListener("change", actualizarResumenVenta);

campoCantidadVenta.addEventListener("input", actualizarResumenVenta);

buscador.addEventListener("input", async () => {
    await cargarProductos(buscador.value.trim());
});

const formularioVenta = document.querySelector("#form-venta");
const mensajeVenta = document.querySelector("#mensaje-venta");

formularioVenta.addEventListener("submit", async (evento) => {
    evento.preventDefault();

    const productoId = Number(
        document.querySelector("#producto-venta").value
    );

    const cantidad = Number(
        document.querySelector("#cantidad-venta").value
    );

    if (
        !Number.isInteger(productoId) ||
        productoId <= 0 ||
        !Number.isInteger(cantidad) ||
        cantidad <= 0
    ) {
        mensajeVenta.textContent =
            "Selecciona un producto e ingresa una cantidad válida.";
        return;
    }

    const selectorProducto = document.querySelector("#producto-venta");
    const opcionSeleccionada =
        selectorProducto.options[selectorProducto.selectedIndex];

    const coincidenciaStock =
        opcionSeleccionada.textContent.match(/Stock:\s*(\d+)/);

    if (!coincidenciaStock) {
        mensajeVenta.textContent =
            "No se pudo comprobar el stock del producto.";
        return;
    }

    const stockDisponible = Number(coincidenciaStock[1]);

    if (cantidad > stockDisponible) {
        mensajeVenta.textContent =
            `Stock insuficiente. Solo hay ${stockDisponible} unidades disponibles.`;
        return;
    }

    mensajeVenta.textContent = "";

    try {
        const respuesta = await fetch("/api/ventas", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                productoId: productoId,
                cantidad: cantidad
            })
        });

        const resultado = await respuesta.json();

        if (!respuesta.ok) {
            throw new Error(
                resultado.error || "No se pudo registrar la venta."
            );
        }

        mensajeVenta.textContent =
            `${resultado.mensaje} Total: S/ ${
                Number(resultado.venta.total).toFixed(2)
            }. Stock restante: ${resultado.stockRestante} unidades.`;

        formularioVenta.reset();

        await cargarProductos(buscador.value.trim());
        await cargarResumen();
        await cargarAlertas();
        await cargarProductosParaVenta();
        await cargarHistorialVentas();

    } catch (error) {
        mensajeVenta.textContent = error.message;
        console.error("Error al registrar la venta:", error);
    }
});

const botonVistaInventario = document.querySelector("#vista-inventario");
const botonVistaVentas = document.querySelector("#vista-ventas");

const contenidoInventario = document.querySelector("#contenido-inventario");
const contenidoVentas = document.querySelector("#contenido-ventas");

botonVistaInventario.addEventListener("click", () => {
    contenidoInventario.hidden = false;
    contenidoVentas.hidden = true;

    botonVistaInventario.classList.add("activo");
    botonVistaVentas.classList.remove("activo");

    botonVistaInventario.setAttribute("aria-pressed", "true");
    botonVistaVentas.setAttribute("aria-pressed", "false");
});

botonVistaVentas.addEventListener("click", () => {
    contenidoInventario.hidden = true;
    contenidoVentas.hidden = false;

    console.log("Botón Ventas pulsado", contenidoVentas.hidden);

    botonVistaVentas.classList.add("activo");
    botonVistaInventario.classList.remove("activo");

    botonVistaVentas.setAttribute("aria-pressed", "true");
    botonVistaInventario.setAttribute("aria-pressed", "false");

    cargarProductosParaVenta();
});



async function cargarHistorialVentas() {
    const listaVentas = document.querySelector("#lista-ventas");
    const mensajeHistorial = document.querySelector("#mensaje-historial");

    try {
        const respuesta = await fetch("/api/ventas");

        if (!respuesta.ok) {
            throw new Error("No se pudo cargar el historial de ventas.");
        }

        const ventas = await respuesta.json();

        listaVentas.innerHTML = "";
        mensajeHistorial.textContent = "";

        const esJefe = usuarioActual?.rol === "jefe";

        if (ventas.length === 0) {
            const fila = document.createElement("tr");
            const celda = document.createElement("td");

            celda.colSpan = esJefe ? 8 : 6;
            celda.textContent = "Todavía no hay ventas registradas.";

            fila.appendChild(celda);
            listaVentas.appendChild(fila);

            return;
        }

        ventas.forEach((venta) => {
            const fila = document.createElement("tr");

            const fecha = document.createElement("td");

                fecha.textContent = new Date(venta.fecha).toLocaleString("es-PE", {
                    day: "2-digit",
                    month: "2-digit",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                    hour12: true
                });

            const producto = document.createElement("td");
            producto.textContent = venta.producto;

            const vendedor = document.createElement("td");
            vendedor.textContent = venta.vendedor || "No registrado";

            const cantidad = document.createElement("td");
            cantidad.textContent = venta.cantidad;

            const precio = document.createElement("td");
            precio.textContent =
                `S/ ${Number(venta.precioUnitario).toFixed(2)}`;

            const total = document.createElement("td");
            total.textContent =
                `S/ ${Number(venta.total).toFixed(2)}`;

            fila.append(
                fecha,
                producto,
                vendedor,
                cantidad,
                precio,
                total
            );

            if (esJefe) {
                const costo = document.createElement("td");
                costo.textContent =
                    venta.costoUnitario == null
                        ? "No disponible"
                        : `S/ ${Number(venta.costoUnitario).toFixed(2)}`;

                const ganancia = document.createElement("td");
                ganancia.textContent =
                    venta.ganancia == null
                        ? "No disponible"
                        : `S/ ${Number(venta.ganancia).toFixed(2)}`;

                fila.append(costo, ganancia);
            }

            listaVentas.appendChild(fila);
        });
    } catch (error) {
        mensajeHistorial.textContent = error.message;
        console.error("Error al cargar el historial:", error);
    }
}

cargarHistorialVentas();

/* Gestionar la sesión y los permisos del usuario. */
async function mostrarSesionUsuario() {
    const nombreUsuario = document.querySelector("#nombre-usuario");
    const botonCerrarSesion = document.querySelector("#btn-cerrar-sesion");

    try {
        const respuesta = await fetch("/api/sesion");

        if (!respuesta.ok) {
            window.location.href = "/";
            return;
        }

        const resultado = await respuesta.json();
        const usuario = resultado.usuario || resultado;

        usuarioActual = usuario;

        const esJefe = usuario.rol === "jefe";

        nombreUsuario.textContent =
            usuario.nombre || usuario.usuario || "Usuario";

        // Guardar el rol para adaptar la interfaz.
        document.body.dataset.rol = usuario.rol;
        
        const tarjetaGanancia = document.getElementById("tarjeta-ganancia-total");

        if (tarjetaGanancia) {
            tarjetaGanancia.hidden = !esJefe;
        }

        
        document.querySelectorAll(".columna-jefe").forEach((columna) => {
        columna.hidden = !esJefe;
});

        await cargarProductos();

        // Ocultar información y formularios exclusivos del jefe.
        const tarjetaValor = document.querySelector(
            "#tarjeta-valor-inventario"
        );
        const formularioProducto = document.querySelector(
            "#seccion-formulario-producto"
        );
        const campoPrecioMinimo = document.querySelector(
            "#campo-precio-minimo"
        );

        if (tarjetaValor) {
            tarjetaValor.hidden = !esJefe;
        }

        if (formularioProducto) {
            formularioProducto.hidden = !esJefe;
        }

        if (campoPrecioMinimo) {
            campoPrecioMinimo.hidden = !esJefe;

            const precioMinimo = campoPrecioMinimo.querySelector("input");

            if (precioMinimo) {
                precioMinimo.required = esJefe;
                precioMinimo.disabled = !esJefe;
            }
        }

        // Cerrar la sesión actual.
        botonCerrarSesion.addEventListener("click", async () => {
            botonCerrarSesion.disabled = true;

            try {
                const respuestaLogout = await fetch("/api/logout", {
                    method: "POST"
                });

                if (!respuestaLogout.ok) {
                    throw new Error("No se pudo cerrar la sesión.");
                }

                window.location.href = "/";
            } catch (error) {
                console.error(error);
                alert("No se pudo cerrar la sesión. Inténtalo nuevamente.");
                botonCerrarSesion.disabled = false;
            }
        });
    } catch (error) {
        console.error("Error al consultar la sesión:", error);
        nombreUsuario.textContent = "No se pudo cargar el usuario";
    }
}

mostrarSesionUsuario();

function calcularCostoUnitario() {
    const precioCompra = Number(
        document.getElementById("precioCompra").value
    );

    const unidadesPorCaja = Number(
        document.getElementById("unidadesPorCaja").value
    );

    const resultado = document.getElementById(
        "costo-unitario-calculado"
    );

    if (
        !Number.isFinite(precioCompra) ||
        !Number.isInteger(unidadesPorCaja) ||
        precioCompra < 0 ||
        unidadesPorCaja < 1
    ) {
        resultado.textContent = "Ingresa un precio y una cantidad válidos.";
        return;
    }

    const costoUnitario = precioCompra / unidadesPorCaja;

    resultado.textContent =
        `Costo por unidad: S/ ${costoUnitario.toFixed(2)}`;
}

document
    .getElementById("precioCompra")
    .addEventListener("input", calcularCostoUnitario);

document
    .getElementById("unidadesPorCaja")
    .addEventListener("input", calcularCostoUnitario);

calcularCostoUnitario();
