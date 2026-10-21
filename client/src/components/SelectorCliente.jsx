import { useEffect, useState } from "react";
import { moneda, pedir } from "../api.js";

function mostrarTelefono(telefono) {
    return telefono ? telefono.replace(/^51(?=9\d{8}$)/, "") : "";
}

// Elige un cliente frecuente (o registra uno nuevo) para la venta.
export default function SelectorCliente({ cliente, onElegir, obligatorio, onError }) {
    const [texto, setTexto] = useState("");
    const [resultados, setResultados] = useState([]);
    const [abierto, setAbierto] = useState(false);
    const [creando, setCreando] = useState(false);
    const [nuevo, setNuevo] = useState({ nombre: "", telefono: "" });
    const [error, setError] = useState("");
    const [guardando, setGuardando] = useState(false);

    // Busca mientras se escribe (con una pequeña espera para no consultar en cada letra).
    useEffect(() => {
        if (!abierto) return undefined;

        const temporizador = setTimeout(() => {
            pedir(`/api/clientes?q=${encodeURIComponent(texto.trim())}`)
                .then((lista) => setResultados(lista.slice(0, 8)))
                .catch((err) => onError(err));
        }, 250);

        return () => clearTimeout(temporizador);
    }, [texto, abierto, onError]);

    async function registrar(evento) {
        evento.preventDefault();
        setError("");
        setGuardando(true);

        try {
            const resultado = await pedir("/api/clientes", {
                method: "POST",
                cuerpo: { nombre: nuevo.nombre.trim(), telefono: nuevo.telefono.trim() }
            });
            onElegir(resultado.cliente);
            setCreando(false);
            setNuevo({ nombre: "", telefono: "" });
        } catch (err) {
            onError(err, () => setError(err.message));
        } finally {
            setGuardando(false);
        }
    }

    if (cliente) {
        return (
            <div className="cliente-elegido">
                <span className="avatar-empleado" aria-hidden="true">{cliente.nombre.charAt(0).toUpperCase()}</span>
                <div>
                    <strong>{cliente.nombre}</strong>
                    <span>
                        {mostrarTelefono(cliente.telefono) || "Sin WhatsApp"}
                        {Number(cliente.saldo) > 0 && <> · <b className="texto-deuda">Debe {moneda(cliente.saldo)}</b></>}
                    </span>
                </div>
                <button type="button" className="boton-secundario boton-pequeno" onClick={() => onElegir(null)}>
                    Cambiar
                </button>
            </div>
        );
    }

    if (creando) {
        return (
            <div className="nuevo-cliente">
                <div className="fila-campos fila-dos">
                    <div className="campo">
                        <label htmlFor="nuevo-cliente-nombre">Nombre del cliente</label>
                        <input
                            type="text"
                            id="nuevo-cliente-nombre"
                            maxLength={100}
                            value={nuevo.nombre}
                            onChange={(e) => setNuevo((v) => ({ ...v, nombre: e.target.value }))}
                            autoFocus
                        />
                    </div>
                    <div className="campo">
                        <label htmlFor="nuevo-cliente-telefono">WhatsApp (opcional)</label>
                        <input
                            type="tel"
                            id="nuevo-cliente-telefono"
                            inputMode="tel"
                            placeholder="Ej. 987 654 321"
                            value={nuevo.telefono}
                            onChange={(e) => setNuevo((v) => ({ ...v, telefono: e.target.value }))}
                        />
                    </div>
                </div>
                {error && <p className="mensaje mensaje-error">{error}</p>}
                <div className="acciones-comprobante">
                    <button type="button" className="boton-secundario boton-pequeno" onClick={() => setCreando(false)}>
                        Cancelar
                    </button>
                    <button
                        type="button"
                        className="boton-editar"
                        onClick={registrar}
                        disabled={guardando || !nuevo.nombre.trim()}
                    >
                        {guardando ? "Guardando..." : "Guardar cliente"}
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="selector-cliente">
            <div className="buscador-producto">
                <input
                    type="search"
                    id="buscar-cliente"
                    placeholder={obligatorio ? "Busca al cliente (obligatorio para fiado)" : "Busca por nombre o WhatsApp (opcional)"}
                    autoComplete="off"
                    value={texto}
                    aria-invalid={obligatorio}
                    onChange={(e) => {
                        setTexto(e.target.value);
                        setAbierto(true);
                    }}
                    onFocus={() => setAbierto(true)}
                    onBlur={() => setTimeout(() => setAbierto(false), 150)}
                />

                {abierto && (
                    <ul className="resultados-producto" role="listbox">
                        {resultados.length === 0 ? (
                            <li className="sin-resultados">No hay clientes con ese nombre o número.</li>
                        ) : (
                            resultados.map((c) => (
                                <li
                                    key={c.id}
                                    role="option"
                                    aria-selected="false"
                                    className="resultado-producto"
                                    onMouseDown={(e) => {
                                        e.preventDefault();
                                        onElegir(c);
                                        setTexto("");
                                        setAbierto(false);
                                    }}
                                >
                                    <span className="resultado-nombre">{c.nombre}</span>
                                    <span className="resultado-detalle">
                                        {mostrarTelefono(c.telefono) || "Sin WhatsApp"}
                                        {Number(c.saldo) > 0 && ` · Debe ${moneda(c.saldo)}`}
                                    </span>
                                </li>
                            ))
                        )}
                    </ul>
                )}
            </div>

            <button type="button" className="boton-enlace" onClick={() => setCreando(true)}>
                ＋ Registrar cliente nuevo
            </button>
        </div>
    );
}
