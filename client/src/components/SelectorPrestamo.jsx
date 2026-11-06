import { useEffect, useState } from "react";
import { moneda, pedir } from "../api.js";

// Préstamos que todavía tienen dinero sin usar (para pagar una compra con ellos).
export function usePrestamosDisponibles() {
    const [prestamos, setPrestamos] = useState([]);

    useEffect(() => {
        pedir("/api/prestamos")
            .then((lista) => setPrestamos(lista.filter((p) => Number(p.sinUsar) > 0)))
            .catch(() => setPrestamos([]));
    }, []);

    return prestamos;
}

/* "¿Con qué dinero se pagó?": dinero propio o un préstamo (capital financiado).
   Si no hay préstamos con dinero sin usar, no se muestra. */
export default function SelectorPrestamo({ id, valor, onCambio, prestamos }) {
    if (prestamos.length === 0) return null;

    return (
        <div className="campo">
            <label htmlFor={id}>¿Con qué dinero se pagó?</label>
            <select id={id} value={valor ?? ""} onChange={(e) => onCambio(e.target.value ? Number(e.target.value) : null)}>
                <option value="">💵 Dinero propio</option>
                {prestamos.map((p) => (
                    <option key={p.id} value={p.id}>
                        🏦 Préstamo de {p.prestamista} (quedan {moneda(p.sinUsar)})
                    </option>
                ))}
            </select>
        </div>
    );
}
