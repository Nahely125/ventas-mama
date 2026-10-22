import { useState } from "react";
import { pedir } from "../api.js";
import { validarProducto } from "../producto.js";
import CamposProducto from "./CamposProducto.jsx";
import { guardarFoto } from "../fotos.js";

const VALORES_INICIALES = {
    codigo: "",
    nombre: "",
    precio: "",
    precioMinimo: "",
    precioUnidadDocena: "",
    precioCompra: "",
    unidadesPorCaja: "1",
    stock: "",
    // Colores (opcional): [{ nombre, stock }]; el stock del producto es la suma.
    usaColores: false,
    colores: [],
    es2025: false,
    seccionId: "",
    categoriaId: "",
    foto: undefined
};

export default function FormularioProducto({ onCreado, onError }) {
    const [valores, setValores] = useState(VALORES_INICIALES);
    const [mensaje, setMensaje] = useState(null);
    const [enviando, setEnviando] = useState(false);

    async function enviar(evento) {
        evento.preventDefault();

        const { datos, error } = validarProducto(valores);

        if (error) {
            setMensaje({ tipo: "error", texto: error });
            return;
        }

        setEnviando(true);

        try {
            const resultado = await pedir("/api/productos", { method: "POST", cuerpo: datos });

            try {
                await guardarFoto(resultado.producto.id, valores.foto ?? undefined);
                setMensaje({ tipo: "exito", texto: "¡Producto registrado correctamente!" });
            } catch (errorFoto) {
                setMensaje({
                    tipo: "error",
                    texto: `El producto se registró, pero la foto no se pudo guardar: ${errorFoto.message}`
                });
            }

            // Se mantiene la sección para registrar varios productos de la misma feria seguidos.
            setValores({ ...VALORES_INICIALES, seccionId: valores.seccionId, categoriaId: valores.categoriaId });
            await onCreado();
        } catch (err) {
            onError(err, () => setMensaje({ tipo: "error", texto: err.message }));
        } finally {
            setEnviando(false);
        }
    }

    return (
        <section className="tarjeta formulario-producto">
            <h2>Registrar producto</h2>

            <form onSubmit={enviar} className="formulario">
                <CamposProducto
                    valores={valores}
                    onCambio={setValores}
                    prefijo="nuevo"
                    etiquetaCompra="Costo de compra (S/)"
                />

                <button type="submit" className="boton-principal" disabled={enviando}>
                    {enviando ? "Registrando..." : "Registrar producto"}
                </button>

                {mensaje && (
                    <p
                        className={`mensaje mensaje-${mensaje.tipo}`}
                        role="status"
                        aria-live="polite"
                    >
                        {mensaje.texto}
                    </p>
                )}
            </form>
        </section>
    );
}
