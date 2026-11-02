import { useEffect, useRef, useState } from "react";
import { pedir } from "../api.js";

/* Mismos motivos que en el servidor (src/movimientos.js).
   pregunta: en el conteo se escribe cuántas hay; en los demás, cuántas salen. */
const MOTIVOS = [
    { valor: "conteo", texto: "🧮 Conteo físico", pregunta: "¿Cuántas unidades hay de verdad?", ayuda: "Contaste el producto: se corrige la diferencia con el sistema." },
    { valor: "roto", texto: "💔 Roto o dañado", pregunta: "¿Cuántas se rompieron o dañaron?", ayuda: "Unidades que ya no se pueden vender." },
    { valor: "perdido", texto: "❓ Perdido o faltante", pregunta: "¿Cuántas faltan?", ayuda: "Faltan unidades y no se sabe por qué." },
    { valor: "regalado", texto: "🎁 Regalado (fuera de una venta)", pregunta: "¿Cuántas se regalaron?", ayuda: "Se regaló sin registrarlo en una venta." },
    { valor: "uso", texto: "🏪 Uso del negocio", pregunta: "¿Cuántas se usaron?", ayuda: "Para decorar la tienda, muestras, etc." },
    { valor: "otro", texto: "✍️ Otro motivo", pregunta: "¿Cuántas unidades salen?", ayuda: "Explica en la nota qué pasó." }
];

// Contador − / + para restar de a una unidad (también se puede escribir el número).
function ContadorUnidades({ id, valor, maximo, onCambio }) {
    const numero = Number(valor) || 0;

    return (
        <div className="contador-unidades" role="group" aria-label="Cantidad">
            <button type="button" onClick={() => onCambio(numero <= 1 ? "" : String(numero - 1))} disabled={numero <= 0} aria-label="Una menos">
                −
            </button>
            <input
                id={id}
                type="number"
                min="1"
                max={maximo}
                step="1"
                inputMode="numeric"
                placeholder="0"
                value={valor}
                onChange={(e) => onCambio(e.target.value)}
            />
            <button type="button" onClick={() => onCambio(String(Math.min(numero + 1, maximo)))} disabled={numero >= maximo} aria-label="Una más">
                +
            </button>
        </div>
    );
}

/* Conteo físico o ajuste del stock. En "Conteo físico" escribes cuántas hay de verdad; en roto,
   perdido, regalado, etc., cuántas unidades salen (por ejemplo, 2 rotas). Todo queda en el
   historial de movimientos y en el reporte de pérdidas. Con colores, se indica por color. */
export default function ConteoProducto({ producto, onGuardado, onCerrar, onError }) {
    const dialogo = useRef(null);
    const colores = producto.colores ?? [];
    const [motivo, setMotivo] = useState("roto");
    const [cantidad, setCantidad] = useState("");
    const [porColor, setPorColor] = useState({});
    const [nota, setNota] = useState("");
    const [error, setError] = useState("");
    const [enviando, setEnviando] = useState(false);

    useEffect(() => {
        dialogo.current?.showModal();
    }, []);

    const elegido = MOTIVOS.find((m) => m.valor === motivo);
    const esConteo = motivo === "conteo";

    function cambiarMotivo(nuevo) {
        // Al cambiar entre "cuántas hay" y "cuántas salen", lo escrito ya no significa lo mismo.
        if ((nuevo === "conteo") !== esConteo) {
            setCantidad("");
            setPorColor({});
        }
        setMotivo(nuevo);
    }

    // Lo escrito, con el stock que queda después.
    const lineas = (colores.length > 0
        ? colores
            .filter((c) => porColor[c.id] !== undefined && porColor[c.id] !== "")
            .map((c) => ({ id: c.id, nombre: c.nombre, antes: c.stock, valor: Number(porColor[c.id]) }))
        : cantidad === "" ? [] : [{ id: null, nombre: null, antes: producto.stock, valor: Number(cantidad) }]
    ).map((l) => ({ ...l, despues: esConteo ? l.valor : l.antes - l.valor }));
    const diferencia = lineas.reduce((suma, l) => suma + (l.despues - l.antes), 0);

    async function guardar(evento) {
        evento.preventDefault();
        setError("");

        if (lineas.length === 0) {
            setError(colores.length > 0 ? "Escribe la cantidad de al menos un color." : "Escribe la cantidad.");
            return;
        }

        if (lineas.some((l) => !Number.isInteger(l.valor) || l.valor < (esConteo ? 0 : 1))) {
            setError(esConteo ? "Las cantidades deben ser números enteros (0 o más)." : "Las cantidades deben ser números enteros (1 o más).");
            return;
        }

        const demasiado = lineas.find((l) => l.despues < 0);
        if (demasiado) {
            setError(`Solo hay ${demasiado.antes} unidades${demasiado.nombre ? ` de ${demasiado.nombre}` : ""}.`);
            return;
        }

        setEnviando(true);

        try {
            const clave = esConteo ? "contado" : "quitar";
            const cuerpo = colores.length > 0
                ? { motivo, nota, colores: lineas.map((l) => ({ id: l.id, [clave]: l.valor })) }
                : { motivo, nota, [clave]: lineas[0].valor };
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
                    <h2 id="titulo-conteo">💔 Descontar unidades</h2>
                    <button type="button" className="boton-cerrar-modal" onClick={onCerrar} aria-label="Cerrar">✕</button>
                </div>

                <p className="producto-movimientos">
                    <strong>{producto.nombre}</strong> · en el sistema: <strong>{producto.stock} u.</strong>
                </p>

                <fieldset className="grupo-campos">
                    <legend>¿Por qué se descuenta?</legend>
                    <div className="motivos-ajuste" role="radiogroup" aria-label="Motivo">
                        {MOTIVOS.map((m) => (
                            <button
                                key={m.valor}
                                type="button"
                                role="radio"
                                aria-checked={motivo === m.valor}
                                className={motivo === m.valor ? "activo" : ""}
                                onClick={() => cambiarMotivo(m.valor)}
                            >
                                {m.texto}
                            </button>
                        ))}
                    </div>
                    <span className="ayuda-campo">{elegido.ayuda}</span>
                </fieldset>

                {colores.length > 0 ? (
                    <fieldset className="grupo-campos">
                        <legend>{elegido.pregunta} <small>(solo los colores que correspondan)</small></legend>
                        <div className="fila-campos fila-dos">
                            {colores.map((color) => (
                                <div className="campo" key={color.id}>
                                    <label htmlFor={`conteo-color-${color.id}`}>
                                        {color.nombre} <small>(hay {color.stock})</small>
                                    </label>
                                    {esConteo ? (
                                        <input
                                            id={`conteo-color-${color.id}`}
                                            type="number"
                                            min="0"
                                            step="1"
                                            inputMode="numeric"
                                            value={porColor[color.id] ?? ""}
                                            onChange={(e) => setPorColor((v) => ({ ...v, [color.id]: e.target.value }))}
                                        />
                                    ) : (
                                        <ContadorUnidades
                                            id={`conteo-color-${color.id}`}
                                            valor={porColor[color.id] ?? ""}
                                            maximo={color.stock}
                                            onCambio={(valor) => setPorColor((v) => ({ ...v, [color.id]: valor }))}
                                        />
                                    )}
                                </div>
                            ))}
                        </div>
                    </fieldset>
                ) : (
                    <div className="campo">
                        <label htmlFor="conteo-cantidad">{elegido.pregunta}</label>
                        {esConteo ? (
                            <input
                                id="conteo-cantidad"
                                type="number"
                                min="0"
                                step="1"
                                inputMode="numeric"
                                value={cantidad}
                                onChange={(e) => setCantidad(e.target.value)}
                                required
                            />
                        ) : (
                            <ContadorUnidades id="conteo-cantidad" valor={cantidad} maximo={producto.stock} onCambio={setCantidad} />
                        )}
                    </div>
                )}

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
                                ? `${esConteo ? "Faltan" : "Salen"} ${-diferencia} u.: el stock bajará a ${producto.stock + diferencia}.`
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
