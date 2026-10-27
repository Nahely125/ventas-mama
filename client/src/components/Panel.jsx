import { useCallback, useEffect, useState } from "react";
import { pedir } from "../api.js";
import Encabezado from "./Encabezado.jsx";
import Cajonera from "./Cajonera.jsx";
import PanelControl from "./PanelControl.jsx";
import Historial from "./Historial.jsx";
import Inventario from "./Inventario.jsx";
import FormularioProducto from "./FormularioProducto.jsx";
import Ventas from "./Ventas.jsx";
import Gastos from "./Gastos.jsx";
import Clientes from "./Clientes.jsx";
import Compras from "./Compras.jsx";
import Inversion from "./Inversion.jsx";
import CodigosAjuste from "./CodigosAjuste.jsx";
import Reportes from "./Reportes.jsx";
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
        descripcion: "Consulta tus productos, precios y stock: la mercadería nueva y la del 2025 por separado."
    },
    {
        clave: "registrar",
        icono: "➕",
        nombre: "Registrar producto",
        descripcion: "Agrega un producto nuevo con sus precios, stock, colores y foto.",
        soloJefe: true
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
        clave: "reportes",
        icono: "📈",
        nombre: "Reportes",
        descripcion: "Cierre de caja del día, ventas por empleado y los productos que más y menos se venden.",
        soloJefe: true
    },
    {
        clave: "clientes",
        icono: "🧑‍🤝‍🧑",
        nombre: "Clientes y fiados",
        descripcion: "Guarda a tus clientes frecuentes y controla lo que deben por ventas fiadas."
    },
    {
        clave: "compras",
        icono: "🚚",
        nombre: "Compras",
        descripcion: "Ingresa la mercadería que llega: suma al stock y queda como inversión o gasto.",
        soloJefe: true
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
        descripcion: "Organiza el catálogo por secciones (ferias), edita la página web (nosotros, valores, promociones) y crea las fotos.",
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
        clave: "ajustes",
        icono: "🏷️",
        nombre: "Códigos de descuento",
        descripcion: "Crea los códigos que les das a los empleados para descontar del total de una venta.",
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

    const recargarInventario = useCallback(
        () => Promise.all([cargarProductos(), cargarResumen(), cargarAlertas()]),
        [cargarProductos, cargarResumen, cargarAlertas]
    );

    // El historial se carga por partes en su propia pantalla.
    const recargarTodo = recargarInventario;

    useEffect(() => {
        recargarTodo();
    }, [recargarTodo]);

    function cambiarVista(nueva) {
        setVista(nueva);
        setMenuAbierto(false);
        window.scrollTo({ top: 0 });

        if (nueva === "ventas" || nueva === "inventario" || nueva === "compras") {
            cargarProductos();
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
                            onError={manejarError}
                        />
                    )}

                    {vistaActual.clave === "inventario" && (
                        <Inventario
                            esJefe={esJefe}
                            productos={productos}
                            errorProductos={errorProductos}
                            onCambio={recargarInventario}
                            onRegistrar={() => cambiarVista("registrar")}
                            onError={manejarError}
                        />
                    )}

                    {vistaActual.clave === "registrar" && (
                        <div className="contenido-vista">
                            <FormularioProducto onCreado={recargarInventario} onError={manejarError} />
                        </div>
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
                        <Historial esJefe={esJefe} onCambio={recargarInventario} onError={manejarError} />
                    )}

                    {vistaActual.clave === "clientes" && (
                        <Clientes esJefe={esJefe} onError={manejarError} />
                    )}

                    {vistaActual.clave === "compras" && (
                        <Compras productos={productos} onCambio={recargarInventario} onError={manejarError} />
                    )}

                    {vistaActual.clave === "gastos" && (
                        <Gastos onCambio={cargarResumen} onError={manejarError} />
                    )}

                    {vistaActual.clave === "inversion" && (
                        <Inversion resumen={resumen} onCambio={cargarResumen} onError={manejarError} />
                    )}

                    {vistaActual.clave === "reportes" && (
                        <Reportes onError={manejarError} />
                    )}

                    {vistaActual.clave === "ajustes" && (
                        <CodigosAjuste onError={manejarError} />
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
