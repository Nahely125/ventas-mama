import { useEffect, useRef } from "react";

/* Menú de secciones.
   En celular es un cajón lateral que se abre con el botón ☰;
   en escritorio queda fijo a la izquierda. */
export default function Cajonera({ usuario, vistas, vistaActual, abierta, onElegir, onCerrar }) {
    const menu = useRef(null);

    useEffect(() => {
        if (!abierta) return;

        document.body.classList.add("sin-desplazamiento");
        menu.current?.querySelector(".boton-cajonera.activo, .boton-cajonera")?.focus();

        function tecla(evento) {
            if (evento.key === "Escape") onCerrar();
        }

        window.addEventListener("keydown", tecla);

        return () => {
            document.body.classList.remove("sin-desplazamiento");
            window.removeEventListener("keydown", tecla);
        };
    }, [abierta, onCerrar]);

    return (
        <>
            <div
                className={`fondo-cajonera ${abierta ? "visible" : ""}`}
                onClick={onCerrar}
                aria-hidden="true"
            ></div>

            <nav
                ref={menu}
                id="cajonera"
                className={`cajonera ${abierta ? "abierta" : ""}`}
                aria-label="Secciones principales"
            >
                <div className="cajonera-encabezado">
                    <div className="cajonera-usuario">
                        <span className="avatar-empleado" aria-hidden="true">
                            {(usuario.nombre || usuario.usuario || "U").charAt(0).toUpperCase()}
                        </span>
                        <span>
                            <strong>{usuario.nombre || usuario.usuario}</strong>
                            <small>{usuario.rol === "jefe" ? "Jefe" : "Trabajador"}</small>
                        </span>
                    </div>
                    <button
                        type="button"
                        className="boton-cerrar-modal"
                        onClick={onCerrar}
                        aria-label="Cerrar menú"
                    >
                        ✕
                    </button>
                </div>

                <ul>
                    {vistas.map((vista) => (
                        <li key={vista.clave}>
                            <button
                                type="button"
                                className={`boton-cajonera ${vistaActual === vista.clave ? "activo" : ""}`}
                                aria-current={vistaActual === vista.clave ? "page" : undefined}
                                onClick={() => onElegir(vista.clave)}
                            >
                                <span className="icono-cajonera" aria-hidden="true">{vista.icono}</span>
                                <span>{vista.nombre}</span>
                            </button>
                        </li>
                    ))}
                </ul>

                <a className="boton-cajonera enlace-catalogo-cajonera" href="/catalogo" target="_blank" rel="noopener">
                    <span className="icono-cajonera" aria-hidden="true">🛍️</span>
                    Ver catálogo ↗
                </a>
            </nav>
        </>
    );
}
