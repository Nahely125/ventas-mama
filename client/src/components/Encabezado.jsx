import { useState } from "react";
import { pedir } from "../api.js";

export default function Encabezado({ usuario, menuAbierto, onAbrirMenu, onSalir }) {
    const [saliendo, setSaliendo] = useState(false);

    async function cerrarSesion() {
        setSaliendo(true);

        try {
            await pedir("/api/logout", { method: "POST" });
            onSalir();
        } catch (error) {
            console.error(error);
            alert("No se pudo cerrar la sesión. Inténtalo nuevamente.");
            setSaliendo(false);
        }
    }

    return (
        <header className="encabezado">
            <div className="encabezado-interno">
                <button
                    type="button"
                    className="boton-menu"
                    onClick={onAbrirMenu}
                    aria-label="Abrir menú"
                    aria-expanded={menuAbierto}
                    aria-controls="cajonera"
                >
                    <span aria-hidden="true"></span>
                </button>

                <div className="marca">
                    <h1>Ventas Mamá</h1>
                    <p>Control de ventas e inventario</p>
                </div>

                <div className="sesion-usuario">
                    <span className="nombre-usuario">
                        <span aria-hidden="true">👤</span>{" "}
                        {usuario.nombre || usuario.usuario || "Usuario"}
                    </span>
                    <button
                        type="button"
                        className="boton-cerrar-sesion"
                        onClick={cerrarSesion}
                        disabled={saliendo}
                    >
                        Cerrar sesión
                    </button>
                </div>
            </div>
        </header>
    );
}
