import { moneda } from "../api.js";
import { urlFoto } from "../fotos.js";

export default function TarjetaProducto({ producto, esJefe, retraso, onEditar, onEliminar, onIngresar }) {
    const precio = Number(producto.precio);
    const stockBajo = producto.stock <= 5;

    let detallesJefe = null;

    if (esJefe) {
        const unidadesPorCaja = Number(producto.unidadesPorCaja ?? 1);
        const costoUnitario = Number(producto.precioCompra);
        const gananciaUnidad = precio - costoUnitario;

        detallesJefe = (
            <>
                <dl className="detalles-producto detalles-jefe">
                    {producto.stock2025 > 0 && (
                        <div className="dato-2025">
                            <dt>📦 Del inventario 2025</dt>
                            <dd>{producto.stock2025} de {producto.stock} u.</dd>
                        </div>
                    )}
                    <div>
                        <dt>Costo por caja</dt>
                        <dd>{moneda(costoUnitario * unidadesPorCaja)}</dd>
                    </div>
                    <div>
                        <dt>Costo por unidad</dt>
                        <dd>
                            {moneda(costoUnitario)}{" "}
                            <small>({unidadesPorCaja} por caja)</small>
                        </dd>
                    </div>
                    <div>
                        <dt>Ganancia por unidad</dt>
                        <dd>{moneda(gananciaUnidad)}</dd>
                    </div>
                    <div>
                        <dt>Ganancia por caja</dt>
                        <dd>{moneda(gananciaUnidad * unidadesPorCaja)}</dd>
                    </div>
                </dl>

                <button type="button" className="boton-ingresar" onClick={onIngresar}>
                    🚚 Ingresar mercadería
                </button>

                <div className="acciones-producto">
                    <button type="button" className="boton-editar" onClick={onEditar}>
                        Editar
                    </button>
                    <button type="button" className="boton-eliminar" onClick={onEliminar}>
                        Eliminar
                    </button>
                </div>
            </>
        );
    }

    return (
        <article className="producto" style={{ animationDelay: `${retraso}ms` }}>
            {urlFoto(producto) && (
                <img className="foto-producto" src={urlFoto(producto)} alt={producto.nombre} loading="lazy" />
            )}
            <span className={`codigo-producto ${producto.codigo ? "" : "sin-codigo"}`}>
                {producto.codigo || "Sin código"}
            </span>
            <h3>{producto.nombre}</h3>

            <div className="precios-producto">
                <div>
                    <span>Unidad</span>
                    <strong>{moneda(precio)}</strong>
                </div>
                <div>
                    <span>Docena</span>
                    <strong>{moneda(producto.precioDocena)}</strong>
                </div>
            </div>

            <dl className="detalles-producto">
                <div>
                    <dt>Precio mínimo por unidad</dt>
                    <dd>{moneda(producto.precioMinimo)}</dd>
                </div>
                <div>
                    <dt>Precio mínimo por docena</dt>
                    <dd>{moneda(producto.precioMinimoDocena)}</dd>
                </div>
                <div>
                    <dt>Stock disponible</dt>
                    <dd className={stockBajo ? "stock-bajo" : undefined}>
                        {producto.stock} unidades
                    </dd>
                </div>
            </dl>

            {detallesJefe}
        </article>
    );
}
