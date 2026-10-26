import { useCallback, useEffect, useState } from "react";
import { pedir } from "../api.js";
import { TEMAS, iconoTema } from "../secciones.js";
import CategoriasSeccion from "./CategoriasSeccion.jsx";
import EditarFotos from "./EditarFotos.jsx";

const VACIA = { nombre: "", descripcion: "", tema: "general", visible: true, orden: "0" };

function aFormulario(seccion) {
    return {
        nombre: seccion.nombre,
        descripcion: seccion.descripcion ?? "",
        tema: seccion.tema,
        visible: seccion.visible,
        orden: String(seccion.orden)
    };
}

// Administración de las secciones del catálogo (solo el jefe).
export default function SeccionesCatalogo({ onError }) {
    const [secciones, setSecciones] = useState(null);
    const [editandoId, setEditandoId] = useState(null); // null: nueva; número: editando
    const [valores, setValores] = useState(VACIA);
    const [mensaje, setMensaje] = useState(null);
    const [guardando, setGuardando] = useState(false);

    const cargar = useCallback(async () => {
        try {
            setSecciones(await pedir("/api/secciones"));
        } catch (error) {
            onError(error, () => setMensaje({ tipo: "error", texto: error.message }));
        }
    }, [onError]);

    useEffect(() => {
        cargar();
    }, [cargar]);

    function cambiar(evento) {
        const { name, value, type, checked } = evento.target;
        setValores((anteriores) => ({ ...anteriores, [name]: type === "checkbox" ? checked : value }));
    }

    function nueva() {
        setEditandoId(null);
        setValores({ ...VACIA, orden: String((secciones?.length ?? 0) + 1) });
        setMensaje(null);
    }

    function editar(seccion) {
        setEditandoId(seccion.id);
        setValores(aFormulario(seccion));
        setMensaje(null);
        document.getElementById("seccion-nombre")?.focus();
    }

    async function guardar(evento) {
        evento.preventDefault();
        setGuardando(true);

        const cuerpo = {
            nombre: valores.nombre.trim(),
            descripcion: valores.descripcion.trim(),
            tema: valores.tema,
            visible: valores.visible,
            orden: Number(valores.orden) || 0
        };

        try {
            if (editandoId) {
                await pedir(`/api/secciones/${editandoId}`, { method: "PUT", cuerpo });
                setMensaje({ tipo: "exito", texto: "Sección actualizada." });
            } else {
                await pedir("/api/secciones", { method: "POST", cuerpo });
                setMensaje({ tipo: "exito", texto: "Sección creada." });
            }

            setEditandoId(null);
            setValores(VACIA);
            await cargar();
        } catch (error) {
            onError(error, () => setMensaje({ tipo: "error", texto: error.message }));
        } finally {
            setGuardando(false);
        }
    }

    async function alternarVisible(seccion) {
        try {
            await pedir(`/api/secciones/${seccion.id}`, {
                method: "PUT",
                cuerpo: { ...aFormulario(seccion), orden: seccion.orden, visible: !seccion.visible }
            });
            await cargar();
        } catch (error) {
            onError(error, () => alert(error.message));
        }
    }

    async function eliminar(seccion) {
        if (!confirm(`¿Eliminar la sección "${seccion.nombre}"? Sus ${seccion.totalProductos} productos no se borran: quedan sin sección.`)) {
            return;
        }

        try {
            await pedir(`/api/secciones/${seccion.id}`, { method: "DELETE" });
            if (editandoId === seccion.id) nueva();
            await cargar();
        } catch (error) {
            onError(error, () => alert(error.message));
        }
    }

    return (
        <div className="contenido-vista">
            <section className="tarjeta">
                <div className="encabezado-seccion">
                    <h2>Secciones del catálogo</h2>
                    <a className="boton-secundario boton-pequeno enlace-boton" href="/catalogo" target="_blank" rel="noopener">
                        🛍️ Ver catálogo ↗
                    </a>
                </div>
                <p className="descripcion-seccion">
                    Cada sección (feria) es una pestaña del catálogo y se divide en categorías para que los clientes encuentren rápido lo que buscan. Oculta la feria que no esté en temporada (por ejemplo, la Escolar hasta que empiece) y elige la ubicación de cada producto al registrarlo o editarlo.
                </p>

                {secciones === null ? (
                    <p>Cargando secciones...</p>
                ) : secciones.length === 0 ? (
                    <p>Todavía no hay secciones.</p>
                ) : (
                    <ul className="lista-secciones">
                        {secciones.map((seccion) => (
                            <li key={seccion.id} className={`seccion-item tema-${seccion.tema} ${seccion.visible ? "" : "seccion-oculta"}`}>
                                <span className="icono-seccion" aria-hidden="true">{iconoTema(seccion.tema)}</span>
                                <div className="datos-seccion">
                                    <strong>{seccion.nombre}</strong>
                                    <span>
                                        {seccion.totalProductos} {seccion.totalProductos === 1 ? "producto" : "productos"} ·{" "}
                                        {seccion.visible ? "Visible en el catálogo" : "Oculta"}
                                    </span>
                                </div>
                                <div className="acciones-seccion">
                                    <button type="button" className="boton-secundario boton-pequeno" onClick={() => alternarVisible(seccion)}>
                                        {seccion.visible ? "Ocultar" : "Mostrar"}
                                    </button>
                                    <button type="button" className="boton-editar" onClick={() => editar(seccion)}>
                                        Editar
                                    </button>
                                    <button
                                        type="button"
                                        className="boton-icono"
                                        onClick={() => eliminar(seccion)}
                                        aria-label={`Eliminar sección ${seccion.nombre}`}
                                        title="Eliminar"
                                    >
                                        🗑️
                                    </button>
                                </div>
                                <CategoriasSeccion seccion={seccion} onCambio={cargar} onError={onError} />
                            </li>
                        ))}
                    </ul>
                )}
            </section>

            <section className="tarjeta">
                <h2>{editandoId ? "Editar sección" : "Nueva sección"}</h2>

                <form className="formulario" onSubmit={guardar}>
                    <div className="fila-campos fila-dos">
                        <div className="campo">
                            <label htmlFor="seccion-nombre">Nombre</label>
                            <input
                                type="text"
                                id="seccion-nombre"
                                name="nombre"
                                maxLength={80}
                                placeholder="Ej. Feria Navideña"
                                value={valores.nombre}
                                onChange={cambiar}
                                required
                            />
                        </div>
                        <div className="campo">
                            <label htmlFor="seccion-tema">Estilo del banner</label>
                            <select id="seccion-tema" name="tema" value={valores.tema} onChange={cambiar}>
                                {TEMAS.map((tema) => (
                                    <option key={tema.valor} value={tema.valor}>{tema.icono} {tema.nombre}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div className="campo">
                        <label htmlFor="seccion-descripcion">Frase del banner (opcional)</label>
                        <input
                            type="text"
                            id="seccion-descripcion"
                            name="descripcion"
                            maxLength={200}
                            placeholder="Ej. Adornos, regalos y todo para decorar tu Navidad."
                            value={valores.descripcion}
                            onChange={cambiar}
                        />
                    </div>

                    <div className="fila-campos fila-dos">
                        <div className="campo">
                            <label htmlFor="seccion-orden">Orden (1 = primera pestaña)</label>
                            <input
                                type="number"
                                id="seccion-orden"
                                name="orden"
                                min="0"
                                max="999"
                                step="1"
                                inputMode="numeric"
                                value={valores.orden}
                                onChange={cambiar}
                            />
                        </div>
                        <label className="interruptor">
                            <input type="checkbox" name="visible" checked={valores.visible} onChange={cambiar} />
                            <span className="interruptor-pista" aria-hidden="true"></span>
                            <span>
                                Visible en el catálogo
                                <small>Desactívalo para preparar la sección sin mostrarla.</small>
                            </span>
                        </label>
                    </div>

                    <div className="modal-acciones">
                        {editandoId && (
                            <button type="button" className="boton-secundario" onClick={nueva}>
                                Cancelar
                            </button>
                        )}
                        <button type="submit" className="boton-principal" disabled={guardando}>
                            {guardando ? "Guardando..." : editandoId ? "Guardar cambios" : "Crear sección"}
                        </button>
                    </div>

                    {mensaje && (
                        <p className={`mensaje mensaje-${mensaje.tipo}`} role="status">{mensaje.texto}</p>
                    )}
                </form>
            </section>

            <EditarFotos onError={onError} />
        </div>
    );
}
