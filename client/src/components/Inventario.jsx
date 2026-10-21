import { useCallback, useState } from "react";
import { pedir } from "../api.js";
import TarjetaProducto from "./TarjetaProducto.jsx";
import FormularioProducto from "./FormularioProducto.jsx";
import ModalEditarProducto from "./ModalEditarProducto.jsx";
import Escaner from "./Escaner.jsx";

export default function Inventario({
    esJefe,
    productos,
    errorProductos,
    onCambio,
    onError
}) {
    const [busqueda, setBusqueda] = useState("");
    const [productoEditando, setProductoEditando] = useState(null);
    const [escaneando, setEscaneando] = useState(false);

    const codigoLeido = useCallback((codigo) => {
        setEscaneando(false);
        setBusqueda(codigo);
    }, []);

    const texto = busqueda.trim().toLowerCase();
    const filtrados = (productos ?? []).filter((producto) =>
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
            <section className="tarjeta inventario">
                <h2>Inventario de productos</h2>
                <p>Busca un producto por su código o nombre, o escanea su código.</p>

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
                        {productos.length === 0
                            ? "Todavía no hay productos registrados."
                            : `Hay ${productos.length} ${productos.length === 1 ? "producto registrado" : "productos registrados"}. Escribe o escanea para ver uno.`}
                    </p>
                ) : filtrados.length === 0 ? (
                    <p>No se encontraron productos con ese código o nombre.</p>
                ) : (
                    <div className="lista-productos">
                        {filtrados.map((producto, indice) => (
                            <TarjetaProducto
                                key={producto.id}
                                producto={producto}
                                esJefe={esJefe}
                                retraso={Math.min(indice * 70, 490)}
                                onEditar={() => setProductoEditando(producto)}
                                onEliminar={() => eliminar(producto)}
                            />
                        ))}
                    </div>
                )}
            </section>

            {esJefe && (
                <FormularioProducto onCreado={onCambio} onError={onError} />
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
