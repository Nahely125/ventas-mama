import { useCallback, useEffect, useState } from "react";
import { moneda, pedir } from "../api.js";
import { formatearDia, hoy, mesesDisponibles, nombreMes } from "../fechas.js";
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
    const [modo, setModo] = useState("todo");
    const [dia, setDia] = useState(hoy());
    const [mes, setMes] = useState(hoy().slice(0, 7));
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
            // Mostrar el día de la inversión recién registrada.
            setDia(valores.fecha);
            setModo(valores.fecha === hoy() ? "hoy" : "dia");
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

    const meses = mesesDisponibles((inversiones ?? []).map((i) => i.fecha));

    const filtradas = (inversiones ?? []).filter((inversion) => {
        if (modo === "hoy") return inversion.fecha === hoy();
        if (modo === "dia") return inversion.fecha === dia;
        if (modo === "mes") return inversion.fecha.startsWith(mes);
        return true;
    });
    const totalPeriodo = filtradas.reduce((suma, inversion) => suma + Number(inversion.monto), 0);

    // Inversiones agrupadas por día (del más reciente al más antiguo), con su total.
    const porDia = Object.entries(
        filtradas.reduce((acumulado, inversion) => {
            (acumulado[inversion.fecha] ??= []).push(inversion);
            return acumulado;
        }, {})
    ).sort((a, b) => b[0].localeCompare(a[0]));

    const periodo = {
        hoy: `Hoy, ${formatearDia(hoy())}`,
        dia: dia ? formatearDia(dia) : "Elige un día",
        mes: nombreMes(mes),
        todo: "Todas las inversiones"
    }[modo];

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

                    <div className="filtros-gastos">
                        <div className="selector-modalidad selector-filtro" role="radiogroup" aria-label="Ver inversiones de">
                            {[
                                { valor: "hoy", texto: "Hoy" },
                                { valor: "dia", texto: "Por día" },
                                { valor: "mes", texto: "Por mes" },
                                { valor: "todo", texto: "Todo" }
                            ].map((opcion) => (
                                <button
                                    key={opcion.valor}
                                    type="button"
                                    role="radio"
                                    aria-checked={modo === opcion.valor}
                                    className={modo === opcion.valor ? "activo" : ""}
                                    onClick={() => setModo(opcion.valor)}
                                >
                                    {opcion.texto}
                                </button>
                            ))}
                        </div>

                        {modo === "dia" && (
                            <div className="campo">
                                <label htmlFor="filtro-dia-inversiones">Día</label>
                                <input
                                    type="date"
                                    id="filtro-dia-inversiones"
                                    max={hoy()}
                                    value={dia}
                                    onChange={(e) => setDia(e.target.value)}
                                />
                            </div>
                        )}

                        {modo === "mes" && (
                            <div className="campo">
                                <label htmlFor="filtro-mes-inversiones">Mes</label>
                                <select id="filtro-mes-inversiones" value={mes} onChange={(e) => setMes(e.target.value)}>
                                    {meses.map((clave) => (
                                        <option key={clave} value={clave}>{nombreMes(clave)}</option>
                                    ))}
                                </select>
                            </div>
                        )}

                        <p className="periodo-actual">
                            <span aria-hidden="true">📅</span> {periodo}
                        </p>
                    </div>

                    {errorLista ? (
                        <p className="mensaje mensaje-error">{errorLista}</p>
                    ) : inversiones === null ? (
                        <p>Cargando inversiones...</p>
                    ) : (
                        <>
                            <div className="total-gastos total-inversiones">
                                <span>Total invertido</span>
                                <strong>{moneda(totalPeriodo)}</strong>
                            </div>

                            {filtradas.length === 0 ? (
                                <p>No hay inversiones registradas en este periodo.</p>
                            ) : (
                                porDia.map(([fecha, delDia]) => (
                                    <section className="gastos-del-dia" key={fecha}>
                                        <h3 className="titulo-dia">
                                            <span>{fecha === hoy() ? `Hoy · ${formatearDia(fecha)}` : formatearDia(fecha)}</span>
                                            <strong>{moneda(delDia.reduce((suma, i) => suma + Number(i.monto), 0))}</strong>
                                        </h3>
                                        <ul className="lista-gastos">
                                            {delDia.map((inversion) => (
                                                <li className="gasto" key={inversion.id}>
                                                    <div className="gasto-datos">
                                                        <strong>{inversion.descripcion}</strong>
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
                                    </section>
                                ))
                            )}
                        </>
                    )}
                </section>
            </div>
        </div>
    );
}
