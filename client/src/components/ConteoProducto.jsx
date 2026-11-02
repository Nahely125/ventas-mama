import { useEffect, useRef, useState } from "react";
import { pedir } from "../api.js";

// Mismos motivos que en el servidor (src/movimientos.js).
const MOTIVOS = [
    { valor: "conteo", texto: "🧮 Conteo físico", ayuda: "Contaste el producto y corriges la diferencia con el sistema." },
    { valor: "roto", texto: "💔 Roto o dañado", ayuda: "Unidades que ya no se pueden vender." },
    { valor: "perdido", texto: "❓ Perdido o faltante", ayuda: "Faltan unidades y no se sabe por qué." },
    { valor: "regalado", texto: "🎁 Regalado (fuera de una venta)", ayuda: "Se regaló sin registrarlo en una venta." },
    { valor: "uso", texto: "🏪 Uso del negocio", ayuda: "Se usó para decorar la tienda, muestras, etc." },
    { valor: "otro", texto: "✍️ Otro motivo", ayuda: "Explica en la nota qué pasó." }
];

/* Conteo físico o ajuste del stock: escribes cuántas unidades hay de verdad (o de cada color)
   y por qué cambia. La diferencia queda en el historial de movimientos y en el reporte de pérdidas. */
export default function ConteoProducto({ producto, onGuardado, onCerrar, onError }) {
    const dialogo = useRef(null);
    const colores = producto.colores ?? [];
    const [contado, setContado] = useState("");
    const [porColor, setPorColor] = useState({});
    const [motivo, setMotivo] = useState("conteo");
    const [nota, setNota] = useState("");
    const [error, setError] = useState("");
    const [enviando, setEnviando] = useState(false);

    useEffect(() => {
        dialogo.current?.showModal();
    }, []);

    // Diferencia con el sistema (solo de lo que se escribió).
    const lineas = colores.length > 0
        ? colores
            .filter((c) => porColor[c.id] !== undefined && porColor[c.id] !== "")
            .map((c) => ({ nombre: c.nombre, antes: c.stock, ahora: Number(porColor[c.id]) }))
        : contado === "" ? [] : [{ nombre: null, antes: producto.stock, ahora: Number(contado) }];
    const diferencia = lineas.reduce((suma, l) => suma + (l.ahora - l.antes), 0);
    const ayudaMotivo = MOTIVOS.find((m) => m.valor === motivo)?.ayuda;

    async function guardar(evento) {
        evento.preventDefault();
        setError("");

        if (lineas.length === 0) {
            setError(colores.length > 0 ? "Escribe cuántas unidades contaste de al menos un color." : "Escribe cuántas unidades contaste.");
            return;
        }

        if (lineas.some((l) => !Number.isInteger(l.ahora) || l.ahora < 0)) {
            setError("Las cantidades deben ser números enteros (0 o más).");
            return;
        }

        setEnviando(true);

        try {
            const cuerpo = colores.length > 0
                ? {
                    motivo,
                    nota,
                    colores: colores
                        .filter((c) => porColor[c.id] !== undefined && porColor[c.id] !== "")
                        .map((c) => ({ id: c.id, contado: Number(porColor[c.id]) }))
                }
                : { motivo, nota, contado: Number(contado) };
            const resultado = await pedir(`/api/productos/${producto.id}/conteo`, { method: "POST", cuerpo });
            await onGuardado(resultado);
        } catch (err) {
            onError(err, () => setError(err.message));
            setEnviando(false);
        }
    }

    return (
        <dialog ref={dialogo} className="modal" onClose={onCerrar} aria-labelledby="titulo-conteo">
            <form className="modal-contenido formulario" onSubmit={guardar}>
                <div className="modal-encabezado">
                    <h2 id="titulo-conteo">🧮 Contar / ajustar stock</h2>
                    <button type="button" className="boton-cerrar-modal" onClick={onCerrar} aria-label="Cerrar">✕</button>
                </div>

                <p className="producto-movimientos">
                    <strong>{producto.nombre}</strong> · en el sistema: <strong>{producto.stock} u.</strong>
                </p>

                {colores.length > 0 ? (
                    <fieldset className="grupo-campos">
                        <legend>¿Cuántas hay de verdad? (solo los colores que contaste)</legend>
                        <div className="fila-campos fila-dos">
                            {colores.map((color) => (
                                <div className="campo" key={color.id}>
                                    <label htmlFor={`conteo-color-${color.id}`}>
                                        {color.nombre} <small>(sistema: {color.stock})</small>
                                    </label>
                                    <input
                                        id={`conteo-color-${color.id}`}
                                        type="number"
                                        min="0"
                                        step="1"
                                        inputMode="numeric"
                                        value={porColor[color.id] ?? ""}
                                        onChange={(e) => setPorColor((v) => ({ ...v, [color.id]: e.target.value }))}
                                    />
                                </div>
                            ))}
                        </div>
                    </fieldset>
                ) : (
                    <div className="campo">
                        <label htmlFor="conteo-cantidad">¿Cuántas unidades hay de verdad?</label>
                        <input
                            id="conteo-cantidad"
                            type="number"
                            min="0"
                            step="1"
                            inputMode="numeric"
                            value={contado}
                            onChange={(e) => setContado(e.target.value)}
                            required
                        />
                    </div>
                )}

                <div className="campo">
                    <label htmlFor="conteo-motivo">Motivo</label>
                    <select id="conteo-motivo" value={motivo} onChange={(e) => setMotivo(e.target.value)}>
                        {MOTIVOS.map((m) => (
                            <option key={m.valor} value={m.valor}>{m.texto}</option>
                        ))}
                    </select>
                    <span className="ayuda-campo">{ayudaMotivo}</span>
                </div>

                <div className="campo">
                    <label htmlFor="conteo-nota">Nota {motivo === "otro" ? "" : "(opcional)"}</label>
                    <input
                        id="conteo-nota"
                        maxLength={150}
                        placeholder="Ej. se cayó la caja al descargar"
                        value={nota}
                        onChange={(e) => setNota(e.target.value)}
                        required={motivo === "otro"}
                    />
                </div>

                {lineas.length > 0 && (
                    <p className={`resumen-conteo ${diferencia < 0 ? "baja" : diferencia > 0 ? "sube" : ""}`} role="status">
                        {diferencia === 0
                            ? "✅ Coincide con el sistema."
                            : diferencia < 0
                                ? `Faltan ${-diferencia} u.: el stock bajará a ${producto.stock + diferencia}.`
                                : `Sobran ${diferencia} u.: el stock subirá a ${producto.stock + diferencia}.`}
                    </p>
                )}

                {error && <p className="mensaje mensaje-error" role="alert">{error}</p>}

                <div className="modal-acciones">
                    <button type="button" className="boton-secundario" onClick={onCerrar}>Cancelar</button>
                    <button type="submit" className="boton-principal" disabled={enviando}>
                        {enviando ? "Guardando..." : "Guardar"}
                    </button>
                </div>
            </form>
        </dialog>
    );
}
