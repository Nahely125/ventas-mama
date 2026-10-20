import { useCallback, useEffect, useState } from "react";
import { pedir } from "../api.js";
import ModalEditarEmpleado from "./ModalEditarEmpleado.jsx";

const VALORES_INICIALES = {
    nombre: "",
    usuario: "",
    password: "",
    confirmar: ""
};

export default function Empleados({ usuarioActual, onCuentaPropiaCambiada, onError }) {
    const [empleados, setEmpleados] = useState(null);
    const [errorLista, setErrorLista] = useState("");
    const [valores, setValores] = useState(VALORES_INICIALES);
    const [verPassword, setVerPassword] = useState(false);
    const [mensaje, setMensaje] = useState(null);
    const [enviando, setEnviando] = useState(false);
    const [editando, setEditando] = useState(null);
    const [avisoLista, setAvisoLista] = useState(null);

    const cargarEmpleados = useCallback(async () => {
        try {
            setEmpleados(await pedir("/api/usuarios"));
            setErrorLista("");
        } catch (error) {
            onError(error, () => setErrorLista(error.message));
        }
    }, [onError]);

    useEffect(() => {
        cargarEmpleados();
    }, [cargarEmpleados]);

    function cambiar(evento) {
        const { name, value } = evento.target;
        setValores((anteriores) => ({ ...anteriores, [name]: value }));
    }

    async function alternarActivo(empleado) {
        const accion = empleado.activo ? "desactivar" : "activar";

        if (!confirm(`¿Seguro que deseas ${accion} la cuenta de ${empleado.nombre}?`)) {
            return;
        }

        try {
            await pedir(`/api/usuarios/${empleado.id}`, {
                method: "PUT",
                cuerpo: {
                    nombre: empleado.nombre,
                    usuario: empleado.usuario,
                    activo: !empleado.activo
                }
            });
            setAvisoLista({
                tipo: "exito",
                texto: empleado.activo
                    ? `${empleado.nombre} ya no puede iniciar sesión.`
                    : `${empleado.nombre} puede volver a iniciar sesión.`
            });
            await cargarEmpleados();
        } catch (error) {
            onError(error, () => setAvisoLista({ tipo: "error", texto: error.message }));
        }
    }

    async function eliminar(empleado) {
        if (!confirm(`¿Eliminar definitivamente la cuenta de ${empleado.nombre}?`)) {
            return;
        }

        try {
            await pedir(`/api/usuarios/${empleado.id}`, { method: "DELETE" });
            setAvisoLista({ tipo: "exito", texto: `Se eliminó la cuenta de ${empleado.nombre}.` });
            await cargarEmpleados();
        } catch (error) {
            onError(error, () => setAvisoLista({ tipo: "error", texto: error.message }));
        }
    }

    async function guardadoEdicion() {
        const editado = editando;
        setEditando(null);
        setAvisoLista({ tipo: "exito", texto: "Cuenta actualizada correctamente." });
        await cargarEmpleados();

        if (editado.id === usuarioActual.id) {
            await onCuentaPropiaCambiada();
        }
    }

    async function enviar(evento) {
        evento.preventDefault();

        const nombre = valores.nombre.trim();
        const usuario = valores.usuario.trim();

        if (!nombre || !usuario || !valores.password) {
            setMensaje({ tipo: "error", texto: "Todos los campos son obligatorios." });
            return;
        }

        if (!/^[a-zA-Z0-9._-]+$/.test(usuario)) {
            setMensaje({
                tipo: "error",
                texto: "El usuario solo puede tener letras, números, puntos, guiones y guiones bajos (sin espacios)."
            });
            return;
        }

        if (valores.password.length < 12) {
            setMensaje({ tipo: "error", texto: "La contraseña debe tener al menos 12 caracteres." });
            return;
        }

        if (valores.password !== valores.confirmar) {
            setMensaje({ tipo: "error", texto: "Las contraseñas no coinciden." });
            return;
        }

        setEnviando(true);

        try {
            const resultado = await pedir("/api/usuarios", {
                method: "POST",
                cuerpo: { nombre, usuario, password: valores.password }
            });

            setMensaje({
                tipo: "exito",
                texto: `${resultado.mensaje} Ya puede iniciar sesión con el usuario "${resultado.usuario.usuario}".`
            });
            setValores(VALORES_INICIALES);
            setVerPassword(false);
            await cargarEmpleados();
        } catch (error) {
            onError(error, () => setMensaje({ tipo: "error", texto: error.message }));
        } finally {
            setEnviando(false);
        }
    }

    return (
        <div className="contenido-vista">
            <section className="tarjeta formulario-empleado">
                <h2>Agregar empleado</h2>
                <p className="descripcion-seccion">
                    Crea una cuenta para que un trabajador pueda registrar ventas y consultar el inventario.
                </p>

                <form onSubmit={enviar} className="formulario">
                    <div className="fila-campos fila-empleado">
                        <div className="campo">
                            <label htmlFor="empleado-nombre">Nombre completo</label>
                            <input
                                type="text"
                                id="empleado-nombre"
                                name="nombre"
                                placeholder="Ej. Ana Torres"
                                maxLength={100}
                                autoComplete="off"
                                value={valores.nombre}
                                onChange={cambiar}
                                required
                            />
                        </div>

                        <div className="campo">
                            <label htmlFor="empleado-usuario">Nombre de usuario</label>
                            <input
                                type="text"
                                id="empleado-usuario"
                                name="usuario"
                                placeholder="Ej. ana.torres"
                                maxLength={50}
                                autoComplete="off"
                                autoCapitalize="none"
                                spellCheck={false}
                                value={valores.usuario}
                                onChange={cambiar}
                                required
                            />
                        </div>

                        <div className="campo">
                            <label htmlFor="empleado-password">Contraseña</label>
                            <input
                                type={verPassword ? "text" : "password"}
                                id="empleado-password"
                                name="password"
                                minLength={12}
                                autoComplete="new-password"
                                value={valores.password}
                                onChange={cambiar}
                                required
                            />
                        </div>

                        <div className="campo">
                            <label htmlFor="empleado-confirmar">Confirmar contraseña</label>
                            <input
                                type={verPassword ? "text" : "password"}
                                id="empleado-confirmar"
                                name="confirmar"
                                minLength={12}
                                autoComplete="new-password"
                                value={valores.confirmar}
                                onChange={cambiar}
                                required
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

                    <p className="ayuda-campo">Mínimo 12 caracteres.</p>

                    <button type="submit" className="boton-principal" disabled={enviando}>
                        {enviando ? "Registrando..." : "Agregar empleado"}
                    </button>

                    {mensaje && (
                        <p className={`mensaje mensaje-${mensaje.tipo}`} role="status" aria-live="polite">
                            {mensaje.texto}
                        </p>
                    )}
                </form>
            </section>

            <section className="tarjeta lista-empleados-seccion">
                <h2>Equipo</h2>

                {errorLista ? (
                    <p className="mensaje mensaje-error">{errorLista}</p>
                ) : empleados === null ? (
                    <p>Cargando empleados...</p>
                ) : empleados.length === 0 ? (
                    <p>Todavía no hay cuentas registradas.</p>
                ) : (
                    <ul className="lista-empleados">
                        {empleados.map((empleado) => {
                            const esPropia = empleado.id === usuarioActual.id;
                            const esTrabajador = empleado.rol === "trabajador";

                            return (
                                <li
                                    className={`empleado ${empleado.activo ? "" : "empleado-inactivo"}`}
                                    key={empleado.id}
                                >
                                    <div className="empleado-cabecera">
                                        <span className="avatar-empleado" aria-hidden="true">
                                            {(empleado.nombre || empleado.usuario).charAt(0).toUpperCase()}
                                        </span>
                                        <div className="datos-empleado">
                                            <strong>
                                                {empleado.nombre}
                                                {esPropia && <span className="texto-tu"> (tú)</span>}
                                            </strong>
                                            <span>@{empleado.usuario}</span>
                                        </div>
                                        <div className="etiquetas-empleado">
                                            <span className={`etiqueta etiqueta-${empleado.rol}`}>
                                                {esTrabajador ? "Trabajador" : "Jefe"}
                                            </span>
                                            {!empleado.activo && (
                                                <span className="etiqueta etiqueta-inactivo">Inactivo</span>
                                            )}
                                        </div>
                                    </div>

                                    <p className="empleado-estadisticas">
                                        {empleado.totalVentas === 1
                                            ? "1 venta registrada"
                                            : `${empleado.totalVentas} ventas registradas`}
                                    </p>

                                    {(esTrabajador || esPropia) && (
                                        <div className="acciones-empleado">
                                            <button
                                                type="button"
                                                className="boton-editar"
                                                onClick={() => setEditando(empleado)}
                                            >
                                                Editar
                                            </button>

                                            {esTrabajador && (
                                                <button
                                                    type="button"
                                                    className="boton-secundario boton-pequeno"
                                                    onClick={() => alternarActivo(empleado)}
                                                >
                                                    {empleado.activo ? "Desactivar" : "Activar"}
                                                </button>
                                            )}

                                            {esTrabajador && empleado.totalVentas === 0 && (
                                                <button
                                                    type="button"
                                                    className="boton-eliminar"
                                                    onClick={() => eliminar(empleado)}
                                                >
                                                    Eliminar
                                                </button>
                                            )}
                                        </div>
                                    )}
                                </li>
                            );
                        })}
                    </ul>
                )}

                {avisoLista && (
                    <p className={`mensaje mensaje-${avisoLista.tipo}`} role="status" aria-live="polite">
                        {avisoLista.texto}
                    </p>
                )}
            </section>

            {editando && (
                <ModalEditarEmpleado
                    empleado={editando}
                    esPropia={editando.id === usuarioActual.id}
                    onCerrar={() => setEditando(null)}
                    onGuardado={guardadoEdicion}
                    onError={onError}
                />
            )}
        </div>
    );
}
