import { moneda, monedaCosto } from "../api.js";
import { urlFoto } from "../fotos.js";

export default function TarjetaProducto({ producto, parte, esJefe, retraso, onEditar, onEliminar, onIngresar }) {
    const precio = Number(producto.precio);
    // Media docena: la mitad de la docena (igual que al vender), y su mínimo, la mitad del de la docena.
    const mediaDocena = Number((Number(producto.precioDocena) / 2).toFixed(2));
    const minimoMediaDocena = Number((Number(producto.precioMinimoDocena) / 2).toFixed(2));
    const stockBajo = producto.stock <= 5;
    // Si tiene mercadería nueva y del 2025, cada pestaña muestra su parte.
    const stock2025 = Number(producto.stock2025 ?? 0);
    const esMixto = stock2025 > 0 && producto.stock > stock2025;
    const stockParte = !esMixto ? producto.stock : parte === "2025" ? stock2025 : producto.stock - stock2025;

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
                        <dd>{monedaCosto(costoUnitario * unidadesPorCaja)}</dd>
                    </div>
                    <div>
                        <dt>Costo por unidad</dt>
                        <dd>
                            {monedaCosto(costoUnitario)}{" "}
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
                    <dt>Precio por unidad en la media docena</dt>
                    <dd>{moneda(mediaDocena / 6)}</dd>
                </div>
                <div>
                    <dt>Precio por media docena</dt>
                    <dd>{moneda(mediaDocena)}</dd>
                </div>
                <div>
                    <dt>Precio mínimo por media docena</dt>
                    <dd>{moneda(minimoMediaDocena)}</dd>
                </div>
                <div>
                    <dt>Stock disponible</dt>
                    <dd className={stockBajo ? "stock-bajo" : undefined}>
                        {stockParte} unidades
                        {esMixto && <small> (de {producto.stock} en total)</small>}
                    </dd>
                </div>
            </dl>

            {(producto.colores ?? []).length > 0 && (
                <ul className="colores-producto" aria-label="Stock por color">
                    {producto.colores.map((color) => (
                        <li key={color.id} className={color.stock === 0 ? "agotado" : color.stock <= 5 ? "bajo" : ""}>
                            {color.nombre} <strong>{color.stock}</strong>
                        </li>
                    ))}
                </ul>
            )}

            {detallesJefe}
        </article>
    );
}
