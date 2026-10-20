import { useState } from "react";
import { moneda } from "../api.js";
import { formatearDia, hoy, mesesDisponibles, nombreMes } from "../fechas.js";
import { METODOS_PAGO } from "../venta.js";
import Comprobante from "./Comprobante.jsx";
import HistorialVentas from "./HistorialVentas.jsx";

const MODOS = [
    { valor: "hoy", texto: "Hoy" },
    { valor: "dia", texto: "Por día" },
    { valor: "mes", texto: "Por mes" },
    { valor: "todo", texto: "Todo" }
];

export default function Historial({ esJefe, ventas, error }) {
    const [modo, setModo] = useState("hoy");
    const [dia, setDia] = useState(hoy());
    const [mes, setMes] = useState(hoy().slice(0, 7));
    const [comprobante, setComprobante] = useState(null);

    const todas = ventas ?? [];
    const meses = mesesDisponibles(todas.map((v) => v.fecha));

    // venta.fecha viene como "YYYY-MM-DDTHH:MM:SS" en hora de Lima.
    const filtradas = ventas === null ? null : todas.filter((venta) => {
        if (modo === "hoy") return venta.fecha.startsWith(hoy());
        if (modo === "dia") return venta.fecha.startsWith(dia);
        if (modo === "mes") return venta.fecha.startsWith(mes);
        return true;
    });

    const lista = filtradas ?? [];
    const totalVendido = lista.reduce((suma, v) => suma + Number(v.total), 0);
    const unidades = lista.reduce((suma, v) => suma + v.cantidad, 0);
    const ganancia = lista.reduce((suma, v) => suma + Number(v.ganancia ?? 0), 0);
    const porMetodo = METODOS_PAGO
        .map((metodo) => ({
            ...metodo,
            total: lista
                .filter((v) => v.metodoPago === metodo.valor)
                .reduce((suma, v) => suma + Number(v.total), 0)
        }))
        .filter((metodo) => metodo.total > 0);

    const periodo = {
        hoy: `Hoy, ${formatearDia(hoy())}`,
        dia: dia ? formatearDia(dia) : "Elige un día",
        mes: nombreMes(mes),
        todo: "Todas las ventas"
    }[modo];

    return (
        <div className="contenido-vista">
            <section className="tarjeta filtros-historial">
                <div className="selector-modalidad selector-filtro" role="radiogroup" aria-label="Filtrar ventas">
                    {MODOS.map((opcion) => (
                        <button
                            key={opcion.valor}
                            type="button"
                            role="radio"
                            aria-checked={modo === opcion.valor}
                            className={modo === opcion.valor ? "activo" : ""}
                            onClick={() => setModo(opcion.valor)}
                        >
                            {opcion.texto}
                        </button>
                    ))}
                </div>

                {modo === "dia" && (
                    <div className="campo">
                        <label htmlFor="filtro-dia">Día</label>
                        <input
                            type="date"
                            id="filtro-dia"
                            max={hoy()}
                            value={dia}
                            onChange={(e) => setDia(e.target.value)}
                        />
                    </div>
                )}

                {modo === "mes" && (
                    <div className="campo">
                        <label htmlFor="filtro-mes-ventas">Mes</label>
                        <select id="filtro-mes-ventas" value={mes} onChange={(e) => setMes(e.target.value)}>
                            {meses.map((clave) => (
                                <option key={clave} value={clave}>{nombreMes(clave)}</option>
                            ))}
                        </select>
                    </div>
                )}

                <p className="periodo-actual">
                    <span aria-hidden="true">📅</span> {periodo}
                </p>

                <div className={`totales-historial ${esJefe ? "con-ganancia" : ""}`}>
                    <div className="total-historial">
                        <span>Ventas</span>
                        <strong>{lista.length}</strong>
                    </div>
                    <div className="total-historial">
                        <span>Unidades vendidas</span>
                        <strong>{unidades}</strong>
                    </div>
                    <div className="total-historial">
                        <span>Total vendido</span>
                        <strong>{moneda(totalVendido)}</strong>
                    </div>
                    {esJefe && (
                        <div className="total-historial total-ganancia">
                            <span>Ganancia</span>
                            <strong>{moneda(ganancia)}</strong>
                        </div>
                    )}
                </div>

                {porMetodo.length > 0 && (
                    <ul className="totales-metodo" aria-label="Total por método de pago">
                        {porMetodo.map((metodo) => (
                            <li key={metodo.valor}>
                                <span aria-hidden="true">{metodo.icono}</span> {metodo.nombre}:{" "}
                                <strong>{moneda(metodo.total)}</strong>
                            </li>
                        ))}
                    </ul>
                )}
            </section>

            <HistorialVentas
                ventas={filtradas}
                error={error}
                esJefe={esJefe}
                textoVacio={modo === "todo"
                    ? "Todavía no hay ventas registradas."
                    : "No hay ventas en este periodo."}
                onVerComprobante={setComprobante}
            />

            {comprobante && (
                <Comprobante venta={comprobante} onCerrar={() => setComprobante(null)} />
            )}
        </div>
    );
}
