import { useEffect, useRef } from "react";

// Rangos de precio por unidad (precio del catálogo).
export const RANGOS_PRECIO = [
    { valor: "", texto: "Todos los precios" },
    { valor: "0-5", texto: "Hasta S/ 5", minimo: 0, maximo: 5 },
    { valor: "5-20", texto: "S/ 5 a S/ 20", minimo: 5, maximo: 20 },
    { valor: "20-50", texto: "S/ 20 a S/ 50", minimo: 20, maximo: 50 },
    { valor: "50-", texto: "Más de S/ 50", minimo: 50, maximo: Infinity }
];

export const ORDENES = [
    { valor: "", texto: "Recomendados" },
    { valor: "precio-menor", texto: "Precio: menor a mayor" },
    { valor: "precio-mayor", texto: "Precio: mayor a menor" },
    { valor: "nombre", texto: "Nombre (A a Z)" }
];

// Aplica disponibilidad, rango de precio y orden a una lista de productos.
export function aplicarFiltros(productos, { soloDisponibles, rango, orden }) {
    const elegido = RANGOS_PRECIO.find((r) => r.valor === rango && r.valor);
    const lista = productos.filter((p) => {
        const precio = Number(p.precioMinimo);
        return (!soloDisponibles || p.disponible) && (!elegido || (precio >= elegido.minimo && precio <= elegido.maximo));
    });

    if (orden === "precio-menor") lista.sort((a, b) => Number(a.precioMinimo) - Number(b.precioMinimo));
    if (orden === "precio-mayor") lista.sort((a, b) => Number(b.precioMinimo) - Number(a.precioMinimo));
    if (orden === "nombre") lista.sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
    return lista;
}

// Cuántos filtros (además de la categoría) están puestos.
export function cantidadFiltros({ soloDisponibles, rango, orden }) {
    return Number(Boolean(soloDisponibles)) + Number(Boolean(rango)) + Number(Boolean(orden));
}

/* Panel de filtros: categorías (feria → categoría), disponibilidad, precio y orden.
   En computadora va a la izquierda del catálogo; en el celular se abre con el botón "Filtros". */
export function PanelFiltros({ secciones, seccionClave, categoriaActiva, filtros, onFiltros, onIr, onLimpiar }) {
    const marcarCambio = (cambios) => onFiltros({ ...filtros, ...cambios });

    return (
        <div className="cat-panel-filtros">
            <section>
                <h2>Categorías</h2>
                <ul className="cat-arbol">
                    {secciones.map((seccion) => {
                        const abierta = seccionClave === seccion.slug;
                        return (
                            <li key={seccion.slug}>
                                <button
                                    type="button"
                                    className={`cat-arbol-feria ${abierta && !categoriaActiva ? "activa" : ""}`}
                                    aria-expanded={seccion.categorias.length > 0 ? abierta : undefined}
                                    onClick={() => onIr(seccion.slug)}
                                >
                                    <span>{seccion.nombre}</span>
                                    <small>{seccion.productos.length}</small>
                                </button>
                                {abierta && seccion.categorias.length > 0 && (
                                    <ul>
                                        {seccion.categorias.map((categoria) => (
                                            <li key={categoria.slug}>
                                                <button
                                                    type="button"
                                                    className={categoriaActiva?.slug === categoria.slug ? "activa" : ""}
                                                    aria-current={categoriaActiva?.slug === categoria.slug ? "page" : undefined}
                                                    onClick={() => onIr(seccion.slug, categoria.slug)}
                                                >
                                                    <span>
                                                        <span aria-hidden="true">{categoria.icono}</span> {categoria.nombre}
                                                    </span>
                                                    <small>{categoria.productos.length}</small>
                                                </button>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </li>
                        );
                    })}
                    {secciones.length > 1 && (
                        <li>
                            <button
                                type="button"
                                className={`cat-arbol-feria ${seccionClave === "todo" ? "activa" : ""}`}
                                onClick={() => onIr("todo")}
                            >
                                <span>Ver todo</span>
                                <small>{secciones.reduce((suma, s) => suma + s.productos.length, 0)}</small>
                            </button>
                        </li>
                    )}
                </ul>
            </section>

            <section>
                <h2>Disponibilidad</h2>
                <label className="cat-opcion">
                    <input
                        type="checkbox"
                        checked={filtros.soloDisponibles}
                        onChange={(e) => marcarCambio({ soloDisponibles: e.target.checked })}
                    />
                    Solo disponibles
                </label>
            </section>

            <section>
                <h2>Precio por unidad</h2>
                {RANGOS_PRECIO.map((rango) => (
                    <label key={rango.valor || "todos"} className="cat-opcion">
                        <input
                            type="radio"
                            name="rango-precio"
                            checked={filtros.rango === rango.valor}
                            onChange={() => marcarCambio({ rango: rango.valor })}
                        />
                        {rango.texto}
                    </label>
                ))}
            </section>

            <section>
                <h2>Ordenar por</h2>
                <select
                    value={filtros.orden}
                    onChange={(e) => marcarCambio({ orden: e.target.value })}
                    aria-label="Ordenar productos"
                >
                    {ORDENES.map((orden) => (
                        <option key={orden.valor || "recomendados"} value={orden.valor}>{orden.texto}</option>
                    ))}
                </select>
            </section>

            {cantidadFiltros(filtros) > 0 && (
                <button type="button" className="cat-limpiar" onClick={onLimpiar}>
                    Limpiar filtros
                </button>
            )}
        </div>
    );
}

// En el celular: el mismo panel en una ventana lateral.
export function VentanaFiltros({ total, onCerrar, children }) {
    const dialogo = useRef(null);

    useEffect(() => {
        dialogo.current?.showModal();
    }, []);

    return (
        <dialog
            ref={dialogo}
            className="cat-ventana-filtros"
            onClose={onCerrar}
            onClick={(e) => e.target === dialogo.current && onCerrar()}
            aria-labelledby="titulo-filtros"
        >
            <div className="cat-ventana-filtros-contenido">
                <div className="cat-ventana-filtros-encabezado">
                    <h2 id="titulo-filtros">Filtros</h2>
                    <button type="button" className="boton-cerrar-modal" onClick={onCerrar} aria-label="Cerrar">✕</button>
                </div>
                {children}
                <button type="button" className="cat-boton-oscuro cat-ver-resultados" onClick={onCerrar}>
                    Ver {total} {total === 1 ? "producto" : "productos"}
                </button>
            </div>
        </dialog>
    );
}
