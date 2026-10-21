import { useEffect, useRef, useState } from "react";
import { moneda, pedir } from "../api.js";
import { METODOS_PAGO, UNIDADES_MODALIDAD, nombreModalidad } from "../venta.js";
import BuscadorProducto from "./BuscadorProducto.jsx";
import Comprobante from "./Comprobante.jsx";
import DatosPago from "./DatosPago.jsx";
import DictadoVenta from "./DictadoVenta.jsx";
import SelectorCliente from "./SelectorCliente.jsx";

const unidadesDe = (modalidad) => UNIDADES_MODALIDAD[modalidad] ?? 1;
// Docena y media docena: se escribe el precio por unidad y se calcula el del paquete.
const esPaquete = (modalidad) => modalidad === "docena" || modalidad === "media";

// Precio de lista del paquete: unidad, media docena (mitad de la docena), docena o gratis (obsequio).
function precioPaquete(producto, modalidad) {
    if (modalidad === "obsequio") return 0;
    if (modalidad === "docena") return Number(producto.precioDocena);
    if (modalidad === "media") return Number((Number(producto.precioDocena) / 2).toFixed(2));
    return Number(producto.precio);
}

// Mínimo del paquete (el que valida el servidor): la media docena tiene la mitad del de la docena.
function minimoDe(producto, modalidad) {
    if (modalidad === "obsequio") return 0;
    if (modalidad === "docena") return Number(producto.precioMinimoDocena);
    if (modalidad === "media") return Number((Number(producto.precioMinimoDocena) / 2).toFixed(2));
    return Number(producto.precioMinimo);
}

// Lo que se escribe en el formulario: siempre el precio por unidad.
function precioDeLista(producto, modalidad) {
    if (!producto) return "";
    return (precioPaquete(producto, modalidad) / unidadesDe(modalidad)).toFixed(2);
}

function centimos(valor) {
    return Math.round(Number(valor) * 100);
}

let siguienteClave = 1;

// Ventana para que el jefe escriba su contraseña y autorice precios bajo el mínimo.
function ModalAutorizacion({ productos, error, enviando, onConfirmar, onCerrar }) {
    const dialogo = useRef(null);
    const [password, setPassword] = useState("");

    useEffect(() => {
        dialogo.current?.showModal();
    }, []);

    return (
        <dialog ref={dialogo} className="modal" onClose={onCerrar} aria-labelledby="titulo-autorizacion">
            <form
                className="formulario modal-contenido"
                onSubmit={(e) => {
                    e.preventDefault();
                    onConfirmar(password);
                }}
            >
                <div className="modal-encabezado">
                    <h2 id="titulo-autorizacion">🔒 Autorización del jefe</h2>
                    <button type="button" className="boton-cerrar-modal" onClick={onCerrar} aria-label="Cerrar">
                        ✕
                    </button>
                </div>

                <p>Estos productos tienen un precio por debajo del mínimo:</p>
                <ul className="lista-bajo-minimo">
                    {productos.map((item) => (
                        <li key={item.clave}>
                            <strong>{item.producto.nombre}</strong>: {moneda(item.precio)} (mínimo{" "}
                            {moneda(minimoDe(item.producto, item.modalidad))} por {nombreModalidad(item.modalidad)})
                        </li>
                    ))}
                </ul>

                <div className="campo">
                    <label htmlFor="password-jefe">Contraseña del jefe</label>
                    <input
                        type="password"
                        id="password-jefe"
                        autoComplete="off"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        autoFocus
                        required
                    />
                    <span className="ayuda-campo">El jefe la escribe en este celular para aprobar el precio.</span>
                </div>

                {error && <p className="mensaje mensaje-error" role="alert">{error}</p>}

                <div className="modal-acciones">
                    <button type="button" className="boton-secundario" onClick={onCerrar}>
                        Cancelar
                    </button>
                    <button type="submit" className="boton-principal" disabled={enviando || !password}>
                        {enviando ? "Verificando..." : "Autorizar y registrar"}
                    </button>
                </div>
            </form>
        </dialog>
    );
}

export default function Ventas({ esJefe, productos, onVenta, onIrAHistorial, onError }) {
    // Producto que se está agregando
    const [producto, setProducto] = useState(null);
    const [modalidad, setModalidad] = useState("unidad");
    const [cantidad, setCantidad] = useState("1");
    const [precio, setPrecio] = useState("");
    const [errorItem, setErrorItem] = useState("");

    // Carrito y cobro
    const [carrito, setCarrito] = useState([]);
    const [metodoPago, setMetodoPago] = useState("efectivo");
    const [cliente, setCliente] = useState(null);
    const [mensaje, setMensaje] = useState(null);
    const [enviando, setEnviando] = useState(false);
    const [autorizacion, setAutorizacion] = useState(null); // { error }
    const [comprobante, setComprobante] = useState(null);
    const [dictando, setDictando] = useState(false);

    // Ajuste (descuento) con un código que registró el jefe; el jefe también puede ajustar sin código.
    const [codigoAjuste, setCodigoAjuste] = useState("");
    const [ajuste, setAjuste] = useState(null); // { codigo, monto, libre } (monto null = se escribe)
    const [montoPropio, setMontoPropio] = useState("");
    const [errorAjuste, setErrorAjuste] = useState("");
    const [validandoAjuste, setValidandoAjuste] = useState(false);

    const buscarActual = (id) => (productos ?? []).find((p) => p.id === id);

    // Usar siempre los datos más recientes del producto (por ejemplo, el stock).
    const productoActual = producto ? buscarActual(producto.id) ?? producto : null;

    const porUnidades = unidadesDe(modalidad);
    const esDePaquete = esPaquete(modalidad);
    const esObsequio = modalidad === "obsequio";
    // El empleado solo puede regalar productos de menos de S/ 5; el jefe, cualquiera.
    const puedeObsequiar = (p) => Boolean(p && (esJefe || p.obsequiable));
    const cantidadNumero = Number(cantidad);
    const cantidadValida = Number.isInteger(cantidadNumero) && cantidadNumero > 0 ? cantidadNumero : 0;
    const precioNumero = Number(precio);
    const precioValido = precio !== "" && Number.isFinite(precioNumero) && precioNumero > 0 ? precioNumero : 0;
    const lista = precioDeLista(productoActual, modalidad);
    const minimoPaquete = productoActual ? minimoDe(productoActual, modalidad) : null;
    const minimo = minimoPaquete === null ? null : minimoPaquete / porUnidades;
    // Precio del paquete: precio por unidad × unidades (al precio de lista, exactamente el registrado).
    const precioDelPaquete = !productoActual || esObsequio
        ? 0
        : precio === lista
            ? precioPaquete(productoActual, modalidad)
            : Number((precioValido * porUnidades).toFixed(2));
    // El precio mínimo solo limita a los empleados; el jefe vende al precio que quiera.
    const bajoMinimo = !esJefe && !esObsequio && minimoPaquete !== null && precioValido > 0
        && centimos(precioDelPaquete) < centimos(minimoPaquete);

    // Unidades ya puestas en el carrito por producto (para avisar del stock).
    const unidadesEnCarrito = (id) =>
        carrito
            .filter((item) => item.producto.id === id)
            .reduce((suma, item) => suma + item.cantidad * unidadesDe(item.modalidad), 0);

    const subtotal = carrito.reduce((suma, item) => suma + item.precio * item.cantidad, 0);
    const montoAjuste = ajuste
        ? (ajuste.monto ?? (Number(montoPropio) > 0 ? Number(Number(montoPropio).toFixed(2)) : 0))
        : 0;
    const ajusteExcede = centimos(montoAjuste) > centimos(subtotal);
    const total = Math.max(subtotal - montoAjuste, 0);
    const estaBajoMinimo = (item) =>
        item.modalidad !== "obsequio" && centimos(item.precio) < centimos(minimoDe(item.producto, item.modalidad));
    const itemsBajoMinimo = esJefe ? [] : carrito.filter(estaBajoMinimo);

    function seleccionarProducto(nuevo) {
        const nuevaModalidad = modalidad === "obsequio" && !puedeObsequiar(nuevo) ? "unidad" : modalidad;
        setProducto(nuevo);
        setModalidad(nuevaModalidad);
        setPrecio(precioDeLista(nuevo, nuevaModalidad));
        setCantidad("1");
        setErrorItem("");
    }

    function cambiarModalidad(nueva) {
        setModalidad(nueva);
        setPrecio(precioDeLista(productoActual, nueva));
    }

    function agregar() {
        if (!productoActual) {
            setErrorItem("Busca y selecciona un producto.");
            return;
        }

        if (cantidadValida === 0 || (!esObsequio && precioValido === 0)) {
            setErrorItem("Ingresa una cantidad y un precio válidos.");
            return;
        }

        const unidades = cantidadValida * unidadesDe(modalidad);
        const disponibles = productoActual.stock - unidadesEnCarrito(productoActual.id);

        if (unidades > disponibles) {
            setErrorItem(`Stock insuficiente. Quedan ${Math.max(disponibles, 0)} unidades disponibles.`);
            return;
        }

        setCarrito((anterior) => [
            ...anterior,
            {
                clave: siguienteClave++,
                producto: productoActual,
                modalidad,
                cantidad: cantidadValida,
                precio: precioDelPaquete
            }
        ]);
        setProducto(null);
        setModalidad("unidad");
        setCantidad("1");
        setPrecio("");
        setErrorItem("");
        setMensaje(null);
    }

    // Agrega al carrito lo dictado por voz, al precio de lista y revisando el stock.
    function agregarDictados(lineas) {
        const nuevos = [];
        const avisos = [];
        const usadas = new Map();

        for (const linea of lineas) {
            const actual = buscarActual(linea.producto.id) ?? linea.producto;
            const unidades = linea.cantidad * unidadesDe(linea.modalidad);
            const yaUsadas = unidadesEnCarrito(actual.id) + (usadas.get(actual.id) ?? 0);

            if (unidades > actual.stock - yaUsadas) {
                avisos.push(`${actual.nombre} (quedan ${Math.max(actual.stock - yaUsadas, 0)} u.)`);
                continue;
            }

            usadas.set(actual.id, (usadas.get(actual.id) ?? 0) + unidades);
            nuevos.push({
                clave: siguienteClave++,
                producto: actual,
                modalidad: linea.modalidad,
                cantidad: linea.cantidad,
                precio: precioPaquete(actual, linea.modalidad)
            });
        }

        setCarrito((anterior) => [...anterior, ...nuevos]);
        setDictando(false);
        setMensaje(
            avisos.length
                ? { tipo: "error", texto: `Se agregaron ${nuevos.length}. Sin stock suficiente: ${avisos.join(", ")}.` }
                : { tipo: "info", texto: `🎤 Se agregaron ${nuevos.length} ${nuevos.length === 1 ? "producto" : "productos"} a la venta.` }
        );
    }

    async function aplicarAjuste() {
        if (!codigoAjuste.trim()) {
            setErrorAjuste("Escribe el código que te dio el jefe.");
            return;
        }

        setValidandoAjuste(true);

        try {
            const resultado = await pedir("/api/ventas/validar-ajuste", {
                method: "POST",
                cuerpo: { codigo: codigoAjuste }
            });
            setAjuste(resultado);
            setMontoPropio("");
            setErrorAjuste("");
        } catch (error) {
            onError(error, () => setErrorAjuste(error.message));
        } finally {
            setValidandoAjuste(false);
        }
    }

    // Ajuste directo del jefe: escribe el monto que quiera, sin código.
    function ajusteDelJefe() {
        setAjuste({ codigo: "Descuento del jefe", monto: null, libre: true });
        setMontoPropio("");
        setErrorAjuste("");
    }

    function quitarAjuste() {
        setAjuste(null);
        setCodigoAjuste("");
        setMontoPropio("");
        setErrorAjuste("");
    }

    function quitar(clave) {
        setCarrito((anterior) => anterior.filter((item) => item.clave !== clave));
    }

    async function registrar(passwordJefe) {
        setEnviando(true);

        try {
            const resultado = await pedir("/api/ventas", {
                method: "POST",
                cuerpo: {
                    items: carrito.map((item) => ({
                        productoId: item.producto.id,
                        cantidad: item.cantidad,
                        modalidad: item.modalidad === "obsequio" ? "unidad" : item.modalidad,
                        precio: item.precio,
                        ...(item.modalidad === "obsequio" ? { obsequio: true } : {})
                    })),
                    metodoPago,
                    ajuste: ajuste
                        ? (ajuste.libre ? { libre: true, monto: montoAjuste } : { codigo: ajuste.codigo, monto: montoAjuste })
                        : null,
                    clienteId: cliente?.id ?? null,
                    ...(passwordJefe ? { passwordJefe } : {})
                }
            });

            setAutorizacion(null);
            setMensaje({
                tipo: "exito",
                texto: `${resultado.mensaje} ${resultado.boleta.items.length} ${resultado.boleta.items.length === 1 ? "producto" : "productos"} · Total: ${moneda(resultado.boleta.total)}.`
            });
            setComprobante(resultado.boleta);
            setCarrito([]);
            quitarAjuste();
            setMetodoPago("efectivo");
            setCliente(null);
            await onVenta();
        } catch (error) {
            onError(error, () => {
                if (error.estado === 403 || error.estado === 429) {
                    setAutorizacion({ error: passwordJefe ? error.message : "" });
                } else {
                    setAutorizacion(null);
                    setMensaje({ tipo: "error", texto: error.message });
                }
            });
        } finally {
            setEnviando(false);
        }
    }

    function cobrar(evento) {
        evento.preventDefault();

        if (metodoPago === "fiado" && !cliente) {
            setMensaje({ tipo: "error", texto: "Para vender fiado, elige o registra al cliente." });
            return;
        }

        if (carrito.length === 0) {
            setMensaje({ tipo: "error", texto: "Agrega al menos un producto a la venta." });
            return;
        }

        if (ajuste && (montoAjuste <= 0 || ajusteExcede)) {
            setErrorAjuste(ajusteExcede
                ? "El descuento no puede ser mayor que el total."
                : "Escribe el monto del descuento.");
            return;
        }

        setMensaje(null);

        // Un trabajador necesita la contraseña del jefe para precios bajo el mínimo.
        if (itemsBajoMinimo.length > 0 && !esJefe) {
            setAutorizacion({ error: "" });
            return;
        }

        registrar();
    }

    return (
        <div className="contenido-vista vista-ventas">
            <section className="tarjeta formulario-venta">
                <h2>Registrar una venta</h2>

                <form onSubmit={cobrar} className="formulario">
                    <fieldset className="grupo-campos agregar-producto">
                        <legend>Agregar producto</legend>

                        <button type="button" className="boton-dictar" onClick={() => setDictando(true)}>
                            🎤 Dictar productos por voz
                        </button>

                        <div className="campo">
                            <label htmlFor="buscar-producto-venta">Producto (código o nombre)</label>
                            <BuscadorProducto
                                productos={productos}
                                seleccionado={productoActual}
                                onSeleccionar={seleccionarProducto}
                            />
                        </div>

                        {productoActual && (
                            <>
                                <div className="campo">
                                    <span className="etiqueta-campo" id="etiqueta-modalidad">Vender por</span>
                                    <div className="selector-modalidad" role="radiogroup" aria-labelledby="etiqueta-modalidad">
                                        {[
                                            { valor: "unidad", texto: "Unidad" },
                                            { valor: "media", texto: "Media docena (6 u.)" },
                                            { valor: "docena", texto: "Docena (12 u.)" },
                                            puedeObsequiar(productoActual) && { valor: "obsequio", texto: "🎁 Obsequio" }
                                        ].filter(Boolean).map((opcion) => (
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
                                            Cantidad ({nombreModalidad(modalidad, 2)})
                                        </label>
                                        <input
                                            type="number"
                                            id="cantidad-venta"
                                            min="1"
                                            step="1"
                                            inputMode="numeric"
                                            value={cantidad}
                                            onChange={(e) => setCantidad(e.target.value)}
                                        />
                                        {esDePaquete && cantidadValida > 0 && (
                                            <span className="ayuda-campo">= {cantidadValida * porUnidades} unidades</span>
                                        )}
                                    </div>

                                    {esObsequio ? (
                                        <div className="campo aviso-obsequio">
                                            <span className="etiqueta-campo">Precio</span>
                                            <p>
                                                {esJefe ? (
                                                    <>🎁 <strong>Gratis.</strong> Se descuenta del stock y su costo cuenta como gasto en la ganancia.</>
                                                ) : (
                                                    <>🎁 <strong>Gratis.</strong> Este producto se puede regalar: el obsequio debe valer menos de <strong>S/ 5</strong>.</>
                                                )}
                                            </p>
                                        </div>
                                    ) : (
                                        <div className="campo">
                                            <label htmlFor="precio-venta">
                                                {esDePaquete ? `Precio por unidad en la ${nombreModalidad(modalidad)}` : "Precio por unidad"} (S/)
                                            </label>
                                            <input
                                                type="number"
                                                id="precio-venta"
                                                min="0.01"
                                                step="0.01"
                                                inputMode="decimal"
                                                value={precio}
                                                onChange={(e) => setPrecio(e.target.value)}
                                                aria-invalid={bajoMinimo}
                                            />
                                            <span className={`ayuda-campo ${bajoMinimo ? "texto-aviso" : ""}`}>
                                                Lista: {moneda(lista)}
                                                {precio !== lista && (
                                                    <>
                                                        {" "}
                                                        <button type="button" className="boton-enlace" onClick={() => setPrecio(lista)}>
                                                            Restaurar
                                                        </button>
                                                    </>
                                                )}
                                                {!esJefe && (
                                                    <>{" "}· Mínimo: <strong>{moneda(minimo)}</strong>{esDePaquete && " c/u"}</>
                                                )}
                                                {esDePaquete && precioValido > 0 && (
                                                    <>
                                                        <br />
                                                        La {nombreModalidad(modalidad)} sale a <strong>{moneda(precioDelPaquete)}</strong>{" "}
                                                        ({moneda(precioValido)} × {porUnidades})
                                                        {!esJefe && <> · mínimo {moneda(minimoPaquete)}</>}
                                                    </>
                                                )}
                                                {bajoMinimo && (
                                                    <><br />🔒 Bajo el mínimo: necesitará la contraseña del jefe.</>
                                                )}
                                            </span>
                                        </div>
                                    )}
                                </div>

                                <button type="button" className="boton-agregar" onClick={agregar}>
                                    ＋ Agregar a la venta
                                    {cantidadValida > 0 && (esObsequio ? <> · Gratis</> : precioValido > 0 && <> · {moneda(precioDelPaquete * cantidadValida)}</>)}
                                </button>
                            </>
                        )}

                        {errorItem && <p className="mensaje mensaje-error" role="alert">{errorItem}</p>}
                    </fieldset>

                    <div className="resumen-venta carrito">
                        <h3>
                            🛒 Productos de la venta
                            <span className="contador-carrito">{carrito.length}</span>
                        </h3>

                        {carrito.length === 0 ? (
                            <p className="carrito-vacio">Busca un producto y toca «Agregar a la venta». Puedes agregar varios.</p>
                        ) : (
                            <ul className="lista-carrito">
                                {carrito.map((item) => {
                                    const bajo = estaBajoMinimo(item);

                                    return (
                                        <li key={item.clave} className="item-carrito">
                                            <div className="item-carrito-datos">
                                                <strong>{item.producto.nombre}</strong>
                                                <span>
                                                    {item.cantidad} {nombreModalidad(item.modalidad, item.cantidad)}{" "}
                                                    {item.modalidad === "obsequio" ? (
                                                        <span className="etiqueta etiqueta-obsequio">🎁 Obsequio</span>
                                                    ) : (
                                                        <>× {moneda(item.precio)}</>
                                                    )}
                                                    {esPaquete(item.modalidad) && (
                                                        <small> ({moneda(item.precio / unidadesDe(item.modalidad))} c/u)</small>
                                                    )}
                                                    {bajo && !esJefe && <span className="etiqueta etiqueta-ajustado">🔒 Bajo mínimo</span>}
                                                </span>
                                            </div>
                                            <strong className="item-carrito-total">
                                                {item.modalidad === "obsequio" ? "Gratis" : moneda(item.precio * item.cantidad)}
                                            </strong>
                                            <button
                                                type="button"
                                                className="boton-icono"
                                                onClick={() => quitar(item.clave)}
                                                aria-label={`Quitar ${item.producto.nombre}`}
                                                title="Quitar"
                                            >
                                                ✕
                                            </button>
                                        </li>
                                    );
                                })}
                            </ul>
                        )}

                        {carrito.length > 0 && (
                            <div className="ajuste-venta">
                                {!ajuste ? (
                                    <div className="campo">
                                        <label htmlFor="codigo-ajuste">🏷️ Código de descuento (opcional)</label>
                                        <div className="campo-con-boton">
                                            <input
                                                type="text"
                                                id="codigo-ajuste"
                                                autoCapitalize="characters"
                                                autoComplete="off"
                                                spellCheck={false}
                                                maxLength={20}
                                                value={codigoAjuste}
                                                onChange={(e) => setCodigoAjuste(e.target.value)}
                                                onKeyDown={(e) => {
                                                    if (e.key === "Enter") {
                                                        e.preventDefault();
                                                        aplicarAjuste();
                                                    }
                                                }}
                                            />
                                            <button
                                                type="button"
                                                className="boton-secundario boton-pequeno"
                                                onClick={aplicarAjuste}
                                                disabled={validandoAjuste}
                                            >
                                                {validandoAjuste ? "..." : "Aplicar"}
                                            </button>
                                        </div>
                                        <span className="ayuda-campo">
                                            {esJefe ? (
                                                <>
                                                    Usa un código o{" "}
                                                    <button type="button" className="boton-enlace" onClick={ajusteDelJefe}>
                                                        haz un descuento sin código
                                                    </button>
                                                    .
                                                </>
                                            ) : (
                                                "El jefe te da el código para descontar del total."
                                            )}
                                        </span>
                                    </div>
                                ) : (
                                    <div className="ajuste-aplicado">
                                        <div className="ajuste-encabezado">
                                            <span>🏷️ <strong>{ajuste.codigo}</strong></span>
                                            <button type="button" className="boton-enlace" onClick={quitarAjuste}>
                                                Quitar
                                            </button>
                                        </div>
                                        {ajuste.monto === null && (
                                            <div className="campo">
                                                <label htmlFor="monto-ajuste">Monto del descuento (S/)</label>
                                                <input
                                                    type="number"
                                                    id="monto-ajuste"
                                                    min="0.01"
                                                    step="0.01"
                                                    inputMode="decimal"
                                                    placeholder="0.00"
                                                    value={montoPropio}
                                                    onChange={(e) => setMontoPropio(e.target.value)}
                                                    aria-invalid={ajusteExcede}
                                                />
                                            </div>
                                        )}
                                        <div className="linea-total">
                                            <span>Subtotal</span>
                                            <span>{moneda(subtotal)}</span>
                                        </div>
                                        <div className="linea-total linea-ajuste">
                                            <span>Descuento</span>
                                            <span>− {moneda(montoAjuste)}</span>
                                        </div>
                                    </div>
                                )}
                                {(errorAjuste || ajusteExcede) && (
                                    <p className="mensaje mensaje-error" role="alert">
                                        {ajusteExcede ? "El descuento no puede ser mayor que el total." : errorAjuste}
                                    </p>
                                )}
                            </div>
                        )}

                        <div className="total-venta">
                            <span>Total a cobrar</span>
                            <strong>{moneda(total)}</strong>
                        </div>
                    </div>

                    <div className="campo campo-cliente">
                        <span className="etiqueta-campo">👤 Cliente</span>
                        <SelectorCliente
                            cliente={cliente}
                            onElegir={setCliente}
                            obligatorio={metodoPago === "fiado" && !cliente}
                            onError={onError}
                        />
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

                    <button type="submit" className="boton-principal" disabled={enviando || carrito.length === 0}>
                        {enviando
                            ? "Registrando..."
                            : carrito.length === 0
                                ? "Registrar venta"
                                : `Registrar venta · ${moneda(total)}`}
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

            {dictando && (
                <DictadoVenta
                    productos={productos}
                    onAgregar={agregarDictados}
                    onCerrar={() => setDictando(false)}
                />
            )}

            {autorizacion && (
                <ModalAutorizacion
                    productos={itemsBajoMinimo}
                    error={autorizacion.error}
                    enviando={enviando}
                    onConfirmar={registrar}
                    onCerrar={() => setAutorizacion(null)}
                />
            )}

            {comprobante && (
                <Comprobante boleta={comprobante} onCerrar={() => setComprobante(null)} />
            )}
        </div>
    );
}
