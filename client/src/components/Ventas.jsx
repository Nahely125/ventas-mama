import { useEffect, useRef, useState } from "react";
import { moneda, pedir } from "../api.js";
import { METODOS_PAGO } from "../venta.js";
import BuscadorProducto from "./BuscadorProducto.jsx";
import Comprobante from "./Comprobante.jsx";
import DatosPago from "./DatosPago.jsx";
import DictadoVenta from "./DictadoVenta.jsx";
import SelectorCliente from "./SelectorCliente.jsx";

function precioDeLista(producto, modalidad) {
    if (!producto) return "";
    const precio = modalidad === "docena" ? producto.precioDocena : producto.precio;
    return Number(precio).toFixed(2);
}

function minimoDe(producto, modalidad) {
    return Number(modalidad === "docena" ? producto.precioMinimoDocena : producto.precioMinimo);
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
                            {moneda(minimoDe(item.producto, item.modalidad))} por {item.modalidad})
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

    const buscarActual = (id) => (productos ?? []).find((p) => p.id === id);

    // Usar siempre los datos más recientes del producto (por ejemplo, el stock).
    const productoActual = producto ? buscarActual(producto.id) ?? producto : null;

    const esDocena = modalidad === "docena";
    const cantidadNumero = Number(cantidad);
    const cantidadValida = Number.isInteger(cantidadNumero) && cantidadNumero > 0 ? cantidadNumero : 0;
    const precioNumero = Number(precio);
    const precioValido = precio !== "" && Number.isFinite(precioNumero) && precioNumero > 0 ? precioNumero : 0;
    const lista = precioDeLista(productoActual, modalidad);
    const minimo = productoActual ? minimoDe(productoActual, modalidad) : null;
    // El precio mínimo solo limita a los empleados; el jefe vende al precio que quiera.
    const bajoMinimo = !esJefe && minimo !== null && precioValido > 0 && centimos(precioValido) < centimos(minimo);

    // Unidades ya puestas en el carrito por producto (para avisar del stock).
    const unidadesEnCarrito = (id) =>
        carrito
            .filter((item) => item.producto.id === id)
            .reduce((suma, item) => suma + item.cantidad * (item.modalidad === "docena" ? 12 : 1), 0);

    const total = carrito.reduce((suma, item) => suma + item.precio * item.cantidad, 0);
    const itemsBajoMinimo = carrito.filter(
        (item) => centimos(item.precio) < centimos(minimoDe(item.producto, item.modalidad))
    );

    function seleccionarProducto(nuevo) {
        setProducto(nuevo);
        setPrecio(precioDeLista(nuevo, modalidad));
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

        if (cantidadValida === 0 || precioValido === 0) {
            setErrorItem("Ingresa una cantidad y un precio válidos.");
            return;
        }

        const unidades = cantidadValida * (esDocena ? 12 : 1);
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
                precio: Number(precioValido.toFixed(2))
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
            const unidades = linea.cantidad * (linea.modalidad === "docena" ? 12 : 1);
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
                precio: Number(Number(precioDeLista(actual, linea.modalidad)).toFixed(2))
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
                        modalidad: item.modalidad,
                        precio: item.precio
                    })),
                    metodoPago,
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
                                            value={cantidad}
                                            onChange={(e) => setCantidad(e.target.value)}
                                        />
                                        {esDocena && cantidadValida > 0 && (
                                            <span className="ayuda-campo">= {cantidadValida * 12} unidades</span>
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
                                            {" "}· Mínimo: {moneda(minimo)}
                                            {bajoMinimo && (
                                                <><br />🔒 Bajo el mínimo: necesitará la contraseña del jefe.</>
                                            )}
                                        </span>
                                    </div>
                                </div>

                                <button type="button" className="boton-agregar" onClick={agregar}>
                                    ＋ Agregar a la venta
                                    {cantidadValida > 0 && precioValido > 0 && <> · {moneda(precioValido * cantidadValida)}</>}
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
                                    const bajo = centimos(item.precio) < centimos(minimoDe(item.producto, item.modalidad));

                                    return (
                                        <li key={item.clave} className="item-carrito">
                                            <div className="item-carrito-datos">
                                                <strong>{item.producto.nombre}</strong>
                                                <span>
                                                    {item.cantidad} {item.modalidad === "docena"
                                                        ? (item.cantidad === 1 ? "docena" : "docenas")
                                                        : (item.cantidad === 1 ? "unidad" : "unidades")}{" "}
                                                    × {moneda(item.precio)}
                                                    {bajo && !esJefe && <span className="etiqueta etiqueta-ajustado">🔒 Bajo mínimo</span>}
                                                </span>
                                            </div>
                                            <strong className="item-carrito-total">{moneda(item.precio * item.cantidad)}</strong>
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
