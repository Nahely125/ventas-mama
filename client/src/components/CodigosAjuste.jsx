import { useCallback, useEffect, useState } from "react";
import { moneda, pedir } from "../api.js";

const VALORES_INICIALES = {
    codigo: "",
    descripcion: "",
    tipo: "fijo", // "fijo": monto definido · "libre": el empleado escribe el monto al vender
    monto: "",
    activo: true
};

// El jefe registra los códigos de ajuste (descuentos) que les da a los empleados.
export default function CodigosAjuste({ onError }) {
    const [codigos, setCodigos] = useState(null);
    const [errorLista, setErrorLista] = useState("");
    const [valores, setValores] = useState(VALORES_INICIALES);
    const [editando, setEditando] = useState(null); // id del código que se edita
    const [mensaje, setMensaje] = useState(null);
    const [enviando, setEnviando] = useState(false);

    const cargar = useCallback(async () => {
        try {
            setCodigos(await pedir("/api/ajustes"));
            setErrorLista("");
        } catch (error) {
            onError(error, () => setErrorLista(error.message));
        }
    }, [onError]);

    useEffect(() => {
        cargar();
    }, [cargar]);

    function cambiar(evento) {
        const { name, value } = evento.target;
        setValores((anteriores) => ({ ...anteriores, [name]: value }));
    }

    function editar(codigo) {
        setEditando(codigo.id);
        setValores({
            codigo: codigo.codigo,
            descripcion: codigo.descripcion ?? "",
            tipo: codigo.monto === null ? "libre" : "fijo",
            monto: codigo.monto === null ? "" : String(Number(codigo.monto)),
            activo: codigo.activo
        });
        setMensaje(null);
    }

    function cancelar() {
        setEditando(null);
        setValores(VALORES_INICIALES);
        setMensaje(null);
    }

    const cuerpo = (datos) => ({
        codigo: datos.codigo,
        descripcion: datos.descripcion,
        monto: datos.tipo === "libre" ? null : Number(datos.monto),
        activo: datos.activo
    });

    async function guardar(evento) {
        evento.preventDefault();

        if (valores.tipo === "fijo" && !(Number(valores.monto) > 0)) {
            setMensaje({ tipo: "error", texto: "Escribe el monto del descuento (mayor que cero)." });
            return;
        }

        setEnviando(true);

        try {
            const resultado = await pedir(editando ? `/api/ajustes/${editando}` : "/api/ajustes", {
                method: editando ? "PUT" : "POST",
                cuerpo: cuerpo(valores)
            });
            setMensaje({ tipo: "exito", texto: resultado.mensaje });
            setEditando(null);
            setValores(VALORES_INICIALES);
            await cargar();
        } catch (error) {
            onError(error, () => setMensaje({ tipo: "error", texto: error.message }));
        } finally {
            setEnviando(false);
        }
    }

    async function cambiarActivo(codigo) {
        try {
            await pedir(`/api/ajustes/${codigo.id}`, {
                method: "PUT",
                cuerpo: {
                    codigo: codigo.codigo,
                    descripcion: codigo.descripcion ?? "",
                    monto: codigo.monto === null ? null : Number(codigo.monto),
                    activo: !codigo.activo
                }
            });
            await cargar();
        } catch (error) {
            onError(error, () => alert(error.message));
        }
    }

    async function eliminar(codigo) {
        if (!confirm(`¿Eliminar el código "${codigo.codigo}"? Las ventas que ya lo usaron no cambian.`)) {
            return;
        }

        try {
            await pedir(`/api/ajustes/${codigo.id}`, { method: "DELETE" });
            if (editando === codigo.id) cancelar();
            await cargar();
        } catch (error) {
            onError(error, () => alert(error.message));
        }
    }

    return (
        <div className="contenido-vista vista-gastos">
            <section className="tarjeta formulario-gasto">
                <h2>{editando ? "Editar código de ajuste" : "Nuevo código de ajuste"}</h2>
                <p className="descripcion-seccion">
                    Dale el código al empleado para que pueda descontar del total de una venta.
                    Puedes desactivarlo o cambiarlo cuando quieras.
                </p>

                <form onSubmit={guardar} className="formulario">
                    <div className="campo">
                        <label htmlFor="ajuste-codigo">Código</label>
                        <input
                            type="text"
                            id="ajuste-codigo"
                            name="codigo"
                            maxLength={20}
                            autoCapitalize="characters"
                            autoComplete="off"
                            spellCheck={false}
                            value={valores.codigo}
                            onChange={cambiar}
                            required
                        />
                        <span className="ayuda-campo">De 3 a 20 letras o números. Se guarda en mayúsculas.</span>
                    </div>

                    <div className="campo">
                        <label htmlFor="ajuste-descripcion">Descripción (opcional)</label>
                        <input
                            type="text"
                            id="ajuste-descripcion"
                            name="descripcion"
                            maxLength={100}
                            placeholder="Para qué es este descuento"
                            value={valores.descripcion}
                            onChange={cambiar}
                        />
                    </div>

                    <div className="campo">
                        <span className="etiqueta-campo" id="etiqueta-tipo-ajuste">Monto del descuento</span>
                        <div className="selector-modalidad" role="radiogroup" aria-labelledby="etiqueta-tipo-ajuste">
                            {[
                                { valor: "fijo", texto: "Monto fijo" },
                                { valor: "libre", texto: "Lo escribe el empleado" }
                            ].map((opcion) => (
                                <button
                                    key={opcion.valor}
                                    type="button"
                                    role="radio"
                                    aria-checked={valores.tipo === opcion.valor}
                                    className={valores.tipo === opcion.valor ? "activo" : ""}
                                    onClick={() => setValores((anteriores) => ({ ...anteriores, tipo: opcion.valor }))}
                                >
                                    {opcion.texto}
                                </button>
                            ))}
                        </div>
                    </div>

                    {valores.tipo === "fijo" && (
                        <div className="campo">
                            <label htmlFor="ajuste-monto">Descuento (S/)</label>
                            <input
                                type="number"
                                id="ajuste-monto"
                                name="monto"
                                min="0.01"
                                step="0.01"
                                inputMode="decimal"
                                placeholder="0.00"
                                value={valores.monto}
                                onChange={cambiar}
                                required
                            />
                        </div>
                    )}

                    <label className="casilla">
                        <input
                            type="checkbox"
                            checked={valores.activo}
                            onChange={(e) => setValores((anteriores) => ({ ...anteriores, activo: e.target.checked }))}
                        />
                        <span>Activo (los empleados lo pueden usar)</span>
                    </label>

                    <button type="submit" className="boton-principal" disabled={enviando}>
                        {enviando ? "Guardando..." : editando ? "Guardar cambios" : "Registrar código"}
                    </button>
                    {editando && (
                        <button type="button" className="boton-secundario" onClick={cancelar}>
                            Cancelar
                        </button>
                    )}

                    {mensaje && (
                        <p className={`mensaje mensaje-${mensaje.tipo}`} role="status" aria-live="polite">
                            {mensaje.texto}
                        </p>
                    )}
                </form>
            </section>

            <section className="tarjeta">
                <h2>Códigos registrados</h2>

                {errorLista ? (
                    <p className="mensaje mensaje-error">{errorLista}</p>
                ) : codigos === null ? (
                    <p>Cargando códigos...</p>
                ) : codigos.length === 0 ? (
                    <p>Todavía no hay códigos de ajuste.</p>
                ) : (
                    <ul className="lista-gastos">
                        {codigos.map((codigo) => (
                            <li className={`gasto codigo-ajuste ${codigo.activo ? "" : "inactivo"}`} key={codigo.id}>
                                <div className="gasto-datos">
                                    <strong>🏷️ {codigo.codigo}</strong>
                                    <span>
                                        {codigo.descripcion && <>{codigo.descripcion} · </>}
                                        Usado en {codigo.usos} {codigo.usos === 1 ? "venta" : "ventas"}
                                        {!codigo.activo && <span className="etiqueta etiqueta-inactivo">Desactivado</span>}
                                    </span>
                                </div>
                                <strong className="gasto-monto">
                                    {codigo.monto === null ? "Monto libre" : `− ${moneda(codigo.monto)}`}
                                </strong>
                                <div className="acciones-codigo">
                                    <button type="button" className="boton-icono" onClick={() => editar(codigo)} aria-label={`Editar ${codigo.codigo}`} title="Editar">
                                        ✏️
                                    </button>
                                    <button
                                        type="button"
                                        className="boton-icono"
                                        onClick={() => cambiarActivo(codigo)}
                                        aria-label={`${codigo.activo ? "Desactivar" : "Activar"} ${codigo.codigo}`}
                                        title={codigo.activo ? "Desactivar" : "Activar"}
                                    >
                                        {codigo.activo ? "⏸️" : "▶️"}
                                    </button>
                                    <button type="button" className="boton-icono" onClick={() => eliminar(codigo)} aria-label={`Eliminar ${codigo.codigo}`} title="Eliminar">
                                        🗑️
                                    </button>
                                </div>
                            </li>
                        ))}
                    </ul>
                )}
            </section>
        </div>
    );
}
