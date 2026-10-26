import { useCallback, useState } from "react";
import { pedir } from "../api.js";
import TarjetaProducto from "./TarjetaProducto.jsx";
import ModalEditarProducto from "./ModalEditarProducto.jsx";
import Escaner from "./Escaner.jsx";
import IngresarMercaderia from "./IngresarMercaderia.jsx";

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
    const texto = busqueda.trim().toLowerCase();
    const filtrados = deLaParte.filter((producto) =>
        producto.nombre.toLowerCase().includes(texto) ||
        (producto.codigo ?? "").toLowerCase().includes(texto)
    );

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
                {parte === "2025" && (
                    <p className="ayuda-campo aviso-2025">Mercadería sobrante del año pasado: lo que se vende de aquí es ganancia del inventario 2025.</p>
                )}
                <p>Busca un producto por su código o nombre, o escanea su código.</p>
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
                ) : !texto ? (
                    <p className="aviso-busqueda">
                        <span aria-hidden="true">🔎</span>{" "}
                        {deLaParte.length === 0
                            ? (parte === "2025" ? "No hay productos del inventario 2025." : "Todavía no hay productos nuevos registrados.")
                            : `Hay ${deLaParte.length} ${deLaParte.length === 1 ? "producto" : "productos"} en este inventario. Escribe o escanea para ver uno.`}
                    </p>
                ) : filtrados.length === 0 ? (
                    <p>
                        No se encontraron productos con ese código o nombre en el {parte === "2025" ? "inventario 2025" : "inventario nuevo"}.
                        {(productos ?? []).some((p) => !parteActual.incluye(p) && (p.nombre.toLowerCase().includes(texto) || (p.codigo ?? "").toLowerCase().includes(texto))) && (
                            <>
                                {" "}
                                <button type="button" className="boton-enlace" onClick={() => setParte(parte === "2025" ? "nuevo" : "2025")}>
                                    Buscar en el {parte === "2025" ? "inventario nuevo" : "inventario 2025"}
                                </button>
                            </>
                        )}
                    </p>
                ) : (
                    <div className="lista-productos">
                        {filtrados.map((producto, indice) => (
                            <TarjetaProducto
                                key={producto.id}
                                producto={producto}
                                parte={parte}
                                esJefe={esJefe}
                                retraso={Math.min(indice * 70, 490)}
                                onEditar={() => setProductoEditando(producto)}
                                onIngresar={() => setIngresando(producto)}
                                onEliminar={() => eliminar(producto)}
                            />
                        ))}
                    </div>
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
