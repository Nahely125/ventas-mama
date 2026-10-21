import { useCallback, useEffect, useRef, useState } from "react";
import { moneda, pedir } from "../api.js";
import { formatearDia, hoy, nombreMes } from "../fechas.js";
import { METODOS_PAGO, boletaDesdeFilas } from "../venta.js";
import Comprobante from "./Comprobante.jsx";
import HistorialVentas from "./HistorialVentas.jsx";

const MODOS = [
    { valor: "hoy", texto: "Hoy" },
    { valor: "dia", texto: "Por día" },
    { valor: "mes", texto: "Por mes" },
    { valor: "todo", texto: "Todo" }
];

// Últimos 12 meses ("2026-10", "2026-09", ...).
function ultimosMeses() {
    return Array.from({ length: 12 }, (_, i) => {
        const fecha = new Date();
        fecha.setDate(1);
        fecha.setMonth(fecha.getMonth() - i);
        return `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, "0")}`;
    });
}

function ultimoDiaDelMes(mes) {
    const [anio, numero] = mes.split("-").map(Number);
    return `${mes}-${String(new Date(anio, numero, 0).getDate()).padStart(2, "0")}`;
}

// Ventana para anular una venta (solo el jefe): pide el motivo.
function ModalAnular({ boleta, onAnulada, onCerrar, onError }) {
    const dialogo = useRef(null);
    const [motivo, setMotivo] = useState("");
    const [error, setError] = useState("");
    const [enviando, setEnviando] = useState(false);

    useEffect(() => {
        dialogo.current?.showModal();
    }, []);

    async function anular(evento) {
        evento.preventDefault();
        setEnviando(true);

        try {
            await pedir(`/api/ventas/${boleta.grupo}/anular`, { method: "POST", cuerpo: { motivo: motivo.trim() } });
            await onAnulada();
        } catch (err) {
            onError(err, () => setError(err.message));
            setEnviando(false);
        }
    }

    return (
        <dialog ref={dialogo} className="modal" onClose={onCerrar} aria-labelledby="titulo-anular">
            <form className="formulario modal-contenido" onSubmit={anular}>
                <div className="modal-encabezado">
                    <h2 id="titulo-anular">Anular venta N° {String(boleta.numero).padStart(6, "0")}</h2>
                    <button type="button" className="boton-cerrar-modal" onClick={onCerrar} aria-label="Cerrar">✕</button>
                </div>

                <ul className="lista-bajo-minimo">
                    {boleta.items.map((item) => (
                        <li key={item.id}>{item.producto}: {moneda(item.total)}</li>
                    ))}
                </ul>
                <p>
                    Total: <strong>{moneda(boleta.total)}</strong>. El stock vuelve al inventario y la venta deja
                    de contar en los totales y ganancias{boleta.metodoPago === "fiado" ? " (y en la deuda del cliente)" : ""}.
                </p>

                <div className="campo">
                    <label htmlFor="motivo-anulacion">Motivo</label>
                    <input
                        type="text"
                        id="motivo-anulacion"
                        maxLength={200}
                        placeholder="Ej. Se registró por error / El cliente devolvió el producto"
                        value={motivo}
                        onChange={(e) => setMotivo(e.target.value)}
                        required
                        autoFocus
                    />
                </div>

                {error && <p className="mensaje mensaje-error" role="alert">{error}</p>}

                <div className="modal-acciones">
                    <button type="button" className="boton-secundario" onClick={onCerrar}>Cancelar</button>
                    <button type="submit" className="boton-peligro" disabled={enviando || !motivo.trim()}>
                        {enviando ? "Anulando..." : "Anular venta"}
                    </button>
                </div>
            </form>
        </dialog>
    );
}

// Ventana para devolver unidades de un producto de la venta (solo el jefe).
function ModalDevolver({ venta, onDevuelta, onCerrar, onError }) {
    const dialogo = useRef(null);
    const [unidades, setUnidades] = useState("1");
    const [motivo, setMotivo] = useState("");
    const [error, setError] = useState("");
    const [enviando, setEnviando] = useState(false);

    useEffect(() => {
        dialogo.current?.showModal();
    }, []);

    const cantidad = Number(unidades);
    const valida = Number.isInteger(cantidad) && cantidad > 0 && cantidad <= venta.cantidad;
    // Lo que se devuelve, en proporción (igual que lo calcula el servidor).
    const quedan = venta.cantidad - cantidad;
    const monto = valida ? Number(venta.total) - Number((Number(venta.total) * quedan / venta.cantidad).toFixed(2)) : 0;

    async function devolver(evento) {
        evento.preventDefault();
        setEnviando(true);

        try {
            const resultado = await pedir(`/api/ventas/${venta.grupo}/devolver`, {
                method: "POST",
                cuerpo: { ventaId: venta.id, unidades: cantidad, motivo: motivo.trim() }
            });
            await onDevuelta(resultado.mensaje);
        } catch (err) {
            onError(err, () => setError(err.message));
            setEnviando(false);
        }
    }

    return (
        <dialog ref={dialogo} className="modal" onClose={onCerrar} aria-labelledby="titulo-devolver">
            <form className="formulario modal-contenido" onSubmit={devolver}>
                <div className="modal-encabezado">
                    <h2 id="titulo-devolver">↩ Devolver producto</h2>
                    <button type="button" className="boton-cerrar-modal" onClick={onCerrar} aria-label="Cerrar">✕</button>
                </div>

                <p>
                    <strong>{venta.producto}</strong>: se vendieron {venta.cantidad} unidades por {moneda(venta.total)}.
                    Las devueltas vuelven al inventario.
                </p>

                <div className="fila-campos fila-dos">
                    <div className="campo">
                        <label htmlFor="unidades-devolver">Unidades que devuelve</label>
                        <input
                            type="number"
                            id="unidades-devolver"
                            min="1"
                            max={venta.cantidad}
                            step="1"
                            inputMode="numeric"
                            value={unidades}
                            onChange={(e) => setUnidades(e.target.value)}
                            aria-invalid={!valida}
                        />
                    </div>
                    <div className="campo">
                        <label htmlFor="motivo-devolucion">Motivo</label>
                        <input
                            type="text"
                            id="motivo-devolucion"
                            maxLength={200}
                            placeholder="Ej. Vino fallado"
                            value={motivo}
                            onChange={(e) => setMotivo(e.target.value)}
                            required
                        />
                    </div>
                </div>

                {valida && (
                    <p className="caja-esperada">
                        <span>{venta.metodoPago === "fiado" ? "Se descuenta de la deuda" : "Devuelves al cliente"}</span>
                        <strong>{moneda(monto)}</strong>
                    </p>
                )}

                {error && <p className="mensaje mensaje-error" role="alert">{error}</p>}

                <div className="modal-acciones">
                    <button type="button" className="boton-secundario" onClick={onCerrar}>Cancelar</button>
                    <button type="submit" className="boton-peligro" disabled={enviando || !valida || !motivo.trim()}>
                        {enviando ? "Registrando..." : "Registrar devolución"}
                    </button>
                </div>
            </form>
        </dialog>
    );
}

export default function Historial({ esJefe, onCambio, onError }) {
    const [modo, setModo] = useState("hoy");
    const [dia, setDia] = useState(hoy());
    const [mes, setMes] = useState(hoy().slice(0, 7));
    const [filas, setFilas] = useState(null);
    const [pagina, setPagina] = useState(0);
    const [hayMas, setHayMas] = useState(false);
    const [cargandoMas, setCargandoMas] = useState(false);
    const [totales, setTotales] = useState(null);
    const [error, setError] = useState("");
    const [comprobante, setComprobante] = useState(null);
    const [anulando, setAnulando] = useState(null);
    const [devolviendo, setDevolviendo] = useState(null);
    const [aviso, setAviso] = useState("");

    // Rango de fechas del periodo elegido (el servidor filtra y entrega por partes).
    const rango = {
        hoy: { desde: hoy(), hasta: hoy() },
        dia: { desde: dia, hasta: dia },
        mes: { desde: `${mes}-01`, hasta: ultimoDiaDelMes(mes) },
        todo: {}
    }[modo];
    const consulta = new URLSearchParams(rango).toString();

    const cargar = useCallback(async () => {
        setFilas(null);
        setTotales(null);
        setError("");

        try {
            const [primera, suma] = await Promise.all([
                pedir(`/api/ventas?${consulta}&pagina=0`),
                pedir(`/api/ventas/totales?${consulta}`)
            ]);
            setFilas(primera.filas);
            setHayMas(primera.hayMas);
            setPagina(0);
            setTotales(suma);
        } catch (err) {
            onError(err, () => setError("No se pudo cargar el historial de ventas."));
        }
    }, [consulta, onError]);

    useEffect(() => {
        cargar();
    }, [cargar]);

    async function cargarMas() {
        setCargandoMas(true);

        try {
            const siguiente = await pedir(`/api/ventas?${consulta}&pagina=${pagina + 1}`);
            setFilas((anteriores) => [...anteriores, ...siguiente.filas]);
            setHayMas(siguiente.hayMas);
            setPagina((p) => p + 1);
        } catch (err) {
            onError(err, () => setError("No se pudieron cargar más ventas."));
        } finally {
            setCargandoMas(false);
        }
    }

    const boletaDe = (venta) => boletaDesdeFilas((filas ?? []).filter((v) => v.grupo === venta.grupo));

    const ganancia = Number(totales?.ganancia ?? 0);
    const ganancia2025 = Number(totales?.ganancia2025 ?? 0);
    const porMetodo = METODOS_PAGO
        .map((metodo) => ({ ...metodo, total: Number(totales?.porMetodo?.[metodo.valor] ?? 0) }))
        .filter((metodo) => metodo.total > 0);

    const periodo = {
        hoy: `Hoy, ${formatearDia(hoy())}`,
        dia: dia ? formatearDia(dia) : "Elige un día",
        mes: nombreMes(mes),
        todo: "Todas las ventas"
    }[modo];

    return (
        <div className="contenido-vista">
            <section className="tarjeta filtros-historial">
                <div className="selector-modalidad selector-filtro" role="radiogroup" aria-label="Filtrar ventas">
                    {MODOS.map((opcion) => (
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
                        <label htmlFor="filtro-dia">Día</label>
                        <input type="date" id="filtro-dia" max={hoy()} value={dia} onChange={(e) => setDia(e.target.value)} />
                    </div>
                )}

                {modo === "mes" && (
                    <div className="campo">
                        <label htmlFor="filtro-mes-ventas">Mes</label>
                        <select id="filtro-mes-ventas" value={mes} onChange={(e) => setMes(e.target.value)}>
                            {ultimosMeses().map((clave) => (
                                <option key={clave} value={clave}>{nombreMes(clave)}</option>
                            ))}
                        </select>
                    </div>
                )}

                <p className="periodo-actual">
                    <span aria-hidden="true">📅</span> {periodo}
                </p>

                {totales === null ? (
                    <p className="cargando-imagen"><span className="spinner" aria-hidden="true"></span> Calculando totales...</p>
                ) : (
                    <>
                        <div className={`totales-historial ${esJefe ? "con-ganancia" : "solo-conteo"}`}>
                            <div className="total-historial">
                                <span>Ventas</span>
                                <strong>{totales.ventas}</strong>
                            </div>
                            <div className="total-historial">
                                <span>Unidades vendidas</span>
                                <strong>{totales.unidades}</strong>
                            </div>
                            {/* Los totales de dinero solo los ve el jefe. */}
                            {esJefe && (
                                <div className="total-historial">
                                    <span>Total vendido</span>
                                    <strong>{moneda(totales.vendido)}</strong>
                                </div>
                            )}
                        </div>

                        {esJefe && (
                            <div className="bloque-ganancias">
                                <div className="ganancias-separadas">
                                    <div className="total-historial total-ganancia-nueva">
                                        <span>🆕 Ganancia por productos nuevos</span>
                                        <strong>{moneda(ganancia - ganancia2025)}</strong>
                                        <small>Venta menos costo</small>
                                    </div>
                                    <div className="total-historial total-ganancia-2025">
                                        <span>📦 Ganancia por inventario 2025</span>
                                        <strong>{moneda(ganancia2025)}</strong>
                                        <small>Todo lo cobrado (ya se pagó en 2025)</small>
                                    </div>
                                </div>
                                <div className="total-historial total-ganancia ganancia-suma">
                                    <span>✨ Ganancia total</span>
                                    <strong>{moneda(ganancia)}</strong>
                                    <small>{moneda(ganancia - ganancia2025)} + {moneda(ganancia2025)}</small>
                                </div>
                            </div>
                        )}

                        {esJefe && porMetodo.length > 0 && (
                            <ul className="totales-metodo" aria-label="Total por método de pago">
                                {porMetodo.map((metodo) => (
                                    <li key={metodo.valor}>
                                        <span aria-hidden="true">{metodo.icono}</span> {metodo.nombre}:{" "}
                                        <strong>{moneda(metodo.total)}</strong>
                                    </li>
                                ))}
                            </ul>
                        )}
                        <p className="ayuda-campo">Las ventas anuladas no cuentan en estos totales.</p>
                    </>
                )}
            </section>

            {aviso && <p className="mensaje mensaje-exito" role="status">{aviso}</p>}

            <HistorialVentas
                ventas={filas}
                error={error}
                esJefe={esJefe}
                textoVacio={modo === "todo" ? "Todavía no hay ventas registradas." : "No hay ventas en este periodo."}
                onVerComprobante={(venta) => setComprobante(boletaDe(venta))}
                onAnular={esJefe ? (venta) => setAnulando(boletaDe(venta)) : null}
                onDevolver={esJefe ? setDevolviendo : null}
            />

            {hayMas && (
                <button type="button" className="boton-secundario boton-cargar-mas" onClick={cargarMas} disabled={cargandoMas}>
                    {cargandoMas ? "Cargando..." : "Cargar más ventas"}
                </button>
            )}

            {comprobante && (
                <Comprobante boleta={comprobante} onCerrar={() => setComprobante(null)} />
            )}

            {devolviendo && (
                <ModalDevolver
                    venta={devolviendo}
                    onError={onError}
                    onCerrar={() => setDevolviendo(null)}
                    onDevuelta={async (texto) => {
                        setDevolviendo(null);
                        setAviso(`↩ ${texto}`);
                        await Promise.all([cargar(), onCambio()]);
                    }}
                />
            )}

            {anulando && (
                <ModalAnular
                    boleta={anulando}
                    onError={onError}
                    onCerrar={() => setAnulando(null)}
                    onAnulada={async () => {
                        setAnulando(null);
                        await Promise.all([cargar(), onCambio()]);
                    }}
                />
            )}
        </div>
    );
}
