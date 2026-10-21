import { useEffect, useRef, useState } from "react";
import { pedir } from "../api.js";

export default function ModalEditarEmpleado({ empleado, esPropia, onCerrar, onGuardado, onError }) {
    const dialogo = useRef(null);
    const [valores, setValores] = useState({
        nombre: empleado.nombre,
        usuario: empleado.usuario,
        password: "",
        confirmar: "",
        activo: empleado.activo,
        rol: empleado.rol
    });
    const [verPassword, setVerPassword] = useState(false);
    const [error, setError] = useState("");
    const [guardando, setGuardando] = useState(false);

    useEffect(() => {
        dialogo.current?.showModal();
    }, []);

    function cambiar(evento) {
        const { name, value, type, checked } = evento.target;
        setValores((anteriores) => ({ ...anteriores, [name]: type === "checkbox" ? checked : value }));
    }

    async function guardar(evento) {
        evento.preventDefault();

        const nombre = valores.nombre.trim();
        const usuario = valores.usuario.trim();

        if (!nombre || !usuario) {
            setError("El nombre y el usuario son obligatorios.");
            return;
        }

        if (!/^[a-zA-Z0-9._-]+$/.test(usuario)) {
            setError("El usuario solo puede tener letras, números, puntos, guiones y guiones bajos (sin espacios).");
            return;
        }

        if (valores.password) {
            if (valores.password.length < 12) {
                setError("La nueva contraseña debe tener al menos 12 caracteres.");
                return;
            }

            if (valores.password !== valores.confirmar) {
                setError("Las contraseñas no coinciden.");
                return;
            }
        }

        setGuardando(true);

        try {
            await pedir(`/api/usuarios/${empleado.id}`, {
                method: "PUT",
                cuerpo: {
                    nombre,
                    usuario,
                    password: valores.password || undefined,
                    activo: valores.activo,
                    rol: valores.rol
                }
            });
            await onGuardado();
        } catch (err) {
            onError(err, () => setError(err.message));
            setGuardando(false);
        }
    }

    return (
        <dialog
            ref={dialogo}
            className="modal"
            onClose={onCerrar}
            onClick={(e) => e.target === dialogo.current && onCerrar()}
            aria-labelledby="titulo-editar-empleado"
        >
            <form onSubmit={guardar} className="formulario modal-contenido">
                <div className="modal-encabezado">
                    <h2 id="titulo-editar-empleado">
                        {esPropia ? "Mi cuenta" : empleado.rol === "jefe" ? "Editar administrador" : "Editar empleado"}
                    </h2>
                    <button type="button" className="boton-cerrar-modal" onClick={onCerrar} aria-label="Cerrar">
                        ✕
                    </button>
                </div>

                <div className="fila-campos fila-empleado">
                    <div className="campo">
                        <label htmlFor="editar-empleado-nombre">Nombre completo</label>
                        <input
                            type="text"
                            id="editar-empleado-nombre"
                            name="nombre"
                            maxLength={100}
                            value={valores.nombre}
                            onChange={cambiar}
                            required
                        />
                    </div>

                    <div className="campo">
                        <label htmlFor="editar-empleado-usuario">Nombre de usuario</label>
                        <input
                            type="text"
                            id="editar-empleado-usuario"
                            name="usuario"
                            maxLength={50}
                            autoCapitalize="none"
                            spellCheck={false}
                            value={valores.usuario}
                            onChange={cambiar}
                            required
                        />
                    </div>
                </div>

                <fieldset className="grupo-campos">
                    <legend>Cambiar contraseña (opcional)</legend>

                    <div className="fila-campos fila-empleado">
                        <div className="campo">
                            <label htmlFor="editar-empleado-password">Nueva contraseña</label>
                            <input
                                type={verPassword ? "text" : "password"}
                                id="editar-empleado-password"
                                name="password"
                                autoComplete="new-password"
                                placeholder="Déjalo vacío para no cambiarla"
                                value={valores.password}
                                onChange={cambiar}
                            />
                        </div>

                        <div className="campo">
                            <label htmlFor="editar-empleado-confirmar">Confirmar contraseña</label>
                            <input
                                type={verPassword ? "text" : "password"}
                                id="editar-empleado-confirmar"
                                name="confirmar"
                                autoComplete="new-password"
                                value={valores.confirmar}
                                onChange={cambiar}
                            />
                        </div>
                    </div>

                    <label className="casilla">
                        <input
                            type="checkbox"
                            checked={verPassword}
                            onChange={(e) => setVerPassword(e.target.checked)}
                        />
                        Mostrar contraseña
                    </label>
                </fieldset>

                {!esPropia && (
                    <label className="interruptor">
                        <input
                            type="checkbox"
                            checked={valores.rol === "jefe"}
                            onChange={(e) => setValores((anteriores) => ({ ...anteriores, rol: e.target.checked ? "jefe" : "trabajador" }))}
                        />
                        <span className="interruptor-pista" aria-hidden="true"></span>
                        <span>
                            <strong>{valores.rol === "jefe" ? "Administrador" : "Trabajador"}</strong>
                            <small>
                                {valores.rol === "jefe"
                                    ? "Tiene el mismo poder que el jefe."
                                    : "Registra ventas y consulta el inventario. No ve costos ni ganancias."}
                            </small>
                        </span>
                    </label>
                )}

                {!esPropia && (
                    <label className="interruptor">
                        <input type="checkbox" name="activo" checked={valores.activo} onChange={cambiar} />
                        <span className="interruptor-pista" aria-hidden="true"></span>
                        <span>
                            <strong>{valores.activo ? "Cuenta activa" : "Cuenta desactivada"}</strong>
                            <small>
                                {valores.activo
                                    ? "Puede iniciar sesión y registrar ventas."
                                    : "No podrá iniciar sesión. Su historial de ventas se conserva."}
                            </small>
                        </span>
                    </label>
                )}

                {error && <p className="mensaje mensaje-error" role="alert">{error}</p>}

                <div className="modal-acciones">
                    <button type="button" className="boton-secundario" onClick={onCerrar}>
                        Cancelar
                    </button>
                    <button type="submit" className="boton-principal" disabled={guardando}>
                        {guardando ? "Guardando..." : "Guardar cambios"}
                    </button>
                </div>
            </form>
        </dialog>
    );
}
