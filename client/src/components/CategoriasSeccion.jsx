import { useState } from "react";
import { pedir } from "../api.js";

const VACIA = { nombre: "", icono: "" };

// Lista y edición de las categorías de una sección (por ejemplo, "Árboles y pinos").
export default function CategoriasSeccion({ seccion, onCambio, onError }) {
    const [abierta, setAbierta] = useState(false);
    const [editandoId, setEditandoId] = useState(null);
    const [valores, setValores] = useState(VACIA);
    const [error, setError] = useState("");
    const [guardando, setGuardando] = useState(false);

    const categorias = seccion.categorias ?? [];

    function editar(categoria) {
        setEditandoId(categoria.id);
        setValores({ nombre: categoria.nombre, icono: categoria.icono ?? "" });
        setError("");
    }

    function cancelar() {
        setEditandoId(null);
        setValores(VACIA);
        setError("");
    }

    async function guardar(evento) {
        evento.preventDefault();
        setGuardando(true);
        setError("");

        try {
            if (editandoId) {
                const actual = categorias.find((c) => c.id === editandoId);
                await pedir(`/api/secciones/categorias/${editandoId}`, {
                    method: "PUT",
                    cuerpo: { nombre: valores.nombre, icono: valores.icono, orden: actual?.orden ?? 0 }
                });
            } else {
                await pedir(`/api/secciones/${seccion.id}/categorias`, {
                    method: "POST",
                    cuerpo: { nombre: valores.nombre, icono: valores.icono, orden: categorias.length + 1 }
                });
            }

            cancelar();
            await onCambio();
        } catch (err) {
            onError(err, () => setError(err.message));
        } finally {
            setGuardando(false);
        }
    }

    // Sube o baja una categoría intercambiando su orden con la vecina.
    async function mover(indice, direccion) {
        const a = categorias[indice];
        const b = categorias[indice + direccion];
        if (!a || !b) return;

        try {
            await pedir(`/api/secciones/categorias/${a.id}`, { method: "PUT", cuerpo: { nombre: a.nombre, icono: a.icono ?? "", orden: indice + direccion + 1 } });
            await pedir(`/api/secciones/categorias/${b.id}`, { method: "PUT", cuerpo: { nombre: b.nombre, icono: b.icono ?? "", orden: indice + 1 } });
            await onCambio();
        } catch (err) {
            onError(err, () => setError(err.message));
        }
    }

    async function eliminar(categoria) {
        if (!confirm(`¿Eliminar la categoría "${categoria.nombre}"? Sus ${categoria.totalProductos} productos siguen en la sección, pero sin categoría.`)) {
            return;
        }

        try {
            await pedir(`/api/secciones/categorias/${categoria.id}`, { method: "DELETE" });
            if (editandoId === categoria.id) cancelar();
            await onCambio();
        } catch (err) {
            onError(err, () => setError(err.message));
        }
    }

    return (
        <div className="categorias-seccion">
            <button
                type="button"
                className="boton-enlace"
                onClick={() => setAbierta((valor) => !valor)}
                aria-expanded={abierta}
            >
                {abierta ? "▾" : "▸"} Categorías ({categorias.length})
            </button>

            {abierta && (
                <div className="categorias-panel">
                    {categorias.length === 0 ? (
                        <p className="ayuda-campo">Esta sección todavía no tiene categorías.</p>
                    ) : (
                        <ul className="lista-categorias">
                            {categorias.map((categoria, indice) => (
                                <li key={categoria.id} className={editandoId === categoria.id ? "editando" : ""}>
                                    <span className="categoria-nombre">
                                        <span aria-hidden="true">{categoria.icono || "•"}</span> {categoria.nombre}
                                        <small>{categoria.totalProductos}</small>
                                    </span>
                                    <span className="categoria-acciones">
                                        <button type="button" onClick={() => mover(indice, -1)} disabled={indice === 0} aria-label={`Subir ${categoria.nombre}`} title="Subir">↑</button>
                                        <button type="button" onClick={() => mover(indice, 1)} disabled={indice === categorias.length - 1} aria-label={`Bajar ${categoria.nombre}`} title="Bajar">↓</button>
                                        <button type="button" onClick={() => editar(categoria)} aria-label={`Editar ${categoria.nombre}`} title="Editar">✎</button>
                                        <button type="button" onClick={() => eliminar(categoria)} aria-label={`Eliminar ${categoria.nombre}`} title="Eliminar">✕</button>
                                    </span>
                                </li>
                            ))}
                        </ul>
                    )}

                    <form className="form-categoria" onSubmit={guardar}>
                        <input
                            type="text"
                            className="campo-icono"
                            aria-label="Emoji de la categoría"
                            placeholder="🎄"
                            maxLength={8}
                            value={valores.icono}
                            onChange={(e) => setValores((v) => ({ ...v, icono: e.target.value }))}
                        />
                        <input
                            type="text"
                            aria-label="Nombre de la categoría"
                            placeholder={editandoId ? "Nombre de la categoría" : "Nueva categoría, ej. Pinos nevados"}
                            maxLength={60}
                            value={valores.nombre}
                            onChange={(e) => setValores((v) => ({ ...v, nombre: e.target.value }))}
                            required
                        />
                        <button type="submit" className="boton-editar" disabled={guardando}>
                            {editandoId ? "Guardar" : "Agregar"}
                        </button>
                        {editandoId && (
                            <button type="button" className="boton-secundario boton-pequeno" onClick={cancelar}>
                                Cancelar
                            </button>
                        )}
                    </form>

                    {error && <p className="mensaje mensaje-error">{error}</p>}
                </div>
            )}
        </div>
    );
}
