import { useCallback, useEffect, useState } from "react";
import { moneda, pedir } from "../api.js";
import { formatearDia } from "../fechas.js";
import IngresarMercaderia from "./IngresarMercaderia.jsx";

const CONTABILIZAR = { inversion: "💼 Inversión", gasto: "💸 Gasto", ninguno: "Sin registrar" };

// Compras y reposiciones: cuánto se compró, cuándo y a quién.
export default function Compras({ productos, onCambio, onError }) {
    const [compras, setCompras] = useState(null);
    const [ingresando, setIngresando] = useState(false);
    const [mensaje, setMensaje] = useState(null);

    const cargar = useCallback(async () => {
        try {
            setCompras(await pedir("/api/compras"));
        } catch (err) {
            onError(err, () => setMensaje({ tipo: "error", texto: err.message }));
        }
    }, [onError]);

    useEffect(() => {
        cargar();
    }, [cargar]);

    async function deshacer(compra) {
        if (!confirm(`¿Deshacer el ingreso de ${compra.cantidad} u. de ${compra.producto}? Se quitarán del stock y se borrará su ${compra.contabilizar === "gasto" ? "gasto" : "inversión"}.`)) {
            return;
        }

        try {
            await pedir(`/api/compras/${compra.id}`, { method: "DELETE" });
            setMensaje({ tipo: "exito", texto: "Ingreso deshecho." });
            await Promise.all([cargar(), onCambio()]);
        } catch (err) {
            onError(err, () => setMensaje({ tipo: "error", texto: err.message }));
        }
    }

    const totalMes = (compras ?? [])
        .filter((c) => c.fecha.startsWith(new Date().toISOString().slice(0, 7)))
        .reduce((suma, c) => suma + Number(c.costoTotal), 0);

    return (
        <div className="contenido-vista">
            <section className="tarjeta">
                <div className="encabezado-seccion">
                    <h2>Compras y reposiciones</h2>
                    <button type="button" className="boton-principal boton-pequeno" onClick={() => setIngresando(true)}>
                        🚚 Ingresar mercadería
                    </button>
                </div>
                <p className="descripcion-seccion">
                    Cuando llegue mercadería, ingrésala aquí (o con el botón de cada producto en Inventario): se suma al
                    stock, se actualiza el costo por unidad y queda como inversión o gasto.
                </p>

                <div className="total-gastos total-compras">
                    <span>Comprado este mes</span>
                    <strong>{moneda(totalMes)}</strong>
                </div>

                {mensaje && <p className={`mensaje mensaje-${mensaje.tipo}`} role="status">{mensaje.texto}</p>}

                {compras === null ? (
                    <p>Cargando compras...</p>
                ) : compras.length === 0 ? (
                    <p>Todavía no hay compras registradas.</p>
                ) : (
                    <ul className="lista-gastos">
                        {compras.map((c) => (
                            <li className="gasto" key={c.id}>
                                <div className="gasto-datos">
                                    <strong>{c.producto} · {c.cantidad} u.</strong>
                                    <span>
                                        {formatearDia(c.fecha)}
                                        {c.proveedor && ` · ${c.proveedor}`} · {moneda(c.costoUnitario)} c/u ·{" "}
                                        <span className="etiqueta etiqueta-trabajador">{CONTABILIZAR[c.contabilizar]}</span>
                                    </span>
                                </div>
                                <strong className="gasto-monto monto-inversion">{moneda(c.costoTotal)}</strong>
                                <button type="button" className="boton-icono" onClick={() => deshacer(c)} aria-label={`Deshacer compra de ${c.producto}`} title="Deshacer">
                                    ↩️
                                </button>
                            </li>
                        ))}
                    </ul>
                )}
            </section>

            {ingresando && (
                <IngresarMercaderia
                    productos={productos}
                    onError={onError}
                    onCerrar={() => setIngresando(false)}
                    onGuardado={async (resultado) => {
                        setIngresando(false);
                        setMensaje({ tipo: "exito", texto: `${resultado.mensaje} Nuevo stock: ${resultado.stock} u. Costo por unidad: ${moneda(resultado.costoUnitario)}.` });
                        await Promise.all([cargar(), onCambio()]);
                    }}
                />
            )}
        </div>
    );
}
