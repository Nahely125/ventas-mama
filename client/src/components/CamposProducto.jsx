import { porDocena } from "../producto.js";

/* Campos compartidos por el formulario de registro y el modal de edición.
   valores.docenaAuto: mientras sea true, el precio por docena sigue al precio mínimo × 12. */
export default function CamposProducto({ valores, onCambio, prefijo, etiquetaCompra }) {
    function cambiar(evento) {
        const { name, value } = evento.target;

        onCambio((anteriores) => {
            const nuevos = { ...anteriores, [name]: value };

            if (name === "precioDocena") {
                nuevos.docenaAuto = false;
            }

            if (name === "precioMinimo" && anteriores.docenaAuto) {
                nuevos.precioDocena = porDocena(value);
            }

            return nuevos;
        });
    }

    function recalcularDocena() {
        onCambio((anteriores) => ({
            ...anteriores,
            precioDocena: porDocena(anteriores.precioMinimo),
            docenaAuto: true
        }));
    }

    const id = (campo) => `${prefijo}-${campo}`;
    const minimoDocena = porDocena(valores.precioMinimo);

    return (
        <>
            <div className="fila-campos fila-codigo">
                <div className="campo">
                    <label htmlFor={id("codigo")}>Código del producto</label>
                    <input
                        type="text"
                        id={id("codigo")}
                        name="codigo"
                        placeholder="Ej. CIN-001"
                        maxLength={50}
                        autoCapitalize="characters"
                        autoComplete="off"
                        spellCheck={false}
                        value={valores.codigo}
                        onChange={cambiar}
                        required
                    />
                </div>

                <div className="campo">
                    <label htmlFor={id("nombre")}>Nombre del producto</label>
                    <input
                        type="text"
                        id={id("nombre")}
                        name="nombre"
                        placeholder="Ej. Cinta navideña"
                        maxLength={150}
                        value={valores.nombre}
                        onChange={cambiar}
                        required
                    />
                </div>
            </div>

            <fieldset className="grupo-campos">
                <legend>Precios de venta</legend>

                <div className="fila-campos">
                    <div className="campo">
                        <label htmlFor={id("precio")}>Precio por unidad (S/)</label>
                        <input
                            type="number"
                            id={id("precio")}
                            name="precio"
                            min="0"
                            step="0.01"
                            inputMode="decimal"
                            placeholder="3.00"
                            value={valores.precio}
                            onChange={cambiar}
                            required
                        />
                    </div>

                    <div className="campo">
                        <label htmlFor={id("precioMinimo")}>Precio mínimo por unidad (S/)</label>
                        <input
                            type="number"
                            id={id("precioMinimo")}
                            name="precioMinimo"
                            min="0"
                            step="0.01"
                            inputMode="decimal"
                            placeholder="2.50"
                            value={valores.precioMinimo}
                            onChange={cambiar}
                            required
                        />
                    </div>
                    <div className="campo">
                        <label htmlFor={id("precioDocena")}>Precio por docena (S/)</label>
                        <input
                            type="number"
                            id={id("precioDocena")}
                            name="precioDocena"
                            min="0"
                            step="0.01"
                            inputMode="decimal"
                            placeholder="36.00"
                            value={valores.precioDocena}
                            onChange={cambiar}
                            required
                        />
                        <span className="ayuda-campo dato-calculado">
                            {valores.docenaAuto ? (
                                <>Calculado: precio mínimo × 12 = <strong>S/ {minimoDocena || "0.00"}</strong>. Puedes cambiarlo.</>
                            ) : (
                                <button type="button" className="boton-enlace" onClick={recalcularDocena}>
                                    Usar mínimo × 12 (S/ {minimoDocena || "0.00"})
                                </button>
                            )}
                        </span>
                    </div>

                </div>
            </fieldset>

            <fieldset className="grupo-campos">
                <legend>Compra y stock</legend>

                <div className="fila-campos">
                    <div className="campo">
                        <label htmlFor={id("precioCompra")}>{etiquetaCompra}</label>
                        <input
                            type="number"
                            id={id("precioCompra")}
                            name="precioCompra"
                            min="0"
                            step="0.01"
                            inputMode="decimal"
                            placeholder="48.00"
                            value={valores.precioCompra}
                            onChange={cambiar}
                            required
                        />
                    </div>

                    <div className="campo">
                        <label htmlFor={id("unidadesPorCaja")}>Unidades por caja</label>
                        <input
                            type="number"
                            id={id("unidadesPorCaja")}
                            name="unidadesPorCaja"
                            min="1"
                            step="1"
                            inputMode="numeric"
                            value={valores.unidadesPorCaja}
                            onChange={cambiar}
                            required
                        />
                    </div>

                    <div className="campo">
                        <label htmlFor={id("stock")}>Stock (unidades)</label>
                        <input
                            type="number"
                            id={id("stock")}
                            name="stock"
                            min="0"
                            step="1"
                            inputMode="numeric"
                            placeholder="24"
                            value={valores.stock}
                            onChange={cambiar}
                            required
                        />
                    </div>
                </div>
            </fieldset>
        </>
    );
}
