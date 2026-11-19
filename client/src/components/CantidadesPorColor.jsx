/* Cantidad para cada color (en la modalidad elegida: unidades, medias docenas o docenas).
   Muestra cuántas quedan de cada color (descontando lo que ya está en el carrito). */
export default function CantidadesPorColor({ producto, cantidades, porUnidades, nombreUnidad, enCarrito, onCambiar, id = "etiqueta-cantidad-colores" }) {
    return (
        <div className="campo">
            <span className="etiqueta-campo" id={id}>
                Cantidad por color ({nombreUnidad})
            </span>
            <ul className="cantidades-colores" aria-labelledby={id}>
                {producto.colores.map((color) => {
                    const quedan = Math.max(color.stock - enCarrito(color.id), 0);
                    const maximo = Math.floor(quedan / porUnidades);
                    const valor = cantidades[color.id] ?? "";
                    const numero = Number(valor) || 0;
                    const cambiar = (nuevo) => onCambiar(color.id, nuevo <= 0 ? "" : String(Math.min(nuevo, maximo)));

                    return (
                        <li key={color.id} className={`${numero > 0 ? "con-cantidad" : ""} ${maximo === 0 ? "agotado" : ""}`}>
                            <span className="cantidad-color-nombre">
                                <strong>{color.nombre}</strong>
                                <small>{quedan > 0 ? `quedan ${quedan} u.` : "agotado"}</small>
                            </span>
                            <span className="contador-cantidad">
                                <button
                                    type="button"
                                    onClick={() => cambiar(numero - 1)}
                                    disabled={numero <= 0}
                                    aria-label={`Una menos de ${color.nombre}`}
                                >
                                    −
                                </button>
                                <input
                                    type="number"
                                    min="0"
                                    max={maximo}
                                    step="1"
                                    inputMode="numeric"
                                    placeholder="0"
                                    value={valor}
                                    disabled={maximo === 0}
                                    onChange={(e) => onCambiar(color.id, e.target.value)}
                                    aria-label={`Cantidad de ${color.nombre}`}
                                />
                                <button
                                    type="button"
                                    onClick={() => cambiar(numero + 1)}
                                    disabled={numero >= maximo}
                                    aria-label={`Una más de ${color.nombre}`}
                                >
                                    +
                                </button>
                            </span>
                        </li>
                    );
                })}
            </ul>
        </div>
    );
}
