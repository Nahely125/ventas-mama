import { useCallback, useState } from "react";
import { moneda } from "../api.js";
import Escaner from "./Escaner.jsx";

const MAXIMO_RESULTADOS = 8;

// Ordena primero los productos cuyo código coincide exactamente, luego por nombre.
function buscar(productos, texto) {
    const busqueda = texto.trim().toLowerCase();

    if (!busqueda) {
        return productos.slice(0, MAXIMO_RESULTADOS);
    }

    return productos
        .filter((producto) =>
            producto.nombre.toLowerCase().includes(busqueda) ||
            (producto.codigo ?? "").toLowerCase().includes(busqueda)
        )
        .sort((a, b) => {
            const exactoA = (a.codigo ?? "").toLowerCase() === busqueda ? 0 : 1;
            const exactoB = (b.codigo ?? "").toLowerCase() === busqueda ? 0 : 1;
            return exactoA - exactoB;
        })
        .slice(0, MAXIMO_RESULTADOS);
}

export default function BuscadorProducto({ productos, seleccionado, onSeleccionar, permitirAgotados = false }) {
    const [texto, setTexto] = useState("");
    const [abierto, setAbierto] = useState(false);
    const [activo, setActivo] = useState(0);
    const [escaneando, setEscaneando] = useState(false);

    // Si el código escaneado coincide exacto con un producto, se elige directamente.
    const codigoLeido = useCallback((codigo) => {
        setEscaneando(false);
        const exacto = (productos ?? []).find(
            (producto) => (producto.codigo ?? "").toLowerCase() === codigo.toLowerCase()
        );

        if (exacto && (exacto.stock > 0 || permitirAgotados)) {
            onSeleccionar(exacto);
            setTexto("");
        } else {
            setTexto(codigo);
            setAbierto(true);
        }
    }, [productos, onSeleccionar, permitirAgotados]);

    const resultados = buscar(productos ?? [], texto);

    function elegir(producto) {
        if (!producto || (producto.stock === 0 && !permitirAgotados)) {
            return;
        }

        onSeleccionar(producto);
        setTexto("");
        setAbierto(false);
    }

    function teclado(evento) {
        if (evento.key === "ArrowDown") {
            evento.preventDefault();
            setAbierto(true);
            setActivo((indice) => Math.min(indice + 1, resultados.length - 1));
        } else if (evento.key === "ArrowUp") {
            evento.preventDefault();
            setActivo((indice) => Math.max(indice - 1, 0));
        } else if (evento.key === "Enter") {
            evento.preventDefault();
            elegir(resultados[activo]);
        } else if (evento.key === "Escape") {
            setAbierto(false);
        }
    }

    if (seleccionado) {
        return (
            <div className="producto-seleccionado">
                <div className="producto-seleccionado-datos">
                    {seleccionado.codigo && (
                        <span className="codigo-producto">{seleccionado.codigo}</span>
                    )}
                    <strong>{seleccionado.nombre}</strong>
                    <span>
                        {moneda(seleccionado.precio)} c/u · {moneda(seleccionado.precioDocena)} docena ·
                        Stock: {seleccionado.stock}
                    </span>
                </div>
                <button type="button" className="boton-secundario boton-pequeno" onClick={() => onSeleccionar(null)}>
                    Cambiar
                </button>
            </div>
        );
    }

    return (
        <div className="buscador-producto">
            <div className="campo-con-boton">
            <input
                type="search"
                id="buscar-producto-venta"
                role="combobox"
                aria-expanded={abierto}
                aria-controls="resultados-producto"
                aria-autocomplete="list"
                placeholder={productos === null ? "Cargando productos..." : "Escribe el código o el nombre..."}
                autoComplete="off"
                value={texto}
                onChange={(e) => {
                    setTexto(e.target.value);
                    setAbierto(true);
                    setActivo(0);
                }}
                onFocus={() => setAbierto(true)}
                onBlur={() => setAbierto(false)}
                onKeyDown={teclado}
            />
            <button
                type="button"
                className="boton-escanear"
                onClick={() => setEscaneando(true)}
                aria-label="Escanear código con la cámara"
                title="Escanear código"
            >
                📷
            </button>
            </div>

            {escaneando && (
                <Escaner onLeido={codigoLeido} onCerrar={() => setEscaneando(false)} />
            )}

            {abierto && (
                <ul className="resultados-producto" id="resultados-producto" role="listbox">
                    {resultados.length === 0 ? (
                        <li className="sin-resultados">No hay productos con ese código o nombre.</li>
                    ) : (
                        resultados.map((producto, indice) => (
                            <li
                                key={producto.id}
                                role="option"
                                aria-selected={indice === activo}
                                aria-disabled={producto.stock === 0 && !permitirAgotados}
                                className={`resultado-producto ${indice === activo ? "activo" : ""}`}
                                // onMouseDown evita que el input pierda el foco antes del clic.
                                onMouseDown={(e) => {
                                    e.preventDefault();
                                    elegir(producto);
                                }}
                                onMouseEnter={() => setActivo(indice)}
                            >
                                <span className="resultado-nombre">
                                    {producto.codigo && <span className="codigo-producto">{producto.codigo}</span>}
                                    {producto.nombre}
                                </span>
                                <span className="resultado-detalle">
                                    {moneda(producto.precio)} ·{" "}
                                    {producto.stock === 0 ? "Agotado" : `Stock: ${producto.stock}`}
                                </span>
                            </li>
                        ))
                    )}
                </ul>
            )}
        </div>
    );
}
