import { useEffect, useRef, useState } from "react";
import { moneda, pedir } from "../api.js";
import { hoy } from "../fechas.js";
import BuscadorProducto from "./BuscadorProducto.jsx";

/* Ventana "Ingresar mercadería": suma unidades al stock, guarda fecha, proveedor y costo,
   y lo registra como inversión o gasto. productoInicial: si se abre desde un producto. */
export default function IngresarMercaderia({ productos, productoInicial = null, onGuardado, onCerrar, onError }) {
    const dialogo = useRef(null);
    const [producto, setProducto] = useState(productoInicial);
    const [cantidad, setCantidad] = useState("");
    const [enCajas, setEnCajas] = useState(false);
    const [costo, setCosto] = useState("");
    const [costoPorUnidad, setCostoPorUnidad] = useState(false);
    const [proveedor, setProveedor] = useState("");
    const [fecha, setFecha] = useState(hoy());
    const [contabilizar, setContabilizar] = useState("inversion");
    const [error, setError] = useState("");
    const [enviando, setEnviando] = useState(false);

    useEffect(() => {
        dialogo.current?.showModal();
    }, []);

    const porCaja = Number(producto?.unidadesPorCaja ?? 1);
    const unidades = (Number.parseInt(cantidad, 10) || 0) * (enCajas ? porCaja : 1);
    const costoNumero = Number(costo) || 0;
    const costoTotal = costoPorUnidad ? costoNumero * unidades : costoNumero;
    const costoUnitario = unidades > 0 ? costoTotal / unidades : 0;

    async function guardar(evento) {
        evento.preventDefault();
        setError("");

        if (!producto) {
            setError("Busca y elige el producto que llegó.");
            return;
        }

        if (unidades <= 0) {
            setError("Escribe cuántas unidades llegaron.");
            return;
        }

        setEnviando(true);

        try {
            const resultado = await pedir("/api/compras", {
                method: "POST",
                cuerpo: {
                    productoId: producto.id,
                    cantidad: unidades,
                    costoTotal: Number(costoTotal.toFixed(2)),
                    proveedor: proveedor.trim(),
                    fecha,
                    contabilizar
                }
            });
            await onGuardado(resultado);
        } catch (err) {
            onError(err, () => setError(err.message));
            setEnviando(false);
        }
    }

    return (
        <dialog ref={dialogo} className="modal" onClose={onCerrar} aria-labelledby="titulo-ingresar">
            <form className="modal-contenido formulario" onSubmit={guardar}>
                <div className="modal-encabezado">
                    <h2 id="titulo-ingresar">🚚 Ingresar mercadería</h2>
                    <button type="button" className="boton-cerrar-modal" onClick={onCerrar} aria-label="Cerrar">✕</button>
                </div>

                <div className="campo">
                    <label htmlFor="buscar-producto-venta">Producto</label>
                    {productoInicial ? (
                        <p className="producto-seleccionado-datos producto-fijo">
                            <strong>{producto.nombre}</strong>
                            <span>Stock actual: {producto.stock} u.</span>
                        </p>
                    ) : (
                        <BuscadorProducto productos={productos} seleccionado={producto} onSeleccionar={setProducto} permitirAgotados />
                    )}
                </div>

                <div className="fila-campos fila-dos">
                    <div className="campo">
                        <label htmlFor="compra-cantidad">Cantidad que llegó</label>
                        <input id="compra-cantidad" type="number" min="1" step="1" inputMode="numeric" value={cantidad}
                            onChange={(e) => setCantidad(e.target.value)} required />
                        <div className="selector-modalidad selector-pequeno" role="radiogroup" aria-label="Cantidad en">
                            <button type="button" role="radio" aria-checked={!enCajas} className={!enCajas ? "activo" : ""} onClick={() => setEnCajas(false)}>Unidades</button>
                            <button type="button" role="radio" aria-checked={enCajas} className={enCajas ? "activo" : ""} onClick={() => setEnCajas(true)}>
                                Cajas{producto ? ` (${porCaja} u.)` : ""}
                            </button>
                        </div>
                    </div>

                    <div className="campo">
                        <label htmlFor="compra-costo">{costoPorUnidad ? "Costo por unidad (S/)" : "Costo total (S/)"}</label>
                        <input id="compra-costo" type="number" min="0" step="0.01" inputMode="decimal" value={costo}
                            onChange={(e) => setCosto(e.target.value)} required />
                        <button type="button" className="boton-enlace" onClick={() => setCostoPorUnidad((v) => !v)}>
                            {costoPorUnidad ? "Escribir el costo total" : "Escribir el costo por unidad"}
                        </button>
                    </div>
                </div>

                <div className="fila-campos fila-dos">
                    <div className="campo">
                        <label htmlFor="compra-proveedor">Proveedor (opcional)</label>
                        <input id="compra-proveedor" maxLength={120} placeholder="Ej. Mercado Central" value={proveedor}
                            onChange={(e) => setProveedor(e.target.value)} />
                    </div>
                    <div className="campo">
                        <label htmlFor="compra-fecha">Fecha</label>
                        <input id="compra-fecha" type="date" max={hoy()} value={fecha} onChange={(e) => setFecha(e.target.value)} required />
                    </div>
                </div>

                <fieldset className="grupo-campos">
                    <legend>¿Cómo se cuenta este dinero?</legend>
                    {[
                        { valor: "inversion", texto: "💼 Inversión", ayuda: "Mercadería nueva para vender: se recupera con las ventas." },
                        { valor: "gasto", texto: "💸 Gasto (Mercadería)", ayuda: "Se resta de la ganancia neta del día de la compra." },
                        { valor: "ninguno", texto: "No registrar dinero", ayuda: "Solo suma el stock (por ejemplo, si ya lo anotaste)." }
                    ].map((op) => (
                        <label key={op.valor} className="opcion-radio">
                            <input type="radio" name="contabilizar" value={op.valor} checked={contabilizar === op.valor}
                                onChange={() => setContabilizar(op.valor)} />
                            <span><strong>{op.texto}</strong><small>{op.ayuda}</small></span>
                        </label>
                    ))}
                </fieldset>

                {producto && unidades > 0 && (
                    <p className="costo-calculado">
                        Llegan <strong>{unidades} u.</strong> · Costo total <strong>{moneda(costoTotal)}</strong> ·{" "}
                        {moneda(costoUnitario)} c/u → stock nuevo: <strong>{producto.stock + unidades} u.</strong>
                    </p>
                )}

                {error && <p className="mensaje mensaje-error" role="alert">{error}</p>}

                <div className="modal-acciones">
                    <button type="button" className="boton-secundario" onClick={onCerrar}>Cancelar</button>
                    <button type="submit" className="boton-principal" disabled={enviando}>
                        {enviando ? "Guardando..." : "Ingresar mercadería"}
                    </button>
                </div>
            </form>
        </dialog>
    );
}
