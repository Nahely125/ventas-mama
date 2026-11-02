import NumeroAnimado from "./NumeroAnimado.jsx";

export default function Resumen({ resumen, esJefe }) {
    const tarjetas = [
        { titulo: "Total de productos", icono: "🏷️", valor: resumen?.totalProductos },
        { titulo: "Unidades disponibles", icono: "📦", valor: resumen?.unidadesTotales },
        esJefe && { titulo: "Valor del inventario nuevo", icono: "💰", valor: resumen?.valorInventarioNuevo, formato: "moneda" },
        esJefe && { titulo: "Valor del inventario 2025", icono: "📦", valor: resumen?.valorInventario2025, formato: "moneda" },
        { titulo: "Productos con stock bajo", icono: "⚠️", valor: resumen?.productosStockBajo },
        esJefe && { titulo: "Ganancia por ventas", icono: "📈", valor: resumen?.gananciaVentasNuevas, formato: "moneda" },
        esJefe && { titulo: "Ganancia inventario 2025", icono: "📦", valor: resumen?.ganancia2025, formato: "moneda" },
        esJefe && { titulo: "Gastos", icono: "💸", valor: resumen?.gastosTotales, formato: "moneda" },
        esJefe && Number(resumen?.porCobrar) > 0 && { titulo: "Por cobrar (fiados)", icono: "📝", valor: resumen?.porCobrar, formato: "moneda" },
        esJefe && {
            titulo: "Ganancia neta",
            icono: "✨",
            valor: resumen?.gananciaNeta,
            formato: "moneda",
            destacada: true,
            negativa: Number(resumen?.gananciaNeta) < 0
        }
    ].filter(Boolean);

    return (
        <section className="resumen">
            {tarjetas.map((tarjeta) => (
                <article
                    className={[
                        "tarjeta-resumen",
                        tarjeta.destacada && "tarjeta-destacada",
                        tarjeta.negativa && "tarjeta-negativa"
                    ].filter(Boolean).join(" ")}
                    key={tarjeta.titulo}
                >
                    <h3>
                        <span className="icono" aria-hidden="true">{tarjeta.icono}</span>
                        {tarjeta.titulo}
                    </h3>
                    <p>
                        <NumeroAnimado valor={tarjeta.valor} formato={tarjeta.formato} />
                    </p>
                </article>
            ))}
        </section>
    );
}
