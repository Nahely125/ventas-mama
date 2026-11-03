import { useCallback, useEffect, useState } from "react";
import { moneda, monedaCosto, pedir } from "../api.js";
import { hoy } from "../fechas.js";
import BuscadorProducto from "./BuscadorProducto.jsx";

const CONTABILIZAR = [
    { valor: "inversion", texto: "💼 Inversión" },
    { valor: "gasto", texto: "💸 Gasto (Mercadería)" },
    { valor: "ninguno", texto: "Solo sumar stock" }
];

// Una fila de la lista: cantidad, costo, color y "¿se adquirió?".
function ItemReposicion({ item, onCambiar, onQuitar, onAdquirir, ocupado }) {
    const [cantidad, setCantidad] = useState(String(item.cantidad));
    const [costo, setCosto] = useState(item.costoUnitario === null ? "" : String(Number(item.costoUnitario)));

    useEffect(() => setCantidad(String(item.cantidad)), [item.cantidad]);
    useEffect(() => setCosto(item.costoUnitario === null ? "" : String(Number(item.costoUnitario))), [item.costoUnitario]);

    const subtotal = (Number(cantidad) || 0) * (Number(costo) || 0);
    const faltaColor = item.colores.length > 0 && !item.colorId;

    function guardarCantidad() {
        const numero = Number(cantidad);
        if (Number.isInteger(numero) && numero > 0 && numero !== item.cantidad) onCambiar({ cantidad: numero });
        else setCantidad(String(item.cantidad));
    }

    function guardarCosto() {
        if (costo === "") return;
        const numero = Number(costo);
        if (Number.isFinite(numero) && numero >= 0 && numero !== Number(item.costoUnitario)) {
            onCambiar({ costoUnitario: Number(numero.toFixed(4)) });
        }
    }

    return (
        <li className={`item-reposicion ${item.comprar ? "" : "no-comprar"}`}>
            <div className="item-reposicion-cabecera">
                <label className="casilla">
                    <input
                        type="checkbox"
                        checked={item.comprar}
                        onChange={(e) => onCambiar({ comprar: e.target.checked })}
                        disabled={ocupado}
                        aria-label={`Comprar ${item.nombre}`}
                    />
                    <span>
                        {item.codigo && <span className="codigo-producto">{item.codigo}</span>}
                        <strong>{item.nombre}</strong>
                    </span>
                </label>
                <span className={`fila-stock ${item.stock === 0 ? "agotado" : "bajo"}`}>
                    {item.stock}
                    <small>hay</small>
                </span>
            </div>

            <small className="ayuda-campo">
                {item.vendidas30 > 0 ? `Se vendieron ${item.vendidas30} en los últimos 30 días` : "Sin ventas en 30 días"}
                {item.unidadesPorCaja > 1 ? ` · viene en cajas de ${item.unidadesPorCaja}` : ""}
            </small>

            <div className="item-reposicion-campos">
                {item.colores.length > 0 && (
                    <div className="campo">
                        <label htmlFor={`repo-color-${item.id}`}>Color</label>
                        <select
                            id={`repo-color-${item.id}`}
                            value={item.colorId ?? ""}
                            onChange={(e) => onCambiar({ colorId: e.target.value ? Number(e.target.value) : null })}
                            disabled={ocupado}
                            className={faltaColor ? "falta" : ""}
                        >
                            <option value="">Elige el color</option>
                            {item.colores.map((c) => (
                                <option key={c.id} value={c.id}>{c.nombre} (hay {c.stock})</option>
                            ))}
                        </select>
                    </div>
                )}
                <div className="campo">
                    <label htmlFor={`repo-cantidad-${item.id}`}>Cantidad</label>
                    <input
                        id={`repo-cantidad-${item.id}`}
                        type="number"
                        min="1"
                        step="1"
                        inputMode="numeric"
                        value={cantidad}
                        onChange={(e) => setCantidad(e.target.value)}
                        onBlur={guardarCantidad}
                        disabled={ocupado}
                    />
                </div>
                <div className="campo">
                    <label htmlFor={`repo-costo-${item.id}`}>Costo c/u (S/)</label>
                    <input
                        id={`repo-costo-${item.id}`}
                        type="number"
                        min="0"
                        step="0.0001"
                        inputMode="decimal"
                        placeholder="Sin costo"
                        value={costo}
                        onChange={(e) => setCosto(e.target.value)}
                        onBlur={guardarCosto}
                        disabled={ocupado}
                    />
                </div>
            </div>

            <div className="item-reposicion-pie">
                <span>
                    Subtotal <strong>{moneda(subtotal)}</strong>
                    {costo !== "" && <small> ({cantidad || 0} × {monedaCosto(costo)})</small>}
                </span>
                <div className="item-reposicion-acciones">
                    <span className="pregunta-adquirido">¿Se adquirió?</span>
                    <button type="button" className="boton-adquirido" onClick={onAdquirir} disabled={ocupado || !item.comprar}>
                        ✅ Sí
                    </button>
                    {item.comprar ? (
                        <button type="button" className="boton-secundario boton-pequeno" onClick={() => onCambiar({ comprar: false })} disabled={ocupado}>
                            ❌ No
                        </button>
                    ) : (
                        <button type="button" className="boton-secundario boton-pequeno" onClick={() => onCambiar({ comprar: true })} disabled={ocupado}>
                            ↩ Volver a comprar
                        </button>
                    )}
                    <button type="button" className="boton-enlace" onClick={onQuitar} disabled={ocupado} aria-label={`Quitar ${item.nombre} de la lista`}>
                        Quitar
                    </button>
                </div>
            </div>
            {faltaColor && item.comprar && <small className="texto-error">Elige el color antes de marcarlo como adquirido.</small>}
            {!item.comprar && <small className="ayuda-campo">No se adquirirá por ahora: no cuenta en el total.</small>}
        </li>
    );
}

/* Lista de reposición: productos por comprar, cuánto costaría todo lo marcado y,
   al adquirirlos, se registran como compra (stock nuevo + inversión). Solo el jefe. */
export default function Reposicion({ productos, onCambio, onError }) {
    const [datos, setDatos] = useState(null);
    const [error, setError] = useState("");
    const [mensaje, setMensaje] = useState(null);
    const [ocupado, setOcupado] = useState(false);
    const [agregando, setAgregando] = useState(null);
    const [compra, setCompra] = useState({ proveedor: "", fecha: hoy(), contabilizar: "inversion" });

    const cargar = useCallback(async () => {
        try {
            setDatos(await pedir("/api/reposicion"));
            setError("");
        } catch (err) {
            onError(err, () => setError(err.message));
        }
    }, [onError]);

    useEffect(() => {
        cargar();
    }, [cargar]);

    // Ejecuta una acción que devuelve la lista actualizada.
    async function hacer(accion, exito) {
        setOcupado(true);
        setMensaje(null);
        try {
            const resultado = await accion();
            setDatos(resultado);
            if (exito || resultado.mensaje) setMensaje({ tipo: "exito", texto: exito ?? resultado.mensaje });
            return resultado;
        } catch (err) {
            onError(err, () => setMensaje({ tipo: "error", texto: err.message }));
            return null;
        } finally {
            setOcupado(false);
        }
    }

    const cambiar = (item, cambios) => hacer(() => pedir(`/api/reposicion/${item.id}`, { method: "PUT", cuerpo: cambios }), null);
    const quitar = (item) => hacer(() => pedir(`/api/reposicion/${item.id}`, { method: "DELETE" }), `${item.nombre} salió de la lista.`);

    async function adquirir(ids, texto) {
        if (!confirm(texto)) return;
        const resultado = await hacer(() => pedir("/api/reposicion/adquirir", {
            method: "POST",
            cuerpo: { ids, proveedor: compra.proveedor.trim(), fecha: compra.fecha, contabilizar: compra.contabilizar }
        }));
        if (resultado) await onCambio();
    }

    async function agregar() {
        if (!agregando) return;
        const resultado = await hacer(() => pedir("/api/reposicion", { method: "POST", cuerpo: { productoId: agregando.id } }));
        if (resultado) setAgregando(null);
    }

    if (error) return <p className="mensaje mensaje-error">{error}</p>;
    if (!datos) return <p className="cargando-vista"><span className="spinner" aria-hidden="true"></span> Cargando...</p>;

    const marcados = datos.items.filter((i) => i.comprar);

    return (
        <div className="contenido-vista">
            <section className="tarjeta reposicion">
                <div className="totales-reposicion">
                    <div>
                        <span>Productos a comprar</span>
                        <strong>{datos.totales.productos}</strong>
                    </div>
                    <div>
                        <span>Unidades</span>
                        <strong>{datos.totales.unidades}</strong>
                    </div>
                    <div className="total-reposicion">
                        <span>Costaría</span>
                        <strong>{moneda(datos.totales.costo)}</strong>
                    </div>
                </div>
                {datos.totales.sinCosto > 0 && (
                    <p className="ayuda-campo">⚠️ {datos.totales.sinCosto} {datos.totales.sinCosto === 1 ? "producto no tiene" : "productos no tienen"} costo: escríbelo para que el total sea exacto.</p>
                )}

                {datos.sugerencias > 0 && (
                    <button
                        type="button"
                        className="boton-principal boton-sugerir"
                        onClick={() => hacer(() => pedir("/api/reposicion/sugerir", { method: "POST" }))}
                        disabled={ocupado}
                    >
                        ⚠️ Agregar {datos.sugerencias} {datos.sugerencias === 1 ? "producto" : "productos"} con poco stock (menos de {datos.stockAlerta})
                    </button>
                )}

                <div className="campo agregar-reposicion">
                    <label htmlFor="buscar-producto-venta">Agregar otro producto</label>
                    <BuscadorProducto productos={productos ?? []} seleccionado={agregando} onSeleccionar={setAgregando} permitirAgotados />
                    {agregando && (
                        <button type="button" className="boton-secundario" onClick={agregar} disabled={ocupado}>
                            ➕ Agregar {agregando.nombre} a la lista
                        </button>
                    )}
                </div>

                {mensaje && <p className={`mensaje mensaje-${mensaje.tipo}`} role="status">{mensaje.texto}</p>}
            </section>

            <section className="tarjeta">
                <h2>Lista de reposición</h2>
                {datos.items.length === 0 ? (
                    <p className="aviso-busqueda">La lista está vacía. Agrega los productos con poco stock o busca uno.</p>
                ) : (
                    <ul className="lista-reposicion">
                        {datos.items.map((item) => (
                            <ItemReposicion
                                key={item.id}
                                item={item}
                                ocupado={ocupado}
                                onCambiar={(cambios) => cambiar(item, cambios)}
                                onQuitar={() => quitar(item)}
                                onAdquirir={() => adquirir([item.id], `¿Se adquirieron ${item.cantidad} u. de ${item.nombre}? Se sumarán al stock y se registrarán como ${CONTABILIZAR.find((c) => c.valor === compra.contabilizar).texto.replace(/^\S+ /, "").toLowerCase()}.`)}
                            />
                        ))}
                    </ul>
                )}
            </section>

            {marcados.length > 0 && (
                <section className="tarjeta registrar-reposicion">
                    <h2>Registrar lo adquirido</h2>
                    <p className="ayuda-campo">Al confirmar, cada producto marcado suma su cantidad al stock y queda como compra.</p>
                    <div className="fila-campos fila-dos">
                        <div className="campo">
                            <label htmlFor="repo-proveedor">Proveedor (opcional)</label>
                            <input id="repo-proveedor" maxLength={120} placeholder="Ej. Mercado Central" value={compra.proveedor}
                                onChange={(e) => setCompra((c) => ({ ...c, proveedor: e.target.value }))} />
                        </div>
                        <div className="campo">
                            <label htmlFor="repo-fecha">Fecha</label>
                            <input id="repo-fecha" type="date" max={hoy()} value={compra.fecha}
                                onChange={(e) => setCompra((c) => ({ ...c, fecha: e.target.value }))} />
                        </div>
                    </div>
                    <div className="campo">
                        <label htmlFor="repo-contabilizar">¿Cómo se cuenta este dinero?</label>
                        <select id="repo-contabilizar" value={compra.contabilizar} onChange={(e) => setCompra((c) => ({ ...c, contabilizar: e.target.value }))}>
                            {CONTABILIZAR.map((c) => <option key={c.valor} value={c.valor}>{c.texto}</option>)}
                        </select>
                    </div>
                    <button
                        type="button"
                        className="boton-principal"
                        disabled={ocupado}
                        onClick={() => adquirir(
                            marcados.map((i) => i.id),
                            `¿Se adquirieron los ${marcados.length} productos marcados por ${moneda(datos.totales.costo)}? Se sumarán al stock.`
                        )}
                    >
                        ✅ Se adquirieron los {marcados.length} marcados · {moneda(datos.totales.costo)}
                    </button>
                </section>
            )}
        </div>
    );
}
