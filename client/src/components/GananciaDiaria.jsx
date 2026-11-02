import { useEffect, useState } from "react";
import { moneda, pedir } from "../api.js";
import { formatearDia, hoy, mesesDisponibles, nombreMes } from "../fechas.js";

// Ganancia neta por día de un mes: ganancia de mercadería nueva + ganancia del inventario 2025 − gastos.
export default function GananciaDiaria({ onError }) {
    const [mes, setMes] = useState(hoy().slice(0, 7));
    const [dias, setDias] = useState(null);
    const [error, setError] = useState("");

    useEffect(() => {
        setDias(null);
        pedir(`/api/resumen/diario?mes=${mes}`)
            .then((datos) => {
                setDias(datos);
                setError("");
            })
            .catch((err) => onError(err, () => setError(err.message)));
    }, [mes, onError]);

    const deHoy = (dias ?? []).find((d) => d.dia === hoy());
    const totales = (dias ?? []).reduce(
        (suma, d) => ({
            vendido: suma.vendido + Number(d.vendido),
            ganancia: suma.ganancia + Number(d.ganancia),
            nueva: suma.nueva + Number(d.gananciaNueva),
            g2025: suma.g2025 + Number(d.ganancia2025),
            gastos: suma.gastos + Number(d.gastos),
            invertido: suma.invertido + Number(d.invertido ?? 0),
            neta: suma.neta + Number(d.neta)
        }),
        { vendido: 0, ganancia: 0, nueva: 0, g2025: 0, gastos: 0, invertido: 0, neta: 0 }
    );

    // Los últimos 12 meses para elegir.
    const meses = mesesDisponibles(
        Array.from({ length: 12 }, (_, i) => {
            const fecha = new Date();
            fecha.setDate(1);
            fecha.setMonth(fecha.getMonth() - i);
            return `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, "0")}-01`;
        })
    );

    return (
        <section className="tarjeta ganancia-diaria">
            <div className="encabezado-seccion">
                <h2>Ganancia neta por día</h2>
                <div className="campo filtro-mes">
                    <label htmlFor="mes-ganancia">Mes</label>
                    <select id="mes-ganancia" value={mes} onChange={(e) => setMes(e.target.value)}>
                        {meses.map((clave) => (
                            <option key={clave} value={clave}>{nombreMes(clave)}</option>
                        ))}
                    </select>
                </div>
            </div>

            {mes === hoy().slice(0, 7) && (
                <div className={`ganancia-hoy ${deHoy && Number(deHoy.neta) < 0 ? "negativa" : ""}`}>
                    <span>Hoy</span>
                    <strong>{moneda(deHoy?.neta ?? 0)}</strong>
                    <small>
                        Nueva {moneda(deHoy?.gananciaNueva ?? 0)} + 2025 {moneda(deHoy?.ganancia2025 ?? 0)} − gastos {moneda(deHoy?.gastos ?? 0)}
                    </small>
                </div>
            )}

            {error ? (
                <p className="mensaje mensaje-error">{error}</p>
            ) : dias === null ? (
                <p>Cargando...</p>
            ) : dias.length === 0 ? (
                <p>No hay ventas, gastos ni inversiones en este mes.</p>
            ) : (
                <div className="tabla-contenedor">
                    <table className="tabla-dias">
                        <thead>
                            <tr>
                                <th>Día</th>
                                <th>Ventas</th>
                                <th>Vendido</th>
                                <th>Ganancia nueva</th>
                                <th>Ganancia 2025</th>
                                <th>Gastos</th>
                                <th>Invertido</th>
                                <th>Neta</th>
                            </tr>
                        </thead>
                        <tbody>
                            {dias.map((d) => (
                                <tr key={d.dia} className={d.dia === hoy() ? "dia-hoy" : ""}>
                                    <td data-etiqueta="Día" className="celda-dia">{formatearDia(d.dia)}</td>
                                    <td data-etiqueta="Ventas">{d.ventas}</td>
                                    <td data-etiqueta="Vendido">{moneda(d.vendido)}</td>
                                    <td data-etiqueta="Ganancia nueva" className="celda-nueva">{moneda(d.gananciaNueva)}</td>
                                    <td data-etiqueta="Ganancia 2025" className="celda-2025">{moneda(d.ganancia2025)}</td>
                                    <td data-etiqueta="Gastos" className="celda-gasto">{moneda(d.gastos)}</td>
                                    <td data-etiqueta="Invertido" className="celda-invertido">{moneda(d.invertido)}</td>
                                    <td data-etiqueta="Neta" className={`celda-neta ${Number(d.neta) < 0 ? "negativa" : ""}`}>
                                        {moneda(d.neta)}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                        <tfoot>
                            <tr>
                                <td data-etiqueta="Total del mes" className="celda-dia">Total del mes</td>
                                <td></td>
                                <td data-etiqueta="Vendido">{moneda(totales.vendido)}</td>
                                <td data-etiqueta="Ganancia nueva" className="celda-nueva">{moneda(totales.nueva)}</td>
                                <td data-etiqueta="Ganancia 2025" className="celda-2025">{moneda(totales.g2025)}</td>
                                <td data-etiqueta="Gastos" className="celda-gasto">{moneda(totales.gastos)}</td>
                                <td data-etiqueta="Invertido" className="celda-invertido">{moneda(totales.invertido)}</td>
                                <td data-etiqueta="Neta" className={`celda-neta ${totales.neta < 0 ? "negativa" : ""}`}>
                                    {moneda(totales.neta)}
                                </td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            )}
        </section>
    );
}
