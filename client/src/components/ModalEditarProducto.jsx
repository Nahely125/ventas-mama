import { useEffect, useRef, useState } from "react";
import { pedir } from "../api.js";
import { validarProducto } from "../producto.js";
import CamposProducto from "./CamposProducto.jsx";
import { guardarFoto, urlFoto } from "../fotos.js";

export default function ModalEditarProducto({ producto, onCerrar, onGuardado, onError }) {
    const dialogo = useRef(null);
    const unidades = Number(producto.unidadesPorCaja ?? 1);

    // El servidor guarda el costo por unidad; aquí se edita el costo por caja.
    const [valores, setValores] = useState({
        codigo: producto.codigo ?? "",
        nombre: producto.nombre,
        precio: String(producto.precio),
        // El mínimo por docena se recalcula solo si coincide con mínimo × 12.
        precioMinimoDocena: String(producto.precioMinimoDocena ?? ""),
        minimoDocenaAuto: Number(producto.precioMinimoDocena).toFixed(2) === (Number(producto.precioMinimo) * 12).toFixed(2),
        stock2025: String(producto.stock2025 ?? 0),
        precioMinimo: String(producto.precioMinimo ?? ""),
        precioCompra: (Number(producto.precioCompra) * unidades).toFixed(2),
        unidadesPorCaja: String(unidades),
        // Stock nuevo = total − sobrante del 2025.
        stockNuevo: String(producto.stock - (producto.stock2025 ?? 0)),
        seccionId: producto.seccionId ? String(producto.seccionId) : "",
        categoriaId: producto.categoriaId ? String(producto.categoriaId) : "",
        // Al editar no se cambia la ubicación sola: ya fue elegida.
        ubicacionManual: true,
        foto: undefined,
        fotoActual: urlFoto(producto)
    });
    const [error, setError] = useState("");
    const [guardando, setGuardando] = useState(false);

    useEffect(() => {
        dialogo.current?.showModal();
    }, []);

    async function guardar(evento) {
        evento.preventDefault();

        const resultado = validarProducto(valores);

        if (resultado.error) {
            setError(resultado.error);
            return;
        }

        setGuardando(true);

        try {
            await pedir(`/api/productos/${producto.id}`, {
                method: "PUT",
                cuerpo: resultado.datos
            });
            await guardarFoto(producto.id, valores.foto);
            await onGuardado();
        } catch (err) {
            onError(err, () => setError(err.message));
            setGuardando(false);
        }
    }

    return (
        <dialog
            ref={dialogo}
            className="modal"
            onClose={onCerrar}
            onClick={(e) => e.target === dialogo.current && onCerrar()}
            aria-labelledby="titulo-editar"
        >
            <form onSubmit={guardar} className="formulario modal-contenido">
                <div className="modal-encabezado">
                    <h2 id="titulo-editar">Editar producto</h2>
                    <button
                        type="button"
                        className="boton-cerrar-modal"
                        onClick={onCerrar}
                        aria-label="Cerrar"
                    >
                        ✕
                    </button>
                </div>

                <CamposProducto
                    valores={valores}
                    onCambio={setValores}
                    prefijo="editar"
                    etiquetaCompra="Costo de compra por caja (S/)"
                />

                {error && <p className="mensaje mensaje-error" role="alert">{error}</p>}

                <div className="modal-acciones">
                    <button type="button" className="boton-secundario" onClick={onCerrar}>
                        Cancelar
                    </button>
                    <button type="submit" className="boton-principal" disabled={guardando}>
                        {guardando ? "Guardando..." : "Guardar cambios"}
                    </button>
                </div>
            </form>
        </dialog>
    );
}
