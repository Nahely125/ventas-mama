import { useCallback, useEffect, useState } from "react";
import { moneda, pedir } from "../api.js";
import { formatearDia, hoy } from "../fechas.js";
import RecuperacionInversion from "./RecuperacionInversion.jsx";

const VALORES_INICIALES = {
    descripcion: "",
    monto: "",
    fecha: hoy()
};

export default function Inversion({ resumen, onCambio, onError }) {
    const [inversiones, setInversiones] = useState(null);
    const [errorLista, setErrorLista] = useState("");
    const [valores, setValores] = useState(VALORES_INICIALES);
    const [mensaje, setMensaje] = useState(null);
    const [enviando, setEnviando] = useState(false);

    const cargarInversiones = useCallback(async () => {
        try {
            setInversiones(await pedir("/api/inversiones"));
            setErrorLista("");
        } catch (error) {
            onError(error, () => setErrorLista(error.message));
        }
    }, [onError]);

    useEffect(() => {
        cargarInversiones();
        onCambio();
    }, [cargarInversiones, onCambio]);

    function cambiar(evento) {
        const { name, value } = evento.target;
        setValores((anteriores) => ({ ...anteriores, [name]: value }));
    }

    async function enviar(evento) {
        evento.preventDefault();

        const monto = Number(valores.monto);

        if (!valores.descripcion.trim() || !valores.fecha) {
            setMensaje({ tipo: "error", texto: "Completa la descripción y la fecha." });
            return;
        }

        if (!Number.isFinite(monto) || monto <= 0) {
            setMensaje({ tipo: "error", texto: "El monto debe ser mayor que cero." });
            return;
        }

        setEnviando(true);

        try {
            await pedir("/api/inversiones", {
                method: "POST",
                cuerpo: { descripcion: valores.descripcion.trim(), monto, fecha: valores.fecha }
            });

            setMensaje({ tipo: "exito", texto: "¡Inversión registrada correctamente!" });
            setValores({ ...VALORES_INICIALES, fecha: valores.fecha });
            await Promise.all([cargarInversiones(), onCambio()]);
        } catch (error) {
            onError(error, () => setMensaje({ tipo: "error", texto: error.message }));
        } finally {
            setEnviando(false);
        }
    }

    async function eliminar(inversion) {
        if (!confirm(`¿Eliminar la inversión "${inversion.descripcion}" de ${moneda(inversion.monto)}?`)) {
            return;
        }

        try {
            await pedir(`/api/inversiones/${inversion.id}`, { method: "DELETE" });
            await Promise.all([cargarInversiones(), onCambio()]);
        } catch (error) {
            onError(error, () => alert(error.message));
        }
    }

    return (
        <div className="contenido-vista">
            <RecuperacionInversion resumen={resumen} />

            <div className="vista-gastos">
                <section className="tarjeta formulario-gasto">
                    <h2>Registrar inversión</h2>
                    <p className="descripcion-seccion">
                        Anota el dinero que pusiste en el negocio: mercadería inicial, equipos, el puesto, etc.
                    </p>

                    <form onSubmit={enviar} className="formulario">
                        <div className="campo">
                            <label htmlFor="inversion-descripcion">Descripción</label>
                            <input
                                type="text"
                                id="inversion-descripcion"
                                name="descripcion"
                                placeholder="Ej. Compra inicial de adornos navideños"
                                maxLength={200}
                                value={valores.descripcion}
                                onChange={cambiar}
                                required
                            />
                        </div>

                        <div className="fila-campos fila-dos">
                            <div className="campo">
                                <label htmlFor="inversion-monto">Monto (S/)</label>
                                <input
                                    type="number"
                                    id="inversion-monto"
                                    name="monto"
                                    min="0.01"
                                    step="0.01"
                                    inputMode="decimal"
                                    placeholder="0.00"
                                    value={valores.monto}
                                    onChange={cambiar}
                                    required
                                />
                            </div>

                            <div className="campo">
                                <label htmlFor="inversion-fecha">Fecha</label>
                                <input
                                    type="date"
                                    id="inversion-fecha"
                                    name="fecha"
                                    max={hoy()}
                                    value={valores.fecha}
                                    onChange={cambiar}
                                    required
                                />
                            </div>
                        </div>

                        <button type="submit" className="boton-principal" disabled={enviando}>
                            {enviando ? "Registrando..." : "Registrar inversión"}
                        </button>

                        {mensaje && (
                            <p className={`mensaje mensaje-${mensaje.tipo}`} role="status" aria-live="polite">
                                {mensaje.texto}
                            </p>
                        )}
                    </form>
                </section>

                <section className="tarjeta">
                    <h2>Inversiones registradas</h2>

                    {errorLista ? (
                        <p className="mensaje mensaje-error">{errorLista}</p>
                    ) : inversiones === null ? (
                        <p>Cargando inversiones...</p>
                    ) : inversiones.length === 0 ? (
                        <p>Todavía no hay inversiones registradas.</p>
                    ) : (
                        <ul className="lista-gastos">
                            {inversiones.map((inversion) => (
                                <li className="gasto" key={inversion.id}>
                                    <div className="gasto-datos">
                                        <strong>{inversion.descripcion}</strong>
                                        <span>{formatearDia(inversion.fecha)}</span>
                                    </div>
                                    <strong className="gasto-monto monto-inversion">{moneda(inversion.monto)}</strong>
                                    <button
                                        type="button"
                                        className="boton-icono"
                                        onClick={() => eliminar(inversion)}
                                        aria-label={`Eliminar inversión ${inversion.descripcion}`}
                                        title="Eliminar"
                                    >
                                        🗑️
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}
                </section>
            </div>
        </div>
    );
}
