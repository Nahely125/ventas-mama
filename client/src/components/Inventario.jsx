import { useCallback, useEffect, useRef, useState } from "react";
import { moneda, pedir } from "../api.js";
import { urlFoto } from "../fotos.js";
import TarjetaProducto, { stockDeLaParte } from "./TarjetaProducto.jsx";
import ModalEditarProducto from "./ModalEditarProducto.jsx";
import Escaner from "./Escaner.jsx";
import IngresarMercaderia from "./IngresarMercaderia.jsx";
import MovimientosProducto from "./MovimientosProducto.jsx";
import ConteoProducto from "./ConteoProducto.jsx";
import { contiene, normalizar } from "../texto.js";

// Un producto es del inventario 2025 si le quedan unidades del 2025, o si ya se agotó
// y lo último que se vendió de él era del 2025. Si tiene de los dos, sale en ambas pestañas.
function es2025(producto) {
    return Number(producto.stock2025 ?? 0) > 0 || (producto.stock === 0 && Boolean(producto.fue2025));
}

function esNuevo(producto) {
    return !es2025(producto) || producto.stock > Number(producto.stock2025 ?? 0);
}

const PARTES = [
    { valor: "nuevo", texto: "🆕 Nuevo", incluye: esNuevo },
    { valor: "2025", texto: "📦 Del 2025", incluye: es2025 }
];

// Ventana con la tarjeta completa de un producto (se abre con el botón ⓘ de la búsqueda).
function VentanaInfo({ onCerrar, children }) {
    const dialogo = useRef(null);

    useEffect(() => {
        dialogo.current?.showModal();
    }, []);

    return (
        <dialog
            ref={dialogo}
            className="modal ventana-info"
            onClose={onCerrar}
            onClick={(e) => e.target === dialogo.current && onCerrar()}
            aria-label="Información del producto"
        >
            <div className="modal-contenido">
                <div className="modal-encabezado">
                    <h2>Información del producto</h2>
                    <button type="button" className="boton-cerrar-modal" onClick={onCerrar} aria-label="Cerrar">✕</button>
                </div>
                {children}
            </div>
        </dialog>
    );
}

export default function Inventario({
    esJefe,
    productos,
    errorProductos,
    onCambio,
    onRegistrar,
    onError
}) {
    const [parte, setParte] = useState("nuevo");
    const [busqueda, setBusqueda] = useState("");
    // Producto abierto en la lista (se ve su tarjeta completa debajo de la fila).
    const [abiertoId, setAbiertoId] = useState(null);
    // Producto cuya información completa se ve en una ventana (desde la búsqueda).
    const [infoId, setInfoId] = useState(null);
    // Historial de movimientos y conteo físico (solo el jefe).
    const [movimientosDe, setMovimientosDe] = useState(null);
    const [conteoDe, setConteoDe] = useState(null);
    const [productoEditando, setProductoEditando] = useState(null);
    const [escaneando, setEscaneando] = useState(false);
    const [ingresando, setIngresando] = useState(null);
    const [aviso, setAviso] = useState("");

    const codigoLeido = useCallback((codigo) => {
        setEscaneando(false);
        setBusqueda(codigo);
    }, []);

    const parteActual = PARTES.find((p) => p.valor === parte);
    const deLaParte = (productos ?? []).filter(parteActual.incluye);
    const texto = normalizar(busqueda);
    const filtrados = deLaParte.filter((producto) => contiene(texto, producto.nombre, producto.codigo));

    function tarjeta(producto, retraso) {
        return (
            <TarjetaProducto
                key={producto.id}
                producto={producto}
                parte={parte}
                esJefe={esJefe}
                retraso={retraso}
                onEditar={() => setProductoEditando(producto)}
                onIngresar={() => setIngresando(producto)}
                onEliminar={() => eliminar(producto)}
                onMovimientos={() => setMovimientosDe(producto)}
                onConteo={() => setConteoDe(producto)}
            />
        );
    }

    async function eliminar(producto) {
        if (!confirm(`¿Seguro que deseas eliminar "${producto.nombre}"?`)) {
            return;
        }

        try {
            await pedir(`/api/productos/${producto.id}`, { method: "DELETE" });
            await onCambio();
            alert("Producto eliminado correctamente.");
        } catch (error) {
            onError(error, () => alert(error.message));
        }
    }

    return (
        <div className="contenido-vista">
            <div className="selector-modalidad selector-filtro pestanas-inventario" role="tablist" aria-label="Inventario">
                {PARTES.map((p) => (
                    <button
                        key={p.valor}
                        type="button"
                        role="tab"
                        aria-selected={parte === p.valor}
                        className={parte === p.valor ? "activo" : ""}
                        onClick={() => setParte(p.valor)}
                    >
                        {p.texto}
                        {productos && <span className="conteo-pestana">{productos.filter(p.incluye).length}</span>}
                    </button>
                ))}
            </div>

            <section className={`tarjeta inventario ${parte === "2025" ? "inventario-2025" : ""}`}>
                <div className="encabezado-inventario">
                    <h2>{parte === "2025" ? "Inventario 2025" : "Inventario nuevo"}</h2>
                    {esJefe && onRegistrar && (
                        <button type="button" className="boton-secundario boton-pequeno" onClick={onRegistrar}>
                            ➕ Registrar producto
                        </button>
                    )}
                </div>
                {parte === "2025" && esJefe && (
                    <p className="ayuda-campo aviso-2025">Mercadería sobrante del año pasado: lo que se vende de aquí es ganancia del inventario 2025.</p>
                )}
                <p>Toca un producto de la lista para ver todos sus datos. Para encontrar uno rápido, búscalo por código o nombre, o escanea su código.</p>
                {aviso && <p className="mensaje mensaje-exito" role="status">✅ {aviso}</p>}

                <div className="buscador">
                    <label htmlFor="buscar-producto">Buscar por código o nombre</label>
                    <div className="campo-con-boton">
                        <input
                            type="search"
                            id="buscar-producto"
                            placeholder="Ej. CIN-001 o cinta..."
                            value={busqueda}
                            onChange={(e) => setBusqueda(e.target.value)}
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
                </div>

                {errorProductos ? (
                    <p className="mensaje mensaje-error">{errorProductos}</p>
                ) : productos === null ? (
                    <p>Cargando productos...</p>
                ) : deLaParte.length === 0 ? (
                    <p className="aviso-busqueda">
                        {parte === "2025" ? "No hay productos del inventario 2025." : "Todavía no hay productos nuevos registrados."}
                    </p>
                ) : filtrados.length === 0 ? (
                    <p>
                        No se encontraron productos con ese código o nombre en el {parte === "2025" ? "inventario 2025" : "inventario nuevo"}.
                        {(productos ?? []).some((p) => !parteActual.incluye(p) && contiene(texto, p.nombre, p.codigo)) && (
                            <>
                                {" "}
                                <button type="button" className="boton-enlace" onClick={() => setParte(parte === "2025" ? "nuevo" : "2025")}>
                                    Buscar en el {parte === "2025" ? "inventario nuevo" : "inventario 2025"}
                                </button>
                            </>
                        )}
                    </p>
                ) : (
                    <>
                        <p className="conteo-productos">
                            {texto
                                ? `${filtrados.length} de ${deLaParte.length} ${deLaParte.length === 1 ? "producto" : "productos"}`
                                : `${deLaParte.length} ${deLaParte.length === 1 ? "producto" : "productos"}`}
                        </p>
                        {texto ? (
                            // Al buscar: solo las fotos; el botón ⓘ muestra toda la información.
                            <ul className="galeria-inventario">
                                {filtrados.map((producto) => {
                                    const foto = urlFoto(producto);
                                    return (
                                        <li key={producto.id}>
                                            <button
                                                type="button"
                                                className="galeria-foto"
                                                onClick={() => setInfoId(producto.id)}
                                                aria-label={`Ver la información de ${producto.nombre}`}
                                                title={producto.nombre}
                                            >
                                                {foto ? (
                                                    <img src={foto} alt={producto.nombre} loading="lazy" />
                                                ) : (
                                                    <span className="galeria-sin-foto">
                                                        <span aria-hidden="true">📦</span>
                                                        {producto.nombre}
                                                    </span>
                                                )}
                                            </button>
                                            <button
                                                type="button"
                                                className="galeria-info"
                                                onClick={() => setInfoId(producto.id)}
                                                aria-label={`Información de ${producto.nombre}`}
                                            >
                                                i
                                            </button>
                                        </li>
                                    );
                                })}
                            </ul>
                        ) : (
                            // Sin búsqueda: lista compacta; al tocar una fila se ve su tarjeta.
                            <ul className="lista-inventario">
                                {filtrados.map((producto) => {
                                    const { stock } = stockDeLaParte(producto, parte);
                                    const abierto = abiertoId === producto.id;
                                    const foto = urlFoto(producto);

                                    return (
                                        <li key={producto.id} className={abierto ? "abierta" : ""}>
                                            <button
                                                type="button"
                                                className="fila-inventario"
                                                aria-expanded={abierto}
                                                onClick={() => setAbiertoId(abierto ? null : producto.id)}
                                            >
                                                <span className="fila-foto">
                                                    {foto ? <img src={foto} alt="" loading="lazy" /> : <span aria-hidden="true">📦</span>}
                                                </span>
                                                <span className="fila-nombre">
                                                    <strong>{producto.nombre}</strong>
                                                    <small>{producto.codigo || "Sin código"}</small>
                                                </span>
                                                <span className="fila-precio">
                                                    {moneda(producto.precio)}
                                                    <small>Doc. {moneda(producto.precioDocena)}</small>
                                                </span>
                                                <span className={`fila-stock ${stock === 0 ? "agotado" : stock <= 5 ? "bajo" : ""}`}>
                                                    {stock}
                                                    <small>u.</small>
                                                </span>
                                                <span className="fila-flecha" aria-hidden="true">{abierto ? "▴" : "▾"}</span>
                                            </button>
                                            {abierto && tarjeta(producto, 0)}
                                        </li>
                                    );
                                })}
                            </ul>
                        )}
                    </>
                )}
            </section>

            {ingresando && (
                <IngresarMercaderia
                    productos={productos}
                    productoInicial={ingresando}
                    onError={onError}
                    onCerrar={() => setIngresando(null)}
                    onGuardado={async (resultado) => {
                        setIngresando(null);
                        setAviso(`${resultado.mensaje} Nuevo stock: ${resultado.stock} u.`);
                        await onCambio();
                    }}
                />
            )}

            {escaneando && (
                <Escaner onLeido={codigoLeido} onCerrar={() => setEscaneando(false)} />
            )}

            {infoId && (productos ?? []).some((p) => p.id === infoId) && (
                <VentanaInfo onCerrar={() => setInfoId(null)}>
                    {tarjeta((productos ?? []).find((p) => p.id === infoId), 0)}
                </VentanaInfo>
            )}

            {movimientosDe && (
                <MovimientosProducto producto={movimientosDe} onError={onError} onCerrar={() => setMovimientosDe(null)} />
            )}

            {conteoDe && (
                <ConteoProducto
                    producto={conteoDe}
                    onError={onError}
                    onCerrar={() => setConteoDe(null)}
                    onGuardado={async (resultado) => {
                        setConteoDe(null);
                        setAviso(`${conteoDe.nombre}: ${resultado.mensaje}`);
                        await onCambio();
                    }}
                />
            )}

            {productoEditando && (
                <ModalEditarProducto
                    producto={productoEditando}
                    onCerrar={() => setProductoEditando(null)}
                    onGuardado={async () => {
                        setProductoEditando(null);
                        await onCambio();
                    }}
                    onError={onError}
                />
            )}
        </div>
    );
}
