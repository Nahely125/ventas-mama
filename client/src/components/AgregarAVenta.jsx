import { useEffect, useRef, useState } from "react";
import { moneda } from "../api.js";
import { nombreModalidad } from "../venta.js";
import {
    MODALIDADES_VENTA, nuevaClave, precioPaquete, tieneColores, unidadesColorEnCarrito, unidadesDe, unidadesEnCarrito
} from "../ventaItems.js";
import { MiniFoto } from "./BuscadorProducto.jsx";
import CantidadesPorColor from "./CantidadesPorColor.jsx";

/* Ventana del inventario para poner un producto en la venta en curso, al precio de lista.
   Elige unidad / media docena / docena y la cantidad (por color si tiene colores).
   El precio, el descuento y el cobro se hacen después en «Registrar venta». */
export default function AgregarAVenta({ producto, carrito, onAgregar, onCerrar }) {
    const dialogo = useRef(null);
    const [modalidad, setModalidad] = useState("unidad");
    const [cantidad, setCantidad] = useState("1");
    const [cantidadesColor, setCantidadesColor] = useState({});
    const [error, setError] = useState("");

    useEffect(() => {
        dialogo.current?.showModal();
    }, []);

    const conColores = tieneColores(producto);
    const porUnidades = unidadesDe(modalidad);
    const precio = precioPaquete(producto, modalidad);
    const lineasColor = conColores
        ? producto.colores
            .map((color) => ({ color, cantidad: Number(cantidadesColor[color.id] || 0) }))
            .filter((linea) => linea.cantidad !== 0)
        : [];
    const cantidadNumero = Number(cantidad);
    const total = conColores
        ? lineasColor.reduce((suma, l) => suma + (Number.isInteger(l.cantidad) && l.cantidad > 0 ? l.cantidad : 0), 0)
        : Number.isInteger(cantidadNumero) && cantidadNumero > 0 ? cantidadNumero : 0;
    const disponibles = producto.stock - unidadesEnCarrito(carrito, producto.id);
    const maximoPaquetes = Math.max(Math.floor(disponibles / porUnidades), 0);
    const cantidadActual = Number(cantidad) || 0;

    function agregar(evento) {
        evento.preventDefault();

        if (conColores && lineasColor.some((l) => !Number.isInteger(l.cantidad) || l.cantidad < 0)) {
            setError("Las cantidades por color deben ser números enteros.");
            return;
        }

        if (total === 0) {
            setError(conColores ? "Escribe cuántas vas a vender de cada color." : "Escribe una cantidad válida.");
            return;
        }

        if (total * porUnidades > disponibles) {
            setError(`Stock insuficiente. Quedan ${Math.max(disponibles, 0)} unidades disponibles.`);
            return;
        }

        for (const { color, cantidad: deEste } of lineasColor) {
            const quedan = color.stock - unidadesColorEnCarrito(carrito, color.id);
            if (deEste * porUnidades > quedan) {
                setError(`Stock insuficiente de ${color.nombre}. Quedan ${Math.max(quedan, 0)} unidades.`);
                return;
            }
        }

        const lineas = conColores
            ? lineasColor.map(({ color, cantidad: deEste }) => ({ cantidad: deEste, color: { id: color.id, nombre: color.nombre } }))
            : [{ cantidad: total, color: null }];

        onAgregar(lineas.map((linea) => ({
            clave: nuevaClave(),
            producto,
            modalidad,
            cantidad: linea.cantidad,
            precio,
            color: linea.color
        })));
    }

    return (
        <dialog ref={dialogo} className="modal agregar-a-venta" onClose={onCerrar} aria-labelledby="titulo-agregar-venta">
            <form className="formulario modal-contenido" onSubmit={agregar}>
                <div className="modal-encabezado">
                    <h2 id="titulo-agregar-venta">🛒 Agregar a la venta</h2>
                    <button type="button" className="boton-cerrar-modal" onClick={onCerrar} aria-label="Cerrar">✕</button>
                </div>

                <div className="producto-seleccionado">
                    <MiniFoto producto={producto} className="mini-foto-grande" />
                    <div className="producto-seleccionado-datos">
                        {producto.codigo && <span className="codigo-producto">{producto.codigo}</span>}
                        <strong>{producto.nombre}</strong>
                        <span>
                            {moneda(producto.precio)} c/u · {moneda(producto.precioDocena)} docena · Disponibles: {Math.max(disponibles, 0)}
                        </span>
                    </div>
                </div>

                <div className="campo">
                    <span className="etiqueta-campo" id="etiqueta-modalidad-rapida">Vender por</span>
                    <div className="selector-modalidad" role="radiogroup" aria-labelledby="etiqueta-modalidad-rapida">
                        {MODALIDADES_VENTA.map((opcion) => (
                            <button
                                key={opcion.valor}
                                type="button"
                                role="radio"
                                aria-checked={modalidad === opcion.valor}
                                className={modalidad === opcion.valor ? "activo" : ""}
                                onClick={() => {
                                    setModalidad(opcion.valor);
                                    setError("");
                                }}
                            >
                                {opcion.texto}
                            </button>
                        ))}
                    </div>
                </div>

                {conColores ? (
                    <CantidadesPorColor
                        id="etiqueta-colores-rapida"
                        producto={producto}
                        cantidades={cantidadesColor}
                        porUnidades={porUnidades}
                        nombreUnidad={nombreModalidad(modalidad, 2)}
                        enCarrito={(id) => unidadesColorEnCarrito(carrito, id)}
                        onCambiar={(id, valor) => {
                            setCantidadesColor((anterior) => ({ ...anterior, [id]: valor }));
                            setError("");
                        }}
                    />
                ) : (
                    <div className="campo">
                        <label htmlFor="cantidad-rapida">Cantidad ({nombreModalidad(modalidad, 2)})</label>
                        <span className="contador-cantidad contador-grande">
                            <button
                                type="button"
                                onClick={() => setCantidad(String(Math.max(cantidadActual - 1, 1)))}
                                disabled={cantidadActual <= 1}
                                aria-label="Una menos"
                            >
                                −
                            </button>
                            <input
                                type="number"
                                id="cantidad-rapida"
                                min="1"
                                max={maximoPaquetes}
                                step="1"
                                inputMode="numeric"
                                value={cantidad}
                                onChange={(e) => {
                                    setCantidad(e.target.value);
                                    setError("");
                                }}
                            />
                            <button
                                type="button"
                                onClick={() => setCantidad(String(Math.min(cantidadActual + 1, maximoPaquetes)))}
                                disabled={cantidadActual >= maximoPaquetes}
                                aria-label="Una más"
                            >
                                +
                            </button>
                        </span>
                        {porUnidades > 1 && total > 0 && <span className="ayuda-campo">= {total * porUnidades} unidades</span>}
                    </div>
                )}

                <p className="ayuda-campo">
                    Va al precio de lista ({moneda(precio)} por {nombreModalidad(modalidad)}). Para venderlo a otro
                    precio, agrégalo desde «Registrar venta».
                </p>

                {error && <p className="mensaje mensaje-error" role="alert">{error}</p>}

                <div className="modal-acciones">
                    <button type="button" className="boton-secundario" onClick={onCerrar}>
                        Cancelar
                    </button>
                    <button type="submit" className="boton-principal" disabled={maximoPaquetes === 0}>
                        {maximoPaquetes === 0
                            ? "Sin stock disponible"
                            : `Agregar${total > 0 ? ` · ${moneda(precio * total)}` : ""}`}
                    </button>
                </div>
            </form>
        </dialog>
    );
}
