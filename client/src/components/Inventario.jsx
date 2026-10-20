import { useState } from "react";
import { pedir } from "../api.js";
import TarjetaProducto from "./TarjetaProducto.jsx";
import FormularioProducto from "./FormularioProducto.jsx";
import ModalEditarProducto from "./ModalEditarProducto.jsx";

export default function Inventario({
    esJefe,
    productos,
    errorProductos,
    onCambio,
    onError
}) {
    const [busqueda, setBusqueda] = useState("");
    const [productoEditando, setProductoEditando] = useState(null);

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
                <p>Aquí aparecerán los productos registrados en tu base de datos.</p>

                <div className="buscador">
                    <label htmlFor="buscar-producto">Buscar por código o nombre</label>
                    <input
                        type="search"
                        id="buscar-producto"
                        placeholder="Ej. CIN-001 o cinta..."
                        value={busqueda}
                        onChange={(e) => setBusqueda(e.target.value)}
                    />
                </div>

                {errorProductos ? (
                    <p className="mensaje mensaje-error">{errorProductos}</p>
                ) : productos === null ? (
                    <p>Cargando productos...</p>
                ) : filtrados.length === 0 ? (
                    <p>
                        {texto
                            ? "No se encontraron productos con ese código o nombre."
                            : "Todavía no hay productos registrados."}
                    </p>
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
