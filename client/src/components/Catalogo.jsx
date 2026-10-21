import { useEffect, useState } from "react";
import { moneda, pedir } from "../api.js";
import { urlFoto } from "../fotos.js";

// Página pública con los productos y sus precios mínimos. No necesita iniciar sesión.
export default function Catalogo() {
    const [productos, setProductos] = useState(null);
    const [error, setError] = useState("");
    const [busqueda, setBusqueda] = useState("");
    const [ampliada, setAmpliada] = useState(null);

    useEffect(() => {
        document.title = "Catálogo | Ventas Mamá";

        pedir("/api/publico/catalogo")
            .then(setProductos)
            .catch((err) => setError(err.message));
    }, []);

    const texto = busqueda.trim().toLowerCase();
    const filtrados = (productos ?? []).filter((producto) =>
        !texto ||
        producto.nombre.toLowerCase().includes(texto) ||
        (producto.codigo ?? "").toLowerCase().includes(texto)
    );

    return (
        <div className="pagina-publica">
            <header className="encabezado-catalogo">
                <div className="encabezado-catalogo-interno">
                    <h1>Ventas Mamá</h1>
                    <p>Catálogo de productos</p>
                </div>
            </header>

            <main className="contenedor-catalogo">
                <div className="buscador buscador-catalogo">
                    <label htmlFor="buscar-catalogo">Buscar producto</label>
                    <input
                        type="search"
                        id="buscar-catalogo"
                        placeholder="Nombre o código..."
                        value={busqueda}
                        onChange={(e) => setBusqueda(e.target.value)}
                    />
                </div>

                {error ? (
                    <p className="mensaje mensaje-error">{error}</p>
                ) : productos === null ? (
                    <p className="cargando-imagen">
                        <span className="spinner" aria-hidden="true"></span> Cargando catálogo...
                    </p>
                ) : filtrados.length === 0 ? (
                    <p>{texto ? "No hay productos con ese nombre o código." : "Todavía no hay productos en el catálogo."}</p>
                ) : (
                    <ul className="grilla-catalogo">
                        {filtrados.map((producto) => {
                            const foto = urlFoto(producto);

                            return (
                                <li
                                    key={producto.id}
                                    className={`tarjeta-catalogo ${producto.disponible ? "" : "agotado"}`}
                                >
                                    <button
                                        type="button"
                                        className="foto-catalogo"
                                        onClick={() => foto && setAmpliada(producto)}
                                        aria-label={foto ? `Ver foto de ${producto.nombre}` : undefined}
                                        disabled={!foto}
                                    >
                                        {foto ? (
                                            <img src={foto} alt={producto.nombre} loading="lazy" />
                                        ) : (
                                            <span aria-hidden="true">🛍️</span>
                                        )}
                                        {!producto.disponible && <span className="sello-agotado">Agotado</span>}
                                    </button>

                                    <div className="datos-catalogo">
                                        {producto.codigo && <span className="codigo-producto">{producto.codigo}</span>}
                                        <h2>{producto.nombre}</h2>
                                        <dl>
                                            <div>
                                                <dt>Por unidad</dt>
                                                <dd>{moneda(producto.precioMinimo)}</dd>
                                            </div>
                                            <div>
                                                <dt>Por docena</dt>
                                                <dd>{moneda(producto.precioDocena)}</dd>
                                            </div>
                                        </dl>
                                    </div>
                                </li>
                            );
                        })}
                    </ul>
                )}
            </main>

            <footer className="pie-catalogo">
                <p>Precios en soles (S/). Consulta disponibilidad antes de tu compra.</p>
            </footer>

            {ampliada && (
                <div className="foto-ampliada" role="dialog" aria-label={ampliada.nombre} onClick={() => setAmpliada(null)}>
                    <img src={urlFoto(ampliada)} alt={ampliada.nombre} />
                    <p>{ampliada.nombre}</p>
                    <button type="button" className="boton-cerrar-modal" aria-label="Cerrar">✕</button>
                </div>
            )}
        </div>
    );
}
