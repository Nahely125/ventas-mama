import { useCallback, useEffect, useRef, useState } from "react";
import { moneda, pedir } from "../api.js";
import { formatearFecha } from "../venta.js";

function mostrarTelefono(telefono) {
    return telefono ? telefono.replace(/^51(?=9\d{8}$)/, "") : "";
}

const METODOS_ABONO = [
    { valor: "efectivo", texto: "💵 Efectivo" },
    { valor: "yape", texto: "💜 Yape" },
    { valor: "plin", texto: "💚 Plin" },
    { valor: "transferencia", texto: "🏦 Transferencia" }
];

// Detalle de un cliente: deuda, compras fiadas, pagos y registrar un abono.
function DetalleCliente({ clienteId, esJefe, onCerrar, onCambio, onError }) {
    const dialogo = useRef(null);
    const [cliente, setCliente] = useState(null);
    const [abono, setAbono] = useState({ monto: "", metodoPago: "efectivo", nota: "" });
    const [editando, setEditando] = useState(null);
    const [mensaje, setMensaje] = useState(null);
    const [enviando, setEnviando] = useState(false);

    const cargar = useCallback(async () => {
        try {
            setCliente(await pedir(`/api/clientes/${clienteId}`));
        } catch (err) {
            onError(err, () => setMensaje({ tipo: "error", texto: err.message }));
        }
    }, [clienteId, onError]);

    useEffect(() => {
        dialogo.current?.showModal();
        cargar();
    }, [cargar]);

    async function registrarAbono(evento) {
        evento.preventDefault();
        setEnviando(true);
        setMensaje(null);

        try {
            const resultado = await pedir(`/api/clientes/${clienteId}/abonos`, {
                method: "POST",
                cuerpo: { monto: Number(abono.monto), metodoPago: abono.metodoPago, nota: abono.nota.trim() }
            });
            setMensaje({ tipo: "exito", texto: `Abono registrado. Ahora debe ${moneda(resultado.saldo)}.` });
            setAbono({ monto: "", metodoPago: "efectivo", nota: "" });
            await Promise.all([cargar(), onCambio()]);
        } catch (err) {
            onError(err, () => setMensaje({ tipo: "error", texto: err.message }));
        } finally {
            setEnviando(false);
        }
    }

    async function eliminarAbono(id) {
        if (!confirm("¿Eliminar este abono? La deuda del cliente volverá a subir.")) return;

        try {
            await pedir(`/api/clientes/abonos/${id}`, { method: "DELETE" });
            await Promise.all([cargar(), onCambio()]);
        } catch (err) {
            onError(err, () => setMensaje({ tipo: "error", texto: err.message }));
        }
    }

    async function guardarDatos(evento) {
        evento.preventDefault();

        try {
            await pedir(`/api/clientes/${clienteId}`, { method: "PUT", cuerpo: editando });
            setEditando(null);
            await Promise.all([cargar(), onCambio()]);
        } catch (err) {
            onError(err, () => setMensaje({ tipo: "error", texto: err.message }));
        }
    }

    async function eliminarCliente() {
        if (!confirm(`¿Eliminar a ${cliente.nombre}? Sus ventas se conservan.`)) return;

        try {
            await pedir(`/api/clientes/${clienteId}`, { method: "DELETE" });
            await onCambio();
            onCerrar();
        } catch (err) {
            onError(err, () => setMensaje({ tipo: "error", texto: err.message }));
        }
    }

    const saldo = Number(cliente?.saldo ?? 0);

    return (
        <dialog ref={dialogo} className="modal" onClose={onCerrar} aria-labelledby="titulo-cliente">
            <div className="modal-contenido formulario">
                <div className="modal-encabezado">
                    <h2 id="titulo-cliente">{cliente?.nombre ?? "Cliente"}</h2>
                    <button type="button" className="boton-cerrar-modal" onClick={onCerrar} aria-label="Cerrar">✕</button>
                </div>

                {!cliente ? (
                    <p className="cargando-imagen"><span className="spinner" aria-hidden="true"></span> Cargando...</p>
                ) : (
                    <>
                        {editando ? (
                            <form className="formulario" onSubmit={guardarDatos}>
                                <div className="fila-campos fila-dos">
                                    <div className="campo">
                                        <label htmlFor="editar-cliente-nombre">Nombre</label>
                                        <input id="editar-cliente-nombre" maxLength={100} value={editando.nombre}
                                            onChange={(e) => setEditando((v) => ({ ...v, nombre: e.target.value }))} required />
                                    </div>
                                    <div className="campo">
                                        <label htmlFor="editar-cliente-telefono">WhatsApp</label>
                                        <input id="editar-cliente-telefono" type="tel" inputMode="tel" value={editando.telefono}
                                            onChange={(e) => setEditando((v) => ({ ...v, telefono: e.target.value }))} />
                                    </div>
                                </div>
                                <div className="campo">
                                    <label htmlFor="editar-cliente-notas">Notas</label>
                                    <input id="editar-cliente-notas" maxLength={200} value={editando.notas}
                                        onChange={(e) => setEditando((v) => ({ ...v, notas: e.target.value }))} />
                                </div>
                                <div className="acciones-comprobante">
                                    <button type="button" className="boton-secundario boton-pequeno" onClick={() => setEditando(null)}>Cancelar</button>
                                    <button type="submit" className="boton-editar">Guardar</button>
                                </div>
                            </form>
                        ) : (
                            <p className="datos-cliente">
                                📱 {mostrarTelefono(cliente.telefono) || "Sin WhatsApp"} · {cliente.compras} {cliente.compras === 1 ? "compra" : "compras"}
                                {cliente.notas && <><br />📝 {cliente.notas}</>}
                                {esJefe && (
                                    <>
                                        <br />
                                        <button type="button" className="boton-enlace" onClick={() => setEditando({
                                            nombre: cliente.nombre,
                                            telefono: mostrarTelefono(cliente.telefono),
                                            notas: cliente.notas ?? ""
                                        })}>
                                            Editar datos
                                        </button>
                                        {" · "}
                                        <button type="button" className="boton-enlace texto-error" onClick={eliminarCliente}>
                                            Eliminar cliente
                                        </button>
                                    </>
                                )}
                            </p>
                        )}

                        <div className={`saldo-cliente ${saldo > 0 ? "con-deuda" : ""}`}>
                            <span>{saldo > 0 ? "Debe" : saldo < 0 ? "Saldo a favor" : "Sin deuda"}</span>
                            <strong>{moneda(Math.abs(saldo))}</strong>
                        </div>

                        {saldo > 0 && (
                            <form className="formulario form-abono" onSubmit={registrarAbono}>
                                <h3>Registrar pago</h3>
                                <div className="fila-campos fila-dos">
                                    <div className="campo">
                                        <label htmlFor="abono-monto">Monto (S/)</label>
                                        <input
                                            id="abono-monto"
                                            type="number"
                                            min="0.01"
                                            max={saldo}
                                            step="0.01"
                                            inputMode="decimal"
                                            value={abono.monto}
                                            onChange={(e) => setAbono((v) => ({ ...v, monto: e.target.value }))}
                                            required
                                        />
                                        <button type="button" className="boton-enlace" onClick={() => setAbono((v) => ({ ...v, monto: saldo.toFixed(2) }))}>
                                            Paga todo ({moneda(saldo)})
                                        </button>
                                    </div>
                                    <div className="campo">
                                        <label htmlFor="abono-metodo">¿Cómo pagó?</label>
                                        <select id="abono-metodo" value={abono.metodoPago} onChange={(e) => setAbono((v) => ({ ...v, metodoPago: e.target.value }))}>
                                            {METODOS_ABONO.map((m) => <option key={m.valor} value={m.valor}>{m.texto}</option>)}
                                        </select>
                                    </div>
                                </div>
                                <div className="campo">
                                    <label htmlFor="abono-nota">Nota (opcional)</label>
                                    <input id="abono-nota" maxLength={200} value={abono.nota} onChange={(e) => setAbono((v) => ({ ...v, nota: e.target.value }))} />
                                </div>
                                <button type="submit" className="boton-principal" disabled={enviando}>
                                    {enviando ? "Guardando..." : "Registrar pago"}
                                </button>
                            </form>
                        )}

                        {mensaje && <p className={`mensaje mensaje-${mensaje.tipo}`} role="status">{mensaje.texto}</p>}

                        <h3>Compras fiadas</h3>
                        {cliente.fiados.length === 0 ? (
                            <p className="ayuda-campo">No tiene compras fiadas.</p>
                        ) : (
                            <ul className="lista-movimientos">
                                {cliente.fiados.map((f) => (
                                    <li key={f.grupo} className={f.anulada ? "fila-anulada" : ""}>
                                        <div>
                                            <strong>Boleta N° {String(f.numero).padStart(6, "0")}{f.anulada && " · ANULADA"}</strong>
                                            <span>{formatearFecha(f.fecha)} · {f.productos}</span>
                                        </div>
                                        <strong className="texto-deuda">{moneda(f.total)}</strong>
                                    </li>
                                ))}
                            </ul>
                        )}

                        <h3>Pagos</h3>
                        {cliente.abonos.length === 0 ? (
                            <p className="ayuda-campo">Todavía no hay pagos.</p>
                        ) : (
                            <ul className="lista-movimientos">
                                {cliente.abonos.map((a) => (
                                    <li key={a.id}>
                                        <div>
                                            <strong>{formatearFecha(a.fecha)}</strong>
                                            <span>{METODOS_ABONO.find((m) => m.valor === a.metodoPago)?.texto} · {a.registradoPor}{a.nota && ` · ${a.nota}`}</span>
                                        </div>
                                        <strong className="texto-pago">{moneda(a.monto)}</strong>
                                        {esJefe && (
                                            <button type="button" className="boton-icono" onClick={() => eliminarAbono(a.id)} aria-label="Eliminar pago" title="Eliminar">🗑️</button>
                                        )}
                                    </li>
                                ))}
                            </ul>
                        )}
                    </>
                )}
            </div>
        </dialog>
    );
}

export default function Clientes({ esJefe, onError }) {
    const [clientes, setClientes] = useState(null);
    const [busqueda, setBusqueda] = useState("");
    const [soloDeudores, setSoloDeudores] = useState(false);
    const [nuevo, setNuevo] = useState({ nombre: "", telefono: "", notas: "" });
    const [mensaje, setMensaje] = useState(null);
    const [abierto, setAbierto] = useState(null);

    const cargar = useCallback(async () => {
        try {
            setClientes(await pedir("/api/clientes"));
        } catch (err) {
            onError(err, () => setMensaje({ tipo: "error", texto: err.message }));
        }
    }, [onError]);

    useEffect(() => {
        cargar();
    }, [cargar]);

    async function registrar(evento) {
        evento.preventDefault();

        try {
            await pedir("/api/clientes", { method: "POST", cuerpo: nuevo });
            setMensaje({ tipo: "exito", texto: `${nuevo.nombre.trim()} se registró.` });
            setNuevo({ nombre: "", telefono: "", notas: "" });
            await cargar();
        } catch (err) {
            onError(err, () => setMensaje({ tipo: "error", texto: err.message }));
        }
    }

    const texto = busqueda.trim().toLowerCase();
    const filtrados = (clientes ?? []).filter((c) =>
        (!soloDeudores || Number(c.saldo) > 0) &&
        (!texto || c.nombre.toLowerCase().includes(texto) || (c.telefono ?? "").includes(texto.replace(/\D/g, "") || "-"))
    );
    const totalDeuda = (clientes ?? []).reduce((suma, c) => suma + Math.max(Number(c.saldo), 0), 0);
    const deudores = (clientes ?? []).filter((c) => Number(c.saldo) > 0).length;

    return (
        <div className="contenido-vista vista-gastos">
            <section className="tarjeta formulario-gasto">
                <h2>Nuevo cliente</h2>
                <form className="formulario" onSubmit={registrar}>
                    <div className="campo">
                        <label htmlFor="cliente-nombre">Nombre</label>
                        <input id="cliente-nombre" maxLength={100} placeholder="Ej. Rosa Pérez" value={nuevo.nombre}
                            onChange={(e) => setNuevo((v) => ({ ...v, nombre: e.target.value }))} required />
                    </div>
                    <div className="campo">
                        <label htmlFor="cliente-telefono">WhatsApp (opcional)</label>
                        <input id="cliente-telefono" type="tel" inputMode="tel" placeholder="Ej. 987 654 321" value={nuevo.telefono}
                            onChange={(e) => setNuevo((v) => ({ ...v, telefono: e.target.value }))} />
                    </div>
                    <div className="campo">
                        <label htmlFor="cliente-notas">Notas (opcional)</label>
                        <input id="cliente-notas" maxLength={200} placeholder="Ej. Tienda en el jr. Gamarra" value={nuevo.notas}
                            onChange={(e) => setNuevo((v) => ({ ...v, notas: e.target.value }))} />
                    </div>
                    <button type="submit" className="boton-principal">Registrar cliente</button>
                    {mensaje && <p className={`mensaje mensaje-${mensaje.tipo}`} role="status">{mensaje.texto}</p>}
                </form>
            </section>

            <section className="tarjeta">
                <h2>Mis clientes</h2>

                <div className="total-gastos total-por-cobrar">
                    <span>Por cobrar ({deudores} {deudores === 1 ? "cliente" : "clientes"})</span>
                    <strong>{moneda(totalDeuda)}</strong>
                </div>

                <div className="buscador">
                    <input type="search" placeholder="Buscar por nombre o WhatsApp..." aria-label="Buscar cliente"
                        value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
                    <label className="casilla">
                        <input type="checkbox" checked={soloDeudores} onChange={(e) => setSoloDeudores(e.target.checked)} />
                        Solo los que deben
                    </label>
                </div>

                {clientes === null ? (
                    <p>Cargando clientes...</p>
                ) : filtrados.length === 0 ? (
                    <p>{clientes.length === 0 ? "Todavía no hay clientes. Regístralos aquí o al hacer una venta." : "No hay clientes con ese filtro."}</p>
                ) : (
                    <ul className="lista-gastos">
                        {filtrados.map((c) => (
                            <li key={c.id}>
                                <button type="button" className="gasto fila-cliente" onClick={() => setAbierto(c.id)}>
                                    <span className="avatar-empleado" aria-hidden="true">{c.nombre.charAt(0).toUpperCase()}</span>
                                    <span className="gasto-datos">
                                        <strong>{c.nombre}</strong>
                                        <span>{mostrarTelefono(c.telefono) || "Sin WhatsApp"} · {c.compras} {c.compras === 1 ? "compra" : "compras"}</span>
                                    </span>
                                    <strong className={Number(c.saldo) > 0 ? "texto-deuda" : "texto-sin-deuda"}>
                                        {Number(c.saldo) > 0 ? `Debe ${moneda(c.saldo)}` : "Al día"}
                                    </strong>
                                </button>
                            </li>
                        ))}
                    </ul>
                )}
            </section>

            {abierto && (
                <DetalleCliente
                    clienteId={abierto}
                    esJefe={esJefe}
                    onCambio={cargar}
                    onError={onError}
                    onCerrar={() => setAbierto(null)}
                />
            )}
        </div>
    );
}
