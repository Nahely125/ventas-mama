import { useCallback, useEffect, useState } from "react";
import { moneda, pedir } from "../api.js";
import { formatearDia, hoy } from "../fechas.js";
import { nombreMetodoPago } from "../venta.js";

const PESTANAS = [
    { valor: "caja", texto: "💵 Cierre de caja" },
    { valor: "empleados", texto: "👥 Por empleado" },
    { valor: "productos", texto: "🏷️ Productos" }
];

// Día de hoy menos n días (YYYY-MM-DD, hora local).
function haceDias(n) {
    const fecha = new Date();
    fecha.setDate(fecha.getDate() - n);
    return `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, "0")}-${String(fecha.getDate()).padStart(2, "0")}`;
}

const PERIODOS = [
    { valor: "hoy", texto: "Hoy", rango: () => [hoy(), hoy()] },
    { valor: "7", texto: "7 días", rango: () => [haceDias(6), hoy()] },
    { valor: "30", texto: "30 días", rango: () => [haceDias(29), hoy()] },
    { valor: "mes", texto: "Este mes", rango: () => [`${hoy().slice(0, 7)}-01`, hoy()] }
];

// Botones de periodo y fechas a mano. Devuelve [desde, hasta] por onCambio.
function SelectorPeriodo({ desde, hasta, onCambio }) {
    const activo = PERIODOS.find((p) => {
        const [d, h] = p.rango();
        return d === desde && h === hasta;
    })?.valor;

    return (
        <div className="filtros-gastos selector-periodo">
            <div className="selector-modalidad selector-filtro" role="radiogroup" aria-label="Periodo">
                {PERIODOS.map((periodo) => (
                    <button
                        key={periodo.valor}
                        type="button"
                        role="radio"
                        aria-checked={activo === periodo.valor}
                        className={activo === periodo.valor ? "activo" : ""}
                        onClick={() => onCambio(...periodo.rango())}
                    >
                        {periodo.texto}
                    </button>
                ))}
            </div>
            <div className="fila-campos fila-dos">
                <div className="campo">
                    <label htmlFor="reporte-desde">Desde</label>
                    <input type="date" id="reporte-desde" max={hasta} value={desde} onChange={(e) => e.target.value && onCambio(e.target.value, hasta)} />
                </div>
                <div className="campo">
                    <label htmlFor="reporte-hasta">Hasta</label>
                    <input type="date" id="reporte-hasta" min={desde} max={hoy()} value={hasta} onChange={(e) => e.target.value && onCambio(desde, e.target.value)} />
                </div>
            </div>
        </div>
    );
}

// Carga un reporte cada vez que cambia la dirección.
function useReporte(url, onError) {
    const [datos, setDatos] = useState(null);
    const [error, setError] = useState("");

    const cargar = useCallback(async () => {
        setDatos(null);
        try {
            setDatos(await pedir(url));
            setError("");
        } catch (err) {
            onError(err, () => setError(err.message));
        }
    }, [url, onError]);

    useEffect(() => {
        cargar();
    }, [cargar]);

    return { datos, error, recargar: cargar };
}

function CierreCaja({ onError }) {
    const [dia, setDia] = useState(hoy());
    const { datos, error, recargar } = useReporte(`/api/reportes/caja?dia=${dia}`, onError);
    const [contado, setContado] = useState("");
    const [nota, setNota] = useState("");
    const [mensaje, setMensaje] = useState(null);
    const [guardando, setGuardando] = useState(false);

    useEffect(() => {
        setContado(datos?.cierre ? String(Number(datos.cierre.efectivoContado)) : "");
        setNota(datos?.cierre?.nota ?? "");
        setMensaje(null);
    }, [datos]);

    const diferencia = contado !== "" && datos ? Number(contado) - Number(datos.efectivoEsperado) : null;

    async function guardar(evento) {
        evento.preventDefault();

        if (contado === "" || !(Number(contado) >= 0)) {
            setMensaje({ tipo: "error", texto: "Escribe cuánto efectivo contaste." });
            return;
        }

        setGuardando(true);

        try {
            const resultado = await pedir("/api/reportes/caja", {
                method: "POST",
                cuerpo: { dia, efectivoContado: Number(contado), nota: nota.trim() }
            });
            await recargar();
            setMensaje({ tipo: Number(resultado.diferencia) === 0 ? "exito" : "error", texto: resultado.mensaje });
        } catch (err) {
            onError(err, () => setMensaje({ tipo: "error", texto: err.message }));
        } finally {
            setGuardando(false);
        }
    }

    return (
        <section className="tarjeta reporte">
            <div className="encabezado-seccion">
                <h2>Cierre de caja</h2>
                <div className="campo filtro-mes">
                    <label htmlFor="dia-caja">Día</label>
                    <input type="date" id="dia-caja" max={hoy()} value={dia} onChange={(e) => e.target.value && setDia(e.target.value)} />
                </div>
            </div>

            {error ? (
                <p className="mensaje mensaje-error">{error}</p>
            ) : datos === null ? (
                <p>Calculando...</p>
            ) : (
                <>
                    <p className="periodo-actual">
                        📅 {dia === hoy() ? `Hoy, ${formatearDia(dia)}` : formatearDia(dia)} · {datos.ventas}{" "}
                        {datos.ventas === 1 ? "venta cobrada" : "ventas cobradas"}
                    </p>

                    <div className="tabla-contenedor">
                        <table className="tabla-dias tabla-caja">
                            <thead>
                                <tr>
                                    <th>Método</th>
                                    <th>Ventas</th>
                                    <th>Abonos de fiados</th>
                                    <th>Devoluciones</th>
                                    <th>Entró</th>
                                </tr>
                            </thead>
                            <tbody>
                                {datos.metodos.map((m) => (
                                    <tr key={m.metodo}>
                                        <td data-etiqueta="Método" className="celda-dia">{nombreMetodoPago(m.metodo)}</td>
                                        <td data-etiqueta="Ventas">{moneda(m.ventas)}</td>
                                        <td data-etiqueta="Abonos de fiados">{moneda(m.abonos)}</td>
                                        <td data-etiqueta="Devoluciones" className="celda-gasto">
                                            {Number(m.devoluciones) > 0 ? `− ${moneda(m.devoluciones)}` : moneda(0)}
                                        </td>
                                        <td data-etiqueta="Entró" className="celda-neta">{moneda(m.total)}</td>
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot>
                                <tr>
                                    <td data-etiqueta="Total" className="celda-dia">Total</td>
                                    <td></td>
                                    <td></td>
                                    <td></td>
                                    <td data-etiqueta="Entró" className="celda-neta">{moneda(datos.total)}</td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>

                    <ul className="notas-caja">
                        <li>📝 Vendido fiado (no entra a caja): <strong>{moneda(datos.fiado)}</strong></li>
                        <li>💸 Gastos anotados ese día: <strong>{moneda(datos.gastos)}</strong> (si los pagaste de la caja, réstalos al contar).</li>
                    </ul>

                    <form className="formulario cierre-caja" onSubmit={guardar}>
                        <div className="caja-esperada">
                            <span>Efectivo que debería haber</span>
                            <strong>{moneda(datos.efectivoEsperado)}</strong>
                        </div>

                        <div className="fila-campos fila-dos">
                            <div className="campo">
                                <label htmlFor="efectivo-contado">Efectivo que contaste (S/)</label>
                                <input
                                    type="number"
                                    id="efectivo-contado"
                                    min="0"
                                    step="0.01"
                                    inputMode="decimal"
                                    placeholder="0.00"
                                    value={contado}
                                    onChange={(e) => setContado(e.target.value)}
                                />
                                {diferencia !== null && (
                                    <span className={`ayuda-campo ${Math.abs(diferencia) < 0.005 ? "texto-exito" : "texto-aviso"}`}>
                                        {Math.abs(diferencia) < 0.005
                                            ? "✅ Cuadra"
                                            : diferencia > 0
                                                ? `Sobran ${moneda(diferencia)}`
                                                : `Faltan ${moneda(-diferencia)}`}
                                    </span>
                                )}
                            </div>
                            <div className="campo">
                                <label htmlFor="nota-caja">Nota (opcional)</label>
                                <input
                                    type="text"
                                    id="nota-caja"
                                    maxLength={300}
                                    placeholder="Ej. pagué el taxi con la caja"
                                    value={nota}
                                    onChange={(e) => setNota(e.target.value)}
                                />
                            </div>
                        </div>

                        <button type="submit" className="boton-principal" disabled={guardando}>
                            {guardando ? "Guardando..." : datos.cierre ? "Actualizar cierre" : "Cerrar caja"}
                        </button>

                        {datos.cierre && (
                            <p className="ayuda-campo">
                                Cerrada por {datos.cierre.cerradoPor}: contó {moneda(datos.cierre.efectivoContado)} de{" "}
                                {moneda(datos.cierre.efectivoEsperado)} esperados.
                            </p>
                        )}

                        {mensaje && (
                            <p className={`mensaje mensaje-${mensaje.tipo}`} role="status" aria-live="polite">{mensaje.texto}</p>
                        )}
                    </form>
                </>
            )}
        </section>
    );
}

function PorEmpleado({ onError }) {
    const [[desde, hasta], setRango] = useState(() => PERIODOS[2].rango());
    const { datos, error } = useReporte(`/api/reportes/empleados?desde=${desde}&hasta=${hasta}`, onError);

    return (
        <section className="tarjeta reporte">
            <h2>Ventas por empleado</h2>
            <SelectorPeriodo desde={desde} hasta={hasta} onCambio={(d, h) => setRango([d, h])} />

            {error ? (
                <p className="mensaje mensaje-error">{error}</p>
            ) : datos === null ? (
                <p>Calculando...</p>
            ) : datos.empleados.length === 0 ? (
                <p>No hay ventas en este periodo.</p>
            ) : (
                <div className="tabla-contenedor">
                    <table className="tabla-dias">
                        <thead>
                            <tr>
                                <th>Persona</th>
                                <th>Ventas</th>
                                <th>Unidades</th>
                                <th>Vendido</th>
                                <th>Descuentos</th>
                                <th>Obsequios</th>
                                <th>Ganancia</th>
                            </tr>
                        </thead>
                        <tbody>
                            {datos.empleados.map((e) => (
                                <tr key={e.id ?? "sin"}>
                                    <td data-etiqueta="Persona" className="celda-dia">
                                        {e.nombre}
                                        {e.rol === "jefe" && <small className="etiqueta etiqueta-jefe">Admin.</small>}
                                    </td>
                                    <td data-etiqueta="Ventas">{e.ventas}</td>
                                    <td data-etiqueta="Unidades">{e.unidades}</td>
                                    <td data-etiqueta="Vendido">{moneda(e.vendido)}</td>
                                    <td data-etiqueta="Descuentos" className="celda-gasto">
                                        {Number(e.descuentos) > 0 ? `− ${moneda(e.descuentos)} (${e.ventasConDescuento})` : moneda(0)}
                                    </td>
                                    <td data-etiqueta="Obsequios">
                                        {e.unidadesObsequiadas > 0
                                            ? `${e.unidadesObsequiadas} u. · costo ${moneda(e.costoObsequios)}`
                                            : "—"}
                                    </td>
                                    <td data-etiqueta="Ganancia" className={`celda-neta ${Number(e.ganancia) < 0 ? "negativa" : ""}`}>
                                        {moneda(e.ganancia)}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </section>
    );
}

function Productos({ onError }) {
    const [[desde, hasta], setRango] = useState(() => PERIODOS[2].rango());
    const { datos, error } = useReporte(`/api/reportes/productos?desde=${desde}&hasta=${hasta}`, onError);

    return (
        <section className="tarjeta reporte">
            <h2>Productos</h2>
            <SelectorPeriodo desde={desde} hasta={hasta} onCambio={(d, h) => setRango([d, h])} />

            {error ? (
                <p className="mensaje mensaje-error">{error}</p>
            ) : datos === null ? (
                <p>Calculando...</p>
            ) : (
                <>
                    <h3 className="titulo-reporte">🏆 Más vendidos</h3>
                    {datos.masVendidos.length === 0 ? (
                        <p>No hay ventas en este periodo.</p>
                    ) : (
                        <ol className="ranking">
                            {datos.masVendidos.map((p) => (
                                <li key={p.id}>
                                    <div>
                                        {p.codigo && <span className="codigo-producto">{p.codigo}</span>}
                                        <strong>{p.nombre}</strong>
                                        <small>quedan {p.stock}</small>
                                    </div>
                                    <span>
                                        <strong>{p.unidades} u.</strong> · {moneda(p.vendido)} · gana {moneda(p.ganancia)}
                                    </span>
                                </li>
                            ))}
                        </ol>
                    )}

                    <h3 className="titulo-reporte">📊 Ganancia por categoría</h3>
                    {datos.categorias.length === 0 ? (
                        <p>No hay ventas en este periodo.</p>
                    ) : (
                        <ul className="gastos-categorias">
                            {datos.categorias.map((c) => {
                                const maximo = Math.max(...datos.categorias.map((x) => Number(x.ganancia)), 1);
                                return (
                                    <li key={`${c.seccion}-${c.categoria}`}>
                                        <div className="categoria-fila">
                                            <span>
                                                {c.icono} {c.categoria}
                                                {c.seccion && <small> · {c.seccion}</small>}
                                            </span>
                                            <strong>{moneda(c.ganancia)}</strong>
                                        </div>
                                        <small className="ayuda-campo">
                                            {c.unidades} u. de {c.productos} {c.productos === 1 ? "producto" : "productos"} · vendido {moneda(c.vendido)}
                                        </small>
                                        <div className="barra-categoria" aria-hidden="true">
                                            <span style={{ width: `${Math.max(Number(c.ganancia), 0) / maximo * 100}%` }}></span>
                                        </div>
                                    </li>
                                );
                            })}
                        </ul>
                    )}

                    <h3 className="titulo-reporte">😴 No se vendieron en este periodo</h3>
                    {datos.sinMovimiento.length === 0 ? (
                        <p>¡Todos los productos con stock se vendieron al menos una vez!</p>
                    ) : (
                        <ul className="ranking ranking-quietos">
                            {datos.sinMovimiento.map((p) => (
                                <li key={p.id}>
                                    <div>
                                        {p.codigo && <span className="codigo-producto">{p.codigo}</span>}
                                        <strong>{p.nombre}</strong>
                                        <small>{p.ultimaVenta ? `última venta: ${formatearDia(p.ultimaVenta)}` : "nunca se vendió"}</small>
                                    </div>
                                    <span>
                                        {p.stock} u. · {moneda(p.valorStock)} en stock
                                    </span>
                                </li>
                            ))}
                        </ul>
                    )}
                </>
            )}
        </section>
    );
}

// Reportes del jefe: cierre de caja, ventas por empleado y productos.
export default function Reportes({ onError }) {
    const [pestana, setPestana] = useState("caja");

    return (
        <div className="contenido-vista">
            <div className="selector-modalidad selector-filtro pestanas-reportes" role="tablist" aria-label="Reportes">
                {PESTANAS.map((p) => (
                    <button
                        key={p.valor}
                        type="button"
                        role="tab"
                        aria-selected={pestana === p.valor}
                        className={pestana === p.valor ? "activo" : ""}
                        onClick={() => setPestana(p.valor)}
                    >
                        {p.texto}
                    </button>
                ))}
            </div>

            {pestana === "caja" && <CierreCaja onError={onError} />}
            {pestana === "empleados" && <PorEmpleado onError={onError} />}
            {pestana === "productos" && <Productos onError={onError} />}
        </div>
    );
}
