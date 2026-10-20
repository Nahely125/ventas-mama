import { useState } from "react";
import { pedir } from "../api.js";
import { textoCostoUnitario, validarProducto } from "../producto.js";
import CamposProducto from "./CamposProducto.jsx";

const VALORES_INICIALES = {
    codigo: "",
    nombre: "",
    precio: "",
    precioDocena: "",
    docenaAuto: true,
    precioMinimo: "",
    precioCompra: "",
    unidadesPorCaja: "1",
    stock: ""
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
            await pedir("/api/productos", { method: "POST", cuerpo: datos });
            setMensaje({ tipo: "exito", texto: "¡Producto registrado correctamente!" });
            setValores(VALORES_INICIALES);
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

                <p className="costo-calculado">
                    {textoCostoUnitario(valores.precioCompra, valores.unidadesPorCaja)}
                </p>

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
