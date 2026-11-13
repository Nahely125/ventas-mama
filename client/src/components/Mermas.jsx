import { useCallback, useEffect, useState } from "react";
import { moneda, pedir } from "../api.js";
import { urlFoto } from "../fotos.js";
import { formatearDia, hoy, nombreMes } from "../fechas.js";
import BuscadorProducto from "./BuscadorProducto.jsx";
import ConteoProducto from "./ConteoProducto.jsx";

const MOTIVOS = {
    roto: { icono: "💔", texto: "Roto o dañado" },
    perdido: { icono: "❓", texto: "Perdido o faltante" },
    conteo: { icono: "🧮", texto: "Faltó en el conteo" }
};

const ESTADOS = {
    pendiente: { icono: "⏳", texto: "Por reclamar" },
    cambiado: { icono: "✅", texto: "Cambiado" },
    perdida: { icono: "❌", texto: "Pérdida" }
};

// Periodos rápidos: desde/hasta en YYYY-MM-DD (vacío = sin límite).
function rango(periodo) {
    const fin = hoy();
    const [anio, mes] = fin.split("-").map(Number);
    const primero = (a, m) => `${a}-${String(m).padStart(2, "0")}-01`;

    if (periodo === "mes") return { desde: primero(anio, mes), hasta: fin };
    if (periodo === "anterior") {
        const a = mes === 1 ? anio - 1 : anio;
        const m = mes === 1 ? 12 : mes - 1;
        const ultimo = new Date(a, m, 0).getDate();
        return { desde: primero(a, m), hasta: `${a}-${String(m).padStart(2, "0")}-${ultimo}` };
    }
    if (periodo === "3meses") {
        const fecha = new Date(anio, mes - 3, 1);
        return { desde: primero(fecha.getFullYear(), fecha.getMonth() + 1), hasta: fin };
    }
    if (periodo === "anio") return { desde: `${anio}-01-01`, hasta: fin };
    return { desde: "", hasta: "" };
}

const PERIODOS = [
    { valor: "mes", texto: "Este mes" },
    { valor: "anterior", texto: "Mes anterior" },
    { valor: "3meses", texto: "Últimos 3 meses" },
    { valor: "anio", texto: "Este año" },
    { valor: "todo", texto: "Todo" }
];

const plural = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`;

// «El proveedor lo cambió»: cuántas unidades llegaron (y de qué color, si hace falta).
function FormularioCambio({ merma, ocupado, onGuardar, onCancelar }) {
    const restante = merma.cantidad - merma.cantidadCambiada;
    const [cantidad, setCantidad] = useState(String(restante));
    const [colorId, setColorId] = useState("");
    const [nota, setNota] = useState("");
    const pideColor = !merma.colorId && merma.colores.length > 0;

    return (
        <form
            className="formulario formulario-merma"
            onSubmit={(e) => {
                e.preventDefault();
                onGuardar({
                    cantidad: Number(cantidad),
                    colorId: pideColor ? Number(colorId) : undefined,
                    nota
                });
            }}
        >
            <div className="fila-campos fila-dos">
                <div className="campo">
                    <label htmlFor={`cambio-cantidad-${merma.id}`}>¿Cuántas llegaron?</label>
                    <input id={`cambio-cantidad-${merma.id}`} type="number" min="1" max={restante} step="1" inputMode="numeric"
                        required value={cantidad} onChange={(e) => setCantidad(e.target.value)} />
                    <span className="ayuda-campo">De {plural(restante, "unidad", "unidades")} por reclamar.</span>
                </div>
                {pideColor && (
                    <div className="campo">
                        <label htmlFor={`cambio-color-${merma.id}`}>Color</label>
                        <select id={`cambio-color-${merma.id}`} required value={colorId} onChange={(e) => setColorId(e.target.value)}>
                            <option value="">Elige el color</option>
                            {merma.colores.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                        </select>
                    </div>
                )}
            </div>
            <div className="campo">
                <label htmlFor={`cambio-nota-${merma.id}`}>Nota (opcional)</label>
                <input id={`cambio-nota-${merma.id}`} maxLength={200} placeholder="Ej. el proveedor las repuso en la compra del lunes"
                    value={nota} onChange={(e) => setNota(e.target.value)} />
            </div>
            <span className="ayuda-campo">Las unidades vuelven al stock y quedan en el historial del producto.</span>
            <div className="acciones-merma">
                <button type="submit" className="boton-principal" disabled={ocupado}>🔁 Volver al stock</button>
                <button type="button" className="boton-secundario" onClick={onCancelar}>Cancelar</button>
            </div>
        </form>
    );
}

function TarjetaMerma({ merma, ocupado, accion }) {
    const [cambiando, setCambiando] = useState(false);
    const motivo = MOTIVOS[merma.motivo] ?? { icono: "•", texto: merma.motivo };
    const estado = ESTADOS[merma.estado];
    const foto = urlFoto({ id: merma.productoId, tieneFoto: merma.tieneFoto, fotoVersion: merma.fotoVersion }, "mini");
    const restante = merma.cantidad - merma.cantidadCambiada;
    const costo = Number(merma.costoUnitario ?? 0);

    return (
        <li className={`tarjeta-merma estado-${merma.estado}`}>
            <div className="merma-cabecera">
                <span className="merma-foto">
                    {foto ? <img src={foto} alt="" loading="lazy" /> : <span aria-hidden="true">📦</span>}
                </span>
                <div className="merma-datos">
                    <strong>{merma.producto}{merma.colorNombre ? ` · ${merma.colorNombre}` : ""}</strong>
                    <small>
                        {motivo.icono} {motivo.texto} · {formatearDia(merma.fecha.slice(0, 10))}
                        {merma.usuario ? ` · ${merma.usuario}` : ""}
                    </small>
                    {merma.nota && <small className="merma-nota">{merma.nota}</small>}
                </div>
                <span className={`chip-estado chip-${merma.estado}`}>{estado.icono} {estado.texto}</span>
            </div>

            <dl className="merma-numeros">
                <div><dt>Unidades</dt><dd>{merma.cantidad}</dd></div>
                <div><dt>Valor al costo</dt><dd>{moneda(merma.valor)}</dd></div>
                <div><dt>Cambiadas</dt><dd>{merma.cantidadCambiada} <small>({moneda(merma.cantidadCambiada * costo)})</small></dd></div>
                <div>
                    <dt>{merma.estado === "perdida" ? "Perdidas" : "Por reclamar"}</dt>
                    <dd>{merma.estado === "cambiado" ? 0 : restante} <small>({moneda((merma.estado === "cambiado" ? 0 : restante) * costo)})</small></dd>
                </div>
            </dl>

            {merma.notaResuelta && <p className="merma-resolucion">📝 {merma.notaResuelta}{merma.resueltaPor ? ` · ${merma.resueltaPor}` : ""}</p>}

            {merma.estado === "pendiente" && !cambiando && (
                <div className="acciones-merma">
                    <button type="button" className="boton-principal boton-pequeno" disabled={ocupado} onClick={() => setCambiando(true)}>
                        🔁 El proveedor lo cambió
                    </button>
                    <button
                        type="button"
                        className="boton-secundario boton-pequeno"
                        disabled={ocupado}
                        onClick={() => {
                            const nota = prompt("¿Por qué no se pudo cambiar? (opcional)") ?? null;
                            if (nota === null) return;
                            accion(`/api/mermas/${merma.id}/perdida`, { nota });
                        }}
                    >
                        ❌ No se pudo cambiar
                    </button>
                </div>
            )}

            {merma.estado === "pendiente" && cambiando && (
                <FormularioCambio
                    merma={merma}
                    ocupado={ocupado}
                    onCancelar={() => setCambiando(false)}
                    onGuardar={async (datos) => {
                        if (await accion(`/api/mermas/${merma.id}/cambio`, datos)) setCambiando(false);
                    }}
                />
            )}

            {merma.estado === "perdida" && (
                <div className="acciones-merma">
                    <button type="button" className="boton-enlace" disabled={ocupado}
                        onClick={() => confirm("¿Reabrir? Volverá a estar por reclamar.") && accion(`/api/mermas/${merma.id}/reabrir`)}>
                        Reabrir (al final sí se cambió)
                    </button>
                </div>
            )}
        </li>
    );
}

/* Rotos y faltantes: cuánta mercadería se pierde, cuánta se recupera con cambios del proveedor
   y el historial de cada caso. Solo el jefe. */
export default function Mermas({ productos, onCambio, onError }) {
    const [periodo, setPeriodo] = useState("3meses");
    const [estado, setEstado] = useState("");
    const [datos, setDatos] = useState(null);
    const [mensaje, setMensaje] = useState(null);
    const [ocupado, setOcupado] = useState(false);
    const [elegido, setElegido] = useState(null);
    const [registrando, setRegistrando] = useState(null);

    const { desde, hasta } = rango(periodo);
    const consulta = new URLSearchParams({ ...(desde && { desde }), ...(hasta && { hasta }), ...(estado && { estado }) }).toString();

    const cargar = useCallback(async () => {
        try {
            setDatos(await pedir(`/api/mermas?${consulta}`));
        } catch (err) {
            onError(err, () => setMensaje({ tipo: "error", texto: err.message }));
        }
    }, [consulta, onError]);

    useEffect(() => {
        cargar();
    }, [cargar]);

    // Acciones (cambio, pérdida, reabrir): devuelven la lista actualizada. true si salió bien.
    async function accion(url, cuerpo = {}) {
        setOcupado(true);
        setMensaje(null);
        try {
            const resultado = await pedir(`${url}?${consulta}`, { method: "POST", cuerpo });
            setDatos(resultado);
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

    const r = datos?.resumen;
    const maximoMes = Math.max(1, ...(datos?.porMes ?? []).map((m) => Number(m.valor)));

    return (
        <div className="contenido-vista">
            <section className="tarjeta">
                <h2>Registrar roto o faltante</h2>
                <p className="descripcion-seccion">
                    Busca el producto y descuenta las unidades rotas o que faltan. Quedan aquí para seguir si el proveedor las cambia.
                </p>
                <BuscadorProducto
                    productos={productos ?? []}
                    seleccionado={elegido}
                    permitirAgotados={false}
                    onSeleccionar={(producto) => {
                        setElegido(producto);
                        if (producto) setRegistrando(producto);
                    }}
                />
            </section>

            {mensaje && <p className={`mensaje mensaje-${mensaje.tipo}`} role="status">{mensaje.texto}</p>}

            <section className="tarjeta">
                <div className="filtros-mermas">
                    <div className="campo">
                        <label htmlFor="mermas-periodo">Periodo</label>
                        <select id="mermas-periodo" value={periodo} onChange={(e) => setPeriodo(e.target.value)}>
                            {PERIODOS.map((p) => <option key={p.valor} value={p.valor}>{p.texto}</option>)}
                        </select>
                    </div>
                    <div className="campo">
                        <label htmlFor="mermas-estado">Estado</label>
                        <select id="mermas-estado" value={estado} onChange={(e) => setEstado(e.target.value)}>
                            <option value="">Todos</option>
                            <option value="pendiente">⏳ Por reclamar</option>
                            <option value="cambiado">✅ Cambiados</option>
                            <option value="perdida">❌ Pérdidas</option>
                        </select>
                    </div>
                </div>

                {r && (
                    <div className="resumen-mermas">
                        <div className="total-merma total-perdido">
                            <span>Se perdió</span>
                            <strong>{moneda(r.valor)}</strong>
                            <small>{plural(r.unidades, "unidad", "unidades")} · {plural(r.registros, "caso", "casos")}</small>
                        </div>
                        <div className="total-merma total-recuperado">
                            <span>Recuperado con cambios</span>
                            <strong>{moneda(r.recuperado)}</strong>
                            <small>{plural(r.unidades_cambiadas, "unidad volvió", "unidades volvieron")} al stock</small>
                        </div>
                        <div className="total-merma total-reclamar">
                            <span>Por reclamar</span>
                            <strong>{moneda(r.por_reclamar)}</strong>
                            <small>{plural(r.unidades_por_reclamar, "unidad", "unidades")}</small>
                        </div>
                        <div className="total-merma total-definitiva">
                            <span>Pérdida definitiva</span>
                            <strong>{moneda(r.perdida)}</strong>
                            <small>{plural(r.unidades_perdidas, "unidad", "unidades")} no se pudieron cambiar</small>
                        </div>
                    </div>
                )}
                <p className="ayuda-campo">Valores al costo de compra de cada producto.</p>
            </section>

            {datos?.porMes.length > 0 && (
                <section className="tarjeta">
                    <h2>Por mes</h2>
                    <ul className="barras-mermas">
                        {datos.porMes.map((m) => (
                            <li key={m.mes}>
                                <span className="barra-etiqueta">{nombreMes(m.mes)}</span>
                                <span className="barra-pista" aria-hidden="true">
                                    <span className="barra-perdido" style={{ width: `${(Number(m.valor) / maximoMes) * 100}%` }}>
                                        <span className="barra-recuperado" style={{ width: `${Number(m.valor) ? (Number(m.recuperado) / Number(m.valor)) * 100 : 0}%` }} />
                                    </span>
                                </span>
                                <span className="barra-valor">
                                    {moneda(m.valor)}
                                    {Number(m.recuperado) > 0 && <small> · recuperado {moneda(m.recuperado)}</small>}
                                </span>
                            </li>
                        ))}
                    </ul>
                    <p className="ayuda-campo"><span className="muestra muestra-perdido" /> Perdido <span className="muestra muestra-recuperado" /> Recuperado con cambios</p>
                </section>
            )}

            {datos?.porProducto.length > 0 && (
                <section className="tarjeta">
                    <h2>Productos que más se pierden</h2>
                    <ol className="ranking-mermas">
                        {datos.porProducto.map((p) => (
                            <li key={p.id}>
                                <span>{p.nombre}{p.codigo ? <small> · {p.codigo}</small> : null}</span>
                                <span>{p.unidades} u. · <strong>{moneda(p.valor)}</strong></span>
                            </li>
                        ))}
                    </ol>
                </section>
            )}

            <section className="tarjeta">
                <h2>Historial de rotos y faltantes</h2>
                {datos === null ? (
                    <p>Cargando...</p>
                ) : datos.mermas.length === 0 ? (
                    <p className="aviso-busqueda">No hay rotos ni faltantes en este periodo. 🎉</p>
                ) : (
                    <ul className="lista-mermas">
                        {datos.mermas.map((m) => <TarjetaMerma key={m.id} merma={m} ocupado={ocupado} accion={accion} />)}
                    </ul>
                )}
            </section>

            {registrando && (
                <ConteoProducto
                    producto={registrando}
                    onError={onError}
                    onCerrar={() => { setRegistrando(null); setElegido(null); }}
                    onGuardado={async (resultado) => {
                        setRegistrando(null);
                        setElegido(null);
                        setMensaje({ tipo: "exito", texto: `${registrando.nombre}: ${resultado.mensaje}` });
                        await Promise.all([cargar(), onCambio?.()]);
                    }}
                />
            )}
        </div>
    );
}
