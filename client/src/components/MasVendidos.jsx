import { useEffect, useState } from "react";
import { moneda, pedir } from "../api.js";
import { MiniFoto } from "./BuscadorProducto.jsx";

const PERIODOS = [
    { dias: 7, texto: "7 días" },
    { dias: 30, texto: "30 días" },
    { dias: 90, texto: "3 meses" }
];

// Los 10 productos más vendidos (en unidades) de los últimos 7, 30 o 90 días.
export default function MasVendidos({ esJefe, onError }) {
    const [dias, setDias] = useState(30);
    const [datos, setDatos] = useState(null);
    const [error, setError] = useState("");

    useEffect(() => {
        let vigente = true;
        setDatos(null);

        pedir(`/api/productos/mas-vendidos?dias=${dias}`)
            .then((respuesta) => {
                if (!vigente) return;
                setDatos(respuesta.productos);
                setError("");
            })
            .catch((e) => vigente && onError(e, () => setError("No se pudieron cargar los más vendidos.")));

        return () => {
            vigente = false;
        };
    }, [dias, onError]);

    const maximo = Math.max(1, ...(datos ?? []).map((p) => p.unidades));

    return (
        <section className="tarjeta mas-vendidos">
            <div className="encabezado-seccion">
                <h2>🏆 Más vendidos</h2>
                <div className="periodo-vendidos" role="radiogroup" aria-label="Periodo">
                    {PERIODOS.map((p) => (
                        <button
                            key={p.dias}
                            type="button"
                            role="radio"
                            aria-checked={dias === p.dias}
                            className={dias === p.dias ? "activo" : ""}
                            onClick={() => setDias(p.dias)}
                        >
                            {p.texto}
                        </button>
                    ))}
                </div>
            </div>

            {error ? (
                <p>{error}</p>
            ) : datos === null ? (
                <p>Consultando los más vendidos...</p>
            ) : datos.length === 0 ? (
                <p>Todavía no hay ventas en este periodo.</p>
            ) : (
                <ol className="lista-mas-vendidos">
                    {datos.map((producto, indice) => (
                        <li key={producto.id}>
                            <span className={`puesto-vendido puesto-${indice + 1}`}>{indice + 1}</span>
                            <MiniFoto producto={producto} />
                            <div className="mas-vendido-datos">
                                <strong>{producto.nombre}</strong>
                                <span className="barra-vendido" aria-hidden="true">
                                    <span style={{ width: `${(producto.unidades / maximo) * 100}%` }} />
                                </span>
                                <small>
                                    {producto.unidades} {producto.unidades === 1 ? "unidad" : "unidades"}
                                    {esJefe && producto.vendido != null && <> · {moneda(producto.vendido)}</>}
                                    {" · "}
                                    {producto.stock === 0 ? <span className="texto-aviso">agotado</span> : `quedan ${producto.stock}`}
                                </small>
                            </div>
                        </li>
                    ))}
                </ol>
            )}
        </section>
    );
}
