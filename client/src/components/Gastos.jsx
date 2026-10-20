import { useCallback, useEffect, useState } from "react";
import { moneda, pedir } from "../api.js";
import { formatearDia, hoy, mesesDisponibles, nombreMes } from "../fechas.js";

const VALORES_INICIALES = {
    descripcion: "",
    categoria: "",
    monto: "",
    fecha: hoy()
};

export default function Gastos({ onCambio, onError }) {
    const [gastos, setGastos] = useState(null);
    const [categorias, setCategorias] = useState([]);
    const [errorLista, setErrorLista] = useState("");
    const [valores, setValores] = useState(VALORES_INICIALES);
    const [mes, setMes] = useState(hoy().slice(0, 7));
    const [mensaje, setMensaje] = useState(null);
    const [enviando, setEnviando] = useState(false);

    const cargarGastos = useCallback(async () => {
        try {
            setGastos(await pedir("/api/gastos"));
            setErrorLista("");
        } catch (error) {
            onError(error, () => setErrorLista(error.message));
        }
    }, [onError]);

    useEffect(() => {
        cargarGastos();
        pedir("/api/gastos/categorias")
            .then(setCategorias)
            .catch((error) => onError(error));
    }, [cargarGastos, onError]);

    function cambiar(evento) {
        const { name, value } = evento.target;
        setValores((anteriores) => ({ ...anteriores, [name]: value }));
    }

    async function enviar(evento) {
        evento.preventDefault();

        const monto = Number(valores.monto);

        if (!valores.descripcion.trim() || !valores.categoria || !valores.fecha) {
            setMensaje({ tipo: "error", texto: "Completa la descripción, la categoría y la fecha." });
            return;
        }

        if (!Number.isFinite(monto) || monto <= 0) {
            setMensaje({ tipo: "error", texto: "El monto debe ser mayor que cero." });
            return;
        }

        setEnviando(true);

        try {
            await pedir("/api/gastos", {
                method: "POST",
                cuerpo: {
                    descripcion: valores.descripcion.trim(),
                    categoria: valores.categoria,
                    monto,
                    fecha: valores.fecha
                }
            });

            setMensaje({ tipo: "exito", texto: "¡Gasto registrado correctamente!" });
            setMes(valores.fecha.slice(0, 7));
            setValores({ ...VALORES_INICIALES, fecha: valores.fecha });
            await Promise.all([cargarGastos(), onCambio()]);
        } catch (error) {
            onError(error, () => setMensaje({ tipo: "error", texto: error.message }));
        } finally {
            setEnviando(false);
        }
    }

    async function eliminar(gasto) {
        if (!confirm(`¿Eliminar el gasto "${gasto.descripcion}" de ${moneda(gasto.monto)}?`)) {
            return;
        }

        try {
            await pedir(`/api/gastos/${gasto.id}`, { method: "DELETE" });
            await Promise.all([cargarGastos(), onCambio()]);
        } catch (error) {
            onError(error, () => alert(error.message));
        }
    }

    const meses = mesesDisponibles((gastos ?? []).map((g) => g.fecha));

    const filtrados = (gastos ?? []).filter((gasto) => mes === "todos" || gasto.fecha.startsWith(mes));
    const totalPeriodo = filtrados.reduce((suma, gasto) => suma + Number(gasto.monto), 0);

    const porCategoria = Object.entries(
        filtrados.reduce((acumulado, gasto) => {
            acumulado[gasto.categoria] = (acumulado[gasto.categoria] ?? 0) + Number(gasto.monto);
            return acumulado;
        }, {})
    ).sort((a, b) => b[1] - a[1]);

    return (
        <div className="contenido-vista vista-gastos">
            <section className="tarjeta formulario-gasto">
                <h2>Registrar gasto</h2>

                <form onSubmit={enviar} className="formulario">
                    <div className="campo">
                        <label htmlFor="gasto-descripcion">Descripción</label>
                        <input
                            type="text"
                            id="gasto-descripcion"
                            name="descripcion"
                            placeholder="Ej. Compra de cintas en el mercado"
                            maxLength={200}
                            value={valores.descripcion}
                            onChange={cambiar}
                            required
                        />
                    </div>

                    <div className="fila-campos fila-gasto">
                        <div className="campo">
                            <label htmlFor="gasto-categoria">Categoría</label>
                            <select
                                id="gasto-categoria"
                                name="categoria"
                                value={valores.categoria}
                                onChange={cambiar}
                                required
                            >
                                <option value="">Selecciona...</option>
                                {categorias.map((categoria) => (
                                    <option key={categoria} value={categoria}>{categoria}</option>
                                ))}
                            </select>
                        </div>

                        <div className="campo">
                            <label htmlFor="gasto-monto">Monto (S/)</label>
                            <input
                                type="number"
                                id="gasto-monto"
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
                            <label htmlFor="gasto-fecha">Fecha</label>
                            <input
                                type="date"
                                id="gasto-fecha"
                                name="fecha"
                                max={hoy()}
                                value={valores.fecha}
                                onChange={cambiar}
                                required
                            />
                        </div>
                    </div>

                    <button type="submit" className="boton-principal" disabled={enviando}>
                        {enviando ? "Registrando..." : "Registrar gasto"}
                    </button>

                    {mensaje && (
                        <p className={`mensaje mensaje-${mensaje.tipo}`} role="status" aria-live="polite">
                            {mensaje.texto}
                        </p>
                    )}
                </form>
            </section>

            <section className="tarjeta lista-gastos-seccion">
                <div className="encabezado-seccion">
                    <h2>Mis gastos</h2>

                    <div className="campo filtro-mes">
                        <label htmlFor="filtro-mes">Periodo</label>
                        <select id="filtro-mes" value={mes} onChange={(e) => setMes(e.target.value)}>
                            {meses.map((clave) => (
                                <option key={clave} value={clave}>{nombreMes(clave)}</option>
                            ))}
                            <option value="todos">Todos los gastos</option>
                        </select>
                    </div>
                </div>

                {errorLista ? (
                    <p className="mensaje mensaje-error">{errorLista}</p>
                ) : gastos === null ? (
                    <p>Cargando gastos...</p>
                ) : (
                    <>
                        <div className="total-gastos">
                            <span>Total gastado</span>
                            <strong>{moneda(totalPeriodo)}</strong>
                        </div>

                        {porCategoria.length > 0 && (
                            <ul className="gastos-categorias" aria-label="Gastos por categoría">
                                {porCategoria.map(([categoria, monto]) => (
                                    <li key={categoria}>
                                        <div className="categoria-fila">
                                            <span>{categoria}</span>
                                            <strong>{moneda(monto)}</strong>
                                        </div>
                                        <div className="barra-categoria" aria-hidden="true">
                                            <span style={{ width: `${(monto / totalPeriodo) * 100}%` }}></span>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        )}

                        {filtrados.length === 0 ? (
                            <p>No hay gastos registrados en este periodo.</p>
                        ) : (
                            <ul className="lista-gastos">
                                {filtrados.map((gasto) => (
                                    <li className="gasto" key={gasto.id}>
                                        <div className="gasto-datos">
                                            <strong>{gasto.descripcion}</strong>
                                            <span>
                                                <span className="etiqueta etiqueta-trabajador">{gasto.categoria}</span>{" "}
                                                {formatearDia(gasto.fecha)}
                                            </span>
                                        </div>
                                        <strong className="gasto-monto">{moneda(gasto.monto)}</strong>
                                        <button
                                            type="button"
                                            className="boton-icono"
                                            onClick={() => eliminar(gasto)}
                                            aria-label={`Eliminar gasto ${gasto.descripcion}`}
                                            title="Eliminar"
                                        >
                                            🗑️
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </>
                )}
            </section>
        </div>
    );
}
