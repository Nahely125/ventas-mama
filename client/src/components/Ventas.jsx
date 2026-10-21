import { useState } from "react";
import { moneda, pedir } from "../api.js";
import { METODOS_PAGO } from "../venta.js";
import BuscadorProducto from "./BuscadorProducto.jsx";
import Comprobante from "./Comprobante.jsx";
import DatosPago from "./DatosPago.jsx";

function precioDeLista(producto, modalidad) {
    if (!producto) return "";
    const precio = modalidad === "docena" ? producto.precioDocena : producto.precio;
    return Number(precio).toFixed(2);
}

export default function Ventas({ esJefe, productos, onVenta, onIrAHistorial, onError }) {
    const [producto, setProducto] = useState(null);
    const [modalidad, setModalidad] = useState("unidad");
    const [cantidad, setCantidad] = useState("");
    const [precio, setPrecio] = useState("");
    const [metodoPago, setMetodoPago] = useState("efectivo");
    const [mensaje, setMensaje] = useState(null);
    const [enviando, setEnviando] = useState(false);
    const [comprobante, setComprobante] = useState(null);

    // Usar siempre los datos más recientes del producto (por ejemplo, el stock).
    const productoActual = producto
        ? (productos ?? []).find((p) => p.id === producto.id) ?? producto
        : null;

    const esDocena = modalidad === "docena";
    const unidadesPorPaquete = esDocena ? 12 : 1;
    const cantidadNumero = Number(cantidad);
    const cantidadValida = Number.isInteger(cantidadNumero) && cantidadNumero > 0 ? cantidadNumero : 0;
    const unidades = cantidadValida * unidadesPorPaquete;
    const precioNumero = Number(precio);
    const precioValido = precio !== "" && Number.isFinite(precioNumero) && precioNumero > 0 ? precioNumero : 0;
    const total = precioValido * cantidadValida;

    const lista = precioDeLista(productoActual, modalidad);
    const precioAjustado = productoActual && precio !== "" && Number(precio).toFixed(2) !== lista;
    // El mínimo se muestra a todos (jefe y empleados).
    const minimo = productoActual
        ? Number(productoActual.precioMinimo) * unidadesPorPaquete
        : null;
    const bajoMinimo = minimo !== null && precioValido > 0 && Math.round(precioValido * 100) < Math.round(minimo * 100);
    const stockInsuficiente = productoActual && unidades > productoActual.stock;

    function seleccionarProducto(nuevo) {
        setProducto(nuevo);
        setPrecio(precioDeLista(nuevo, modalidad));
        setMensaje(null);
    }

    function cambiarModalidad(nueva) {
        setModalidad(nueva);
        setPrecio(precioDeLista(productoActual, nueva));
    }

    function reiniciar() {
        setProducto(null);
        setModalidad("unidad");
        setCantidad("");
        setPrecio("");
        setMetodoPago("efectivo");
    }

    async function enviar(evento) {
        evento.preventDefault();

        if (!productoActual) {
            setMensaje({ tipo: "error", texto: "Busca y selecciona un producto." });
            return;
        }

        if (cantidadValida === 0) {
            setMensaje({ tipo: "error", texto: "Ingresa una cantidad válida." });
            return;
        }

        if (precioValido === 0) {
            setMensaje({ tipo: "error", texto: "Ingresa un precio válido." });
            return;
        }

        if (bajoMinimo) {
            setMensaje({
                tipo: "error",
                texto: `El precio no puede ser menor que el mínimo (${moneda(minimo)} por ${modalidad}).`
            });
            return;
        }

        if (stockInsuficiente) {
            setMensaje({
                tipo: "error",
                texto: `Stock insuficiente. Solo hay ${productoActual.stock} unidades disponibles.`
            });
            return;
        }

        setMensaje(null);
        setEnviando(true);

        try {
            const resultado = await pedir("/api/ventas", {
                method: "POST",
                cuerpo: {
                    productoId: productoActual.id,
                    cantidad: cantidadValida,
                    modalidad,
                    precio: Number(precioValido.toFixed(2)),
                    metodoPago
                }
            });

            setMensaje({
                tipo: "exito",
                texto: `${resultado.mensaje} Total: ${moneda(resultado.venta.total)}. Stock restante: ${resultado.stockRestante} unidades.`
            });
            setComprobante(resultado.venta);
            reiniciar();
            await onVenta();
        } catch (error) {
            onError(error, () => setMensaje({ tipo: "error", texto: error.message }));
        } finally {
            setEnviando(false);
        }
    }

    return (
        <div className="contenido-vista vista-ventas">
            <section className="tarjeta formulario-venta">
                <h2>Registrar una venta</h2>

                <form onSubmit={enviar} className="formulario">
                    <div className="datos-venta">
                        <div className="campo">
                            <label htmlFor="buscar-producto-venta">Producto (código o nombre)</label>
                            <BuscadorProducto
                                productos={productos}
                                seleccionado={productoActual}
                                onSeleccionar={seleccionarProducto}
                            />
                        </div>

                        <div className="campo">
                            <span className="etiqueta-campo" id="etiqueta-modalidad">Vender por</span>
                            <div className="selector-modalidad" role="radiogroup" aria-labelledby="etiqueta-modalidad">
                                {[
                                    { valor: "unidad", texto: "Unidad" },
                                    { valor: "docena", texto: "Docena (12 u.)" }
                                ].map((opcion) => (
                                    <button
                                        key={opcion.valor}
                                        type="button"
                                        role="radio"
                                        aria-checked={modalidad === opcion.valor}
                                        className={modalidad === opcion.valor ? "activo" : ""}
                                        onClick={() => cambiarModalidad(opcion.valor)}
                                    >
                                        {opcion.texto}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="fila-campos fila-cantidad-precio">
                            <div className="campo">
                                <label htmlFor="cantidad-venta">
                                    Cantidad ({esDocena ? "docenas" : "unidades"})
                                </label>
                                <input
                                    type="number"
                                    id="cantidad-venta"
                                    min="1"
                                    step="1"
                                    inputMode="numeric"
                                    placeholder="Ej. 2"
                                    value={cantidad}
                                    onChange={(e) => setCantidad(e.target.value)}
                                    required
                                />
                                {esDocena && cantidadValida > 0 && (
                                    <span className="ayuda-campo">= {unidades} unidades</span>
                                )}
                            </div>

                            <div className="campo">
                                <label htmlFor="precio-venta">
                                    Precio por {esDocena ? "docena" : "unidad"} (S/)
                                </label>
                                <input
                                    type="number"
                                    id="precio-venta"
                                    min="0.01"
                                    step="0.01"
                                    inputMode="decimal"
                                    placeholder="0.00"
                                    value={precio}
                                    onChange={(e) => setPrecio(e.target.value)}
                                    disabled={!productoActual}
                                    aria-invalid={bajoMinimo}
                                    required
                                />
                                {productoActual && (
                                    <span className={`ayuda-campo ${bajoMinimo ? "texto-error" : ""}`}>
                                        {precioAjustado ? (
                                            <>
                                                Precio de lista: {moneda(lista)}{" "}
                                                <button type="button" className="boton-enlace" onClick={() => setPrecio(lista)}>
                                                    Restaurar
                                                </button>
                                            </>
                                        ) : (
                                            "Puedes ajustar el precio si haces un descuento."
                                        )}
                                        {minimo !== null && <> · Mínimo: {moneda(minimo)}</>}
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="seccion-metodo-pago">
                        <h3>Método de pago</h3>
                        <p className="descripcion-pago">¿Cómo pagó el cliente?</p>

                        <div className="opciones-pago">
                            {METODOS_PAGO.map((metodo) => (
                                <label className="opcion-pago" key={metodo.valor}>
                                    <input
                                        type="radio"
                                        name="metodoPago"
                                        value={metodo.valor}
                                        checked={metodoPago === metodo.valor}
                                        onChange={() => setMetodoPago(metodo.valor)}
                                    />
                                    <span className="tarjeta-pago">
                                        <span className="icono-pago" aria-hidden="true">{metodo.icono}</span>
                                        <span>{metodo.nombre}</span>
                                    </span>
                                </label>
                            ))}
                        </div>

                        <DatosPago metodoPago={metodoPago} total={total} />
                    </div>

                    <div className="resumen-venta">
                        <h3>Resumen de la venta</h3>
                        <p>Producto: <strong>{productoActual ? productoActual.nombre : "—"}</strong></p>
                        <p>
                            Precio por {esDocena ? "docena" : "unidad"}:{" "}
                            <strong>
                                {moneda(precioValido)}
                                {precioAjustado && <span className="etiqueta etiqueta-ajustado">Ajustado</span>}
                            </strong>
                        </p>
                        <p>Stock disponible: <strong>{productoActual ? productoActual.stock : 0} unidades</strong></p>
                        <p>
                            Cantidad:{" "}
                            <strong>
                                {esDocena
                                    ? `${cantidadValida} docenas (${unidades} u.)`
                                    : `${cantidadValida} unidades`}
                            </strong>
                        </p>
                        <div className="total-venta">
                            <span>Total a cobrar</span>
                            <strong>
                                {moneda(total)}
                                {stockInsuficiente && <small className="aviso-stock"> (stock insuficiente)</small>}
                            </strong>
                        </div>
                    </div>

                    <button type="submit" className="boton-principal" disabled={enviando}>
                        {enviando ? "Registrando..." : "Registrar venta"}
                    </button>

                    {mensaje && (
                        <p className={`mensaje mensaje-${mensaje.tipo}`} role="status" aria-live="polite">
                            {mensaje.texto}{" "}
                            {mensaje.tipo === "exito" && (
                                <button type="button" className="boton-enlace" onClick={onIrAHistorial}>
                                    Ver historial
                                </button>
                            )}
                        </p>
                    )}
                </form>
            </section>

            {comprobante && (
                <Comprobante venta={comprobante} onCerrar={() => setComprobante(null)} />
            )}
        </div>
    );
}
