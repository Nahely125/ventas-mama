import { useCallback, useEffect, useState } from "react";
import { pedir } from "../api.js";
import Encabezado from "./Encabezado.jsx";
import Cajonera from "./Cajonera.jsx";
import PanelControl from "./PanelControl.jsx";
import Historial from "./Historial.jsx";
import Inventario from "./Inventario.jsx";
import Ventas from "./Ventas.jsx";
import Gastos from "./Gastos.jsx";
import Inversion from "./Inversion.jsx";
import Empleados from "./Empleados.jsx";
import SeccionesCatalogo from "./SeccionesCatalogo.jsx";

const VISTAS = [
    {
        clave: "panel",
        icono: "📊",
        nombre: "Panel de control",
        descripcion: "Un vistazo general a tu negocio."
    },
    {
        clave: "inventario",
        icono: "📦",
        nombre: "Inventario",
        descripcion: "Consulta tus productos, precios y stock."
    },
    {
        clave: "ventas",
        icono: "🛒",
        nombre: "Registrar venta",
        descripcion: "Registra una venta y envía el comprobante por WhatsApp."
    },
    {
        clave: "historial",
        icono: "🧾",
        nombre: "Historial de ventas",
        descripcion: "Filtra tus ventas por día o mes y revisa los totales."
    },
    {
        clave: "gastos",
        icono: "💸",
        nombre: "Gastos",
        descripcion: "Anota lo que gastas para conocer tu ganancia real.",
        soloJefe: true
    },
    {
        clave: "catalogo",
        icono: "🛍️",
        nombre: "Catálogo",
        descripcion: "Organiza el catálogo por secciones (ferias) y elige cuáles se muestran.",
        soloJefe: true
    },
    {
        clave: "inversion",
        icono: "💼",
        nombre: "Inversión",
        descripcion: "Registra lo que invertiste y mira cuánto te falta para recuperarlo.",
        soloJefe: true
    },
    {
        clave: "empleados",
        icono: "👥",
        nombre: "Empleados",
        descripcion: "Agrega y administra las cuentas de las personas que te ayudan con las ventas.",
        soloJefe: true
    }
];

export default function Panel({ usuario, onSalir, onActualizarUsuario }) {
    const esJefe = usuario.rol === "jefe";
    const vistas = VISTAS.filter((v) => esJefe || !v.soloJefe);

    const [vista, setVista] = useState("panel");
    const [menuAbierto, setMenuAbierto] = useState(false);
    const [productos, setProductos] = useState(null);
    const [errorProductos, setErrorProductos] = useState("");
    const [resumen, setResumen] = useState(null);
    const [alertas, setAlertas] = useState(null);
    const [errorAlertas, setErrorAlertas] = useState("");
    const [ventas, setVentas] = useState(null);
    const [errorVentas, setErrorVentas] = useState("");

    // Si el servidor responde 401, la sesión expiró o la cuenta fue desactivada: volver al login.
    const manejarError = useCallback((error, mostrarError) => {
        if (error.estado === 401) {
            onSalir();
            return;
        }
        console.error(error);
        mostrarError?.();
    }, [onSalir]);

    const cargarProductos = useCallback(async () => {
        try {
            setProductos(await pedir("/api/productos"));
            setErrorProductos("");
        } catch (error) {
            manejarError(error, () => setErrorProductos(
                "No se pudieron cargar los productos. Verifica que el servidor esté funcionando."
            ));
        }
    }, [manejarError]);

    const cargarResumen = useCallback(async () => {
        try {
            setResumen(await pedir("/api/resumen"));
        } catch (error) {
            manejarError(error);
        }
    }, [manejarError]);

    const cargarAlertas = useCallback(async () => {
        try {
            setAlertas(await pedir("/api/productos/stock-bajo"));
            setErrorAlertas("");
        } catch (error) {
            manejarError(error, () => setErrorAlertas("No se pudieron cargar las alertas."));
        }
    }, [manejarError]);

    const cargarVentas = useCallback(async () => {
        try {
            setVentas(await pedir("/api/ventas"));
            setErrorVentas("");
        } catch (error) {
            manejarError(error, () => setErrorVentas("No se pudo cargar el historial de ventas."));
        }
    }, [manejarError]);

    const recargarInventario = useCallback(
        () => Promise.all([cargarProductos(), cargarResumen(), cargarAlertas()]),
        [cargarProductos, cargarResumen, cargarAlertas]
    );

    const recargarTodo = useCallback(
        () => Promise.all([recargarInventario(), cargarVentas()]),
        [recargarInventario, cargarVentas]
    );

    useEffect(() => {
        recargarTodo();
    }, [recargarTodo]);

    function cambiarVista(nueva) {
        setVista(nueva);
        setMenuAbierto(false);
        window.scrollTo({ top: 0 });

        if (nueva === "ventas" || nueva === "inventario") {
            cargarProductos();
        }

        if (nueva === "historial") {
            cargarVentas();
        }

        if (nueva === "panel") {
            cargarResumen();
            cargarAlertas();
        }
    }

    const cerrarMenu = useCallback(() => setMenuAbierto(false), []);

    const vistaActual = vistas.find((v) => v.clave === vista) ?? vistas[0];

    return (
        <>
            <Encabezado
                usuario={usuario}
                menuAbierto={menuAbierto}
                onAbrirMenu={() => setMenuAbierto(true)}
                onSalir={onSalir}
            />

            <div className="disposicion">
                <Cajonera
                    usuario={usuario}
                    vistas={vistas}
                    vistaActual={vistaActual.clave}
                    abierta={menuAbierto}
                    onElegir={cambiarVista}
                    onCerrar={cerrarMenu}
                />

                <main className="contenedor">
                    <section className="bienvenida">
                        <h2>
                            <span aria-hidden="true">{vistaActual.icono}</span> {vistaActual.nombre}
                        </h2>
                        <p>{vistaActual.descripcion}</p>
                    </section>

                    {vistaActual.clave === "panel" && (
                        <PanelControl
                            esJefe={esJefe}
                            resumen={resumen}
                            alertas={alertas}
                            errorAlertas={errorAlertas}
                            onIrA={cambiarVista}
                        />
                    )}

                    {vistaActual.clave === "inventario" && (
                        <Inventario
                            esJefe={esJefe}
                            productos={productos}
                            errorProductos={errorProductos}
                            onCambio={recargarInventario}
                            onError={manejarError}
                        />
                    )}

                    {vistaActual.clave === "ventas" && (
                        <Ventas
                            esJefe={esJefe}
                            productos={productos}
                            onVenta={recargarTodo}
                            onIrAHistorial={() => cambiarVista("historial")}
                            onError={manejarError}
                        />
                    )}

                    {vistaActual.clave === "historial" && (
                        <Historial esJefe={esJefe} ventas={ventas} error={errorVentas} />
                    )}

                    {vistaActual.clave === "gastos" && (
                        <Gastos onCambio={cargarResumen} onError={manejarError} />
                    )}

                    {vistaActual.clave === "inversion" && (
                        <Inversion resumen={resumen} onCambio={cargarResumen} onError={manejarError} />
                    )}

                    {vistaActual.clave === "catalogo" && (
                        <SeccionesCatalogo onError={manejarError} />
                    )}

                    {vistaActual.clave === "empleados" && (
                        <Empleados
                            usuarioActual={usuario}
                            onCuentaPropiaCambiada={onActualizarUsuario}
                            onError={manejarError}
                        />
                    )}
                </main>
            </div>
        </>
    );
}
