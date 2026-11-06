import { useCallback, useEffect, useState } from "react";
import { moneda, pedir } from "../api.js";
import { formatearDia, hoy } from "../fechas.js";

const CATEGORIAS_GASTO = ["Mercadería", "Transporte", "Alquiler", "Servicios", "Sueldos", "Embalaje", "Otros"];
const USO_VACIO = { tipo: "inversion", descripcion: "", monto: "", categoria: "Mercadería", fecha: hoy() };
const PAGO_VACIO = { monto: "", fecha: hoy(), nota: "" };

// Formulario para registrar en qué se usó el dinero (inversión en productos o gasto).
function FormularioUso({ prestamo, onGuardar, ocupado }) {
    const [uso, setUso] = useState(USO_VACIO);
    const cambiar = (cambios) => setUso((u) => ({ ...u, ...cambios }));

    return (
        <form
            className="formulario formulario-prestamo"
            onSubmit={async (e) => {
                e.preventDefault();
                const listo = await onGuardar({
                    tipo: uso.tipo,
                    descripcion: uso.descripcion,
                    monto: Number(uso.monto),
                    fecha: uso.fecha,
                    categoria: uso.categoria
                });
                if (listo) setUso(USO_VACIO);
            }}
        >
            <div className="selector-modalidad selector-pequeno" role="radiogroup" aria-label="Tipo de uso">
                <button type="button" role="radio" aria-checked={uso.tipo === "inversion"} className={uso.tipo === "inversion" ? "activo" : ""} onClick={() => cambiar({ tipo: "inversion" })}>
                    💼 Inversión en productos
                </button>
                <button type="button" role="radio" aria-checked={uso.tipo === "gasto"} className={uso.tipo === "gasto" ? "activo" : ""} onClick={() => cambiar({ tipo: "gasto" })}>
                    💸 Gasto
                </button>
            </div>
            <div className="campo">
                <label htmlFor={`uso-desc-${prestamo.id}`}>¿En qué se usó?</label>
                <input id={`uso-desc-${prestamo.id}`} maxLength={200} required value={uso.descripcion}
                    placeholder={uso.tipo === "inversion" ? "Ej. Mercadería navideña" : "Ej. Flete, alquiler del puesto"}
                    onChange={(e) => cambiar({ descripcion: e.target.value })} />
            </div>
            <div className="fila-campos fila-dos">
                <div className="campo">
                    <label htmlFor={`uso-monto-${prestamo.id}`}>Monto (S/)</label>
                    <input id={`uso-monto-${prestamo.id}`} type="number" min="0.01" step="0.01" inputMode="decimal" required
                        max={Number(prestamo.sinUsar)} value={uso.monto} onChange={(e) => cambiar({ monto: e.target.value })} />
                </div>
                <div className="campo">
                    <label htmlFor={`uso-fecha-${prestamo.id}`}>Fecha</label>
                    <input id={`uso-fecha-${prestamo.id}`} type="date" max={hoy()} required value={uso.fecha}
                        onChange={(e) => cambiar({ fecha: e.target.value })} />
                </div>
            </div>
            {uso.tipo === "gasto" && (
                <div className="campo">
                    <label htmlFor={`uso-categoria-${prestamo.id}`}>Categoría del gasto</label>
                    <select id={`uso-categoria-${prestamo.id}`} value={uso.categoria} onChange={(e) => cambiar({ categoria: e.target.value })}>
                        {CATEGORIAS_GASTO.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                </div>
            )}
            <button type="submit" className="boton-principal" disabled={ocupado}>Registrar uso</button>
        </form>
    );
}

// Formulario para registrar un pago (cuota) del préstamo.
function FormularioPago({ prestamo, onGuardar, ocupado }) {
    const [pago, setPago] = useState(PAGO_VACIO);
    const cambiar = (cambios) => setPago((p) => ({ ...p, ...cambios }));

    return (
        <form
            className="formulario formulario-prestamo"
            onSubmit={async (e) => {
                e.preventDefault();
                const listo = await onGuardar({
                    monto: Number(pago.monto),
                    fecha: pago.fecha,
                    nota: pago.nota
                });
                if (listo) setPago(PAGO_VACIO);
            }}
        >
            <div className="fila-campos fila-dos">
                <div className="campo">
                    <label htmlFor={`pago-monto-${prestamo.id}`}>Monto pagado (S/)</label>
                    <input id={`pago-monto-${prestamo.id}`} type="number" min="0.01" step="0.01" inputMode="decimal" required
                        max={Number(prestamo.porPagar)} value={pago.monto} onChange={(e) => cambiar({ monto: e.target.value })} />
                </div>
                <div className="campo">
                    <label htmlFor={`pago-fecha-${prestamo.id}`}>Fecha</label>
                    <input id={`pago-fecha-${prestamo.id}`} type="date" max={hoy()} required value={pago.fecha}
                        onChange={(e) => cambiar({ fecha: e.target.value })} />
                </div>
            </div>
            <div className="campo">
                    <label htmlFor={`pago-nota-${prestamo.id}`}>Nota (opcional)</label>
                    <input id={`pago-nota-${prestamo.id}`} maxLength={200} placeholder="Ej. cuota 1 de 12" value={pago.nota}
                        onChange={(e) => cambiar({ nota: e.target.value })} />
            </div>
            <button type="submit" className="boton-principal" disabled={ocupado}>Registrar pago</button>
        </form>
    );
}

function TarjetaPrestamo({ prestamo, ocupado, accion }) {
    const [abierto, setAbierto] = useState(null); // "uso" | "pago" | null
    const usado = Number(prestamo.enInversion) + Number(prestamo.enGastos);
    const porcentajePagado = Math.min(Number(prestamo.pagado) / Number(prestamo.totalDevolver) * 100, 100);

    return (
        <li className="tarjeta-prestamo">
            <div className="prestamo-cabecera">
                <div>
                    <strong>🏦 {prestamo.prestamista}</strong>
                    <small>
                        {formatearDia(prestamo.fecha)}{prestamo.nota ? ` · ${prestamo.nota}` : ""}
                    </small>
                </div>
                <span className={Number(prestamo.porPagar) === 0 ? "prestamo-pagado" : "prestamo-pendiente"}>
                    {Number(prestamo.porPagar) === 0 ? "✅ Pagado" : `Falta pagar ${moneda(prestamo.porPagar)}`}
                </span>
            </div>

            <dl className="numeros-prestamo">
                <div><dt>Recibido</dt><dd>{moneda(prestamo.monto)}</dd></div>
                <div><dt>En inversión</dt><dd>{moneda(prestamo.enInversion)}</dd></div>
                <div><dt>En gastos</dt><dd>{moneda(prestamo.enGastos)}</dd></div>
                <div className={Number(prestamo.sinUsar) > 0 ? "sin-usar" : ""}><dt>Sin usar</dt><dd>{moneda(prestamo.sinUsar)}</dd></div>
            </dl>

            <div className="pago-prestamo">
                <div className="pago-prestamo-texto">
                    <span>Pagado {moneda(prestamo.pagado)} de {moneda(prestamo.totalDevolver)}</span>
                </div>
                <progress max="100" value={porcentajePagado} aria-label="Avance del pago" />
            </div>

            <div className="acciones-prestamo">
                {Number(prestamo.sinUsar) > 0 && (
                    <button type="button" className={`boton-secundario boton-pequeno ${abierto === "uso" ? "activo" : ""}`} onClick={() => setAbierto(abierto === "uso" ? null : "uso")}>
                        ➕ ¿En qué se usó?
                    </button>
                )}
                {Number(prestamo.porPagar) > 0 && (
                    <button type="button" className={`boton-secundario boton-pequeno ${abierto === "pago" ? "activo" : ""}`} onClick={() => setAbierto(abierto === "pago" ? null : "pago")}>
                        💵 Registrar pago
                    </button>
                )}
            </div>

            {abierto === "uso" && (
                <FormularioUso prestamo={prestamo} ocupado={ocupado}
                    onGuardar={(datos) => accion(() => pedir(`/api/prestamos/${prestamo.id}/usos`, { method: "POST", cuerpo: datos }))} />
            )}
            {abierto === "pago" && (
                <FormularioPago prestamo={prestamo} ocupado={ocupado}
                    onGuardar={(datos) => accion(() => pedir(`/api/prestamos/${prestamo.id}/pagos`, { method: "POST", cuerpo: datos }))} />
            )}

            {prestamo.usos.length > 0 && (
                <details className="detalle-prestamo">
                    <summary>En qué se usó ({prestamo.usos.length})</summary>
                    <ul>
                        {prestamo.usos.map((u) => (
                            <li key={`${u.tipo}-${u.id}`}>
                                <span>
                                    {u.tipo === "inversion" ? "💼" : "💸"} {u.descripcion}
                                    <small> · {u.tipo === "inversion" ? "Inversión" : u.categoria} · {formatearDia(u.fecha)}</small>
                                </span>
                                <strong>{moneda(u.monto)}</strong>
                                <button type="button" className="boton-enlace" disabled={ocupado} aria-label={`Quitar ${u.descripcion}`}
                                    onClick={() => confirm(`¿Quitar "${u.descripcion}"? Se borra esa ${u.tipo === "inversion" ? "inversión" : "gasto"}.`) &&
                                        accion(() => pedir(`/api/prestamos/usos/${u.tipo}/${u.id}`, { method: "DELETE" }))}>
                                    Quitar
                                </button>
                            </li>
                        ))}
                    </ul>
                </details>
            )}

            {prestamo.pagos.length > 0 && (
                <details className="detalle-prestamo">
                    <summary>Pagos ({prestamo.pagos.length})</summary>
                    <ul>
                        {prestamo.pagos.map((p) => (
                            <li key={p.id}>
                                <span>
                                    💵 {formatearDia(p.fecha)}
                                    <small>{p.nota ? ` · ${p.nota}` : ""}</small>
                                </span>
                                <strong>{moneda(p.monto)}</strong>
                                <button type="button" className="boton-enlace" disabled={ocupado} aria-label="Quitar este pago"
                                    onClick={() => confirm("¿Quitar este pago? También se borra su gasto de interés.") &&
                                        accion(() => pedir(`/api/prestamos/pagos/${p.id}`, { method: "DELETE" }))}>
                                    Quitar
                                </button>
                            </li>
                        ))}
                    </ul>
                </details>
            )}

            {prestamo.pagos.length === 0 && (
                <button type="button" className="boton-enlace boton-eliminar-prestamo" disabled={ocupado}
                    onClick={() => confirm(`¿Eliminar el préstamo de ${prestamo.prestamista}? Sus usos quedan como inversión o gasto normales.`) &&
                        accion(() => pedir(`/api/prestamos/${prestamo.id}`, { method: "DELETE" }))}>
                    Eliminar préstamo
                </button>
            )}
        </li>
    );
}

/* Préstamos (capital financiado): cuánto se recibió, en qué se usó (inversión en productos
   o gasto) y cuánto falta pagar. Solo el jefe. */
export default function Prestamos({ onCambio, onError }) {
    const [prestamos, setPrestamos] = useState(null);
    const [mensaje, setMensaje] = useState(null);
    const [ocupado, setOcupado] = useState(false);
    const [nuevo, setNuevo] = useState({ prestamista: "", monto: "", fecha: hoy(), nota: "" });

    const cargar = useCallback(async () => {
        try {
            setPrestamos(await pedir("/api/prestamos"));
        } catch (err) {
            onError(err, () => setMensaje({ tipo: "error", texto: err.message }));
        }
    }, [onError]);

    useEffect(() => {
        cargar();
    }, [cargar]);

    // Ejecuta una acción que devuelve { mensaje, prestamos }. Devuelve true si salió bien.
    async function accion(hacer) {
        setOcupado(true);
        setMensaje(null);
        try {
            const resultado = await hacer();
            setPrestamos(resultado.prestamos);
            setMensaje({ tipo: "exito", texto: resultado.mensaje });
            await onCambio?.();
            return true;
        } catch (err) {
            onError(err, () => setMensaje({ tipo: "error", texto: err.message }));
            return false;
        } finally {
            setOcupado(false);
        }
    }

    async function registrar(evento) {
        evento.preventDefault();
        const listo = await accion(() => pedir("/api/prestamos", {
            method: "POST",
            cuerpo: {
                prestamista: nuevo.prestamista,
                monto: Number(nuevo.monto),
                fecha: nuevo.fecha,
                nota: nuevo.nota
            }
        }));
        if (listo) setNuevo({ prestamista: "", monto: "", fecha: hoy(), nota: "" });
    }

    const totales = (prestamos ?? []).reduce(
        (t, p) => ({ recibido: t.recibido + Number(p.monto), porPagar: t.porPagar + Number(p.porPagar), sinUsar: t.sinUsar + Number(p.sinUsar) }),
        { recibido: 0, porPagar: 0, sinUsar: 0 }
    );

    return (
        <div className="contenido-vista">
            {prestamos?.length > 0 && (
                <section className="totales-reposicion totales-prestamos" aria-label="Resumen de préstamos">
                    <div><span>Capital financiado</span><strong>{moneda(totales.recibido)}</strong></div>
                    <div><span>Sin usar</span><strong>{moneda(totales.sinUsar)}</strong></div>
                    <div className="total-reposicion"><span>Falta pagar</span><strong>{moneda(totales.porPagar)}</strong></div>
                </section>
            )}

            {mensaje && <p className={`mensaje mensaje-${mensaje.tipo}`} role="status">{mensaje.texto}</p>}

            <section className="tarjeta">
                <h2>Préstamos</h2>
                {prestamos === null ? (
                    <p>Cargando...</p>
                ) : prestamos.length === 0 ? (
                    <p className="aviso-busqueda">Todavía no hay préstamos registrados.</p>
                ) : (
                    <ul className="lista-prestamos">
                        {prestamos.map((p) => <TarjetaPrestamo key={p.id} prestamo={p} ocupado={ocupado} accion={accion} />)}
                    </ul>
                )}
            </section>

            <section className="tarjeta">
                <h2>Registrar préstamo</h2>
                <form className="formulario" onSubmit={registrar}>
                    <div className="campo">
                        <label htmlFor="prestamo-quien">¿Quién te prestó?</label>
                        <input id="prestamo-quien" maxLength={120} required placeholder="Ej. Caja Arequipa, BCP, un familiar"
                            value={nuevo.prestamista} onChange={(e) => setNuevo((n) => ({ ...n, prestamista: e.target.value }))} />
                    </div>
                    <div className="fila-campos fila-dos">
                        <div className="campo">
                            <label htmlFor="prestamo-monto">Dinero recibido (S/)</label>
                            <input id="prestamo-monto" type="number" min="0.01" step="0.01" inputMode="decimal" required
                                value={nuevo.monto} onChange={(e) => setNuevo((n) => ({ ...n, monto: e.target.value }))} />
                        </div>
                        <div className="campo">
                            <label htmlFor="prestamo-fecha">Fecha</label>
                            <input id="prestamo-fecha" type="date" max={hoy()} required value={nuevo.fecha}
                                onChange={(e) => setNuevo((n) => ({ ...n, fecha: e.target.value }))} />
                        </div>
                    </div>
                    <div className="campo">
                            <label htmlFor="prestamo-nota">Nota (opcional)</label>
                            <input id="prestamo-nota" maxLength={200} placeholder="Ej. devolver en 6 meses" value={nuevo.nota}
                                onChange={(e) => setNuevo((n) => ({ ...n, nota: e.target.value }))} />
                    </div>
                    <button type="submit" className="boton-principal" disabled={ocupado}>Registrar préstamo</button>
                </form>
            </section>
        </div>
    );
}
