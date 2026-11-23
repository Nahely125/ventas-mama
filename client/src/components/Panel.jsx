import { lazy, Suspense, useCallback, useEffect, useRef, useState } from "react";
import { pedir } from "../api.js";
import Encabezado from "./Encabezado.jsx";
import Cajonera from "./Cajonera.jsx";
import PanelControl from "./PanelControl.jsx";

// Cada sección se descarga la primera vez que se abre: la app inicia más rápido en el celular.
const Historial = lazy(() => import("./Historial.jsx"));
const Inventario = lazy(() => import("./Inventario.jsx"));
const FormularioProducto = lazy(() => import("./FormularioProducto.jsx"));
const Ventas = lazy(() => import("./Ventas.jsx"));
const Gastos = lazy(() => import("./Gastos.jsx"));
const Clientes = lazy(() => import("./Clientes.jsx"));
const Compras = lazy(() => import("./Compras.jsx"));
const Inversion = lazy(() => import("./Inversion.jsx"));
const CodigosAjuste = lazy(() => import("./CodigosAjuste.jsx"));
const Reportes = lazy(() => import("./Reportes.jsx"));
const Empleados = lazy(() => import("./Empleados.jsx"));
const SeccionesCatalogo = lazy(() => import("./SeccionesCatalogo.jsx"));
const Reposicion = lazy(() => import("./Reposicion.jsx"));
const Prestamos = lazy(() => import("./Prestamos.jsx"));
const Mermas = lazy(() => import("./Mermas.jsx"));

function CargandoVista() {
    return (
        <p className="cargando-vista" role="status">
            <span className="spinner" aria-hidden="true"></span> Cargando...
        </p>
    );
}

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
        clave: "reposicion",
        icono: "📝",
        nombre: "Por reponer",
        descripcion: "Arma la lista de lo que hay que comprar, mira cuánto costaría y marca lo que se adquirió.",
        soloJefe: true
    },
    {
        clave: "mermas",
        icono: "💔",
        nombre: "Rotos y faltantes",
        descripcion: "Cuánta mercadería se rompe o falta, si el proveedor la cambió (vuelve al stock) o si quedó como pérdida.",
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
        clave: "prestamos",
        icono: "🏦",
        nombre: "Préstamos",
        descripcion: "Registra el capital financiado, en qué se usó (inversión o gasto) y lo que falta pagar.",
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

// Cada cuánto se vuelve a pedir la lista de productos y el resumen al cambiar de pantalla.
const RECARGAR_PRODUCTOS_MS = 60 * 1000;
const RECARGAR_RESUMEN_MS = 30 * 1000;

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
    // Venta en curso: se arma en «Registrar venta» o desde el inventario, y no se pierde al cambiar de pantalla.
    const [carritoVenta, setCarritoVenta] = useState([]);
    const agregarAVenta = useCallback((items) => setCarritoVenta((anterior) => [...anterior, ...items]), []);

    // Si el servidor responde 401, la sesión expiró o la cuenta fue desactivada: volver al login.
    const manejarError = useCallback((error, mostrarError) => {
        if (error.estado === 401) {
            onSalir();
            return;
        }
        console.error(error);
        mostrarError?.();
    }, [onSalir]);

    /* Cuándo se cargó por última vez cada cosa: al cambiar de pantalla no se vuelve a pedir lo que
       se cargó hace muy poco (después de vender, comprar o editar siempre se recarga). */
    const cargadoEn = useRef({ productos: 0, resumen: 0 });

    const cargarProductos = useCallback(async () => {
        try {
            setProductos(await pedir("/api/productos"));
            cargadoEn.current.productos = Date.now();
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
            cargadoEn.current.resumen = Date.now();
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

    // Al volver a la app (por ejemplo, después de usar WhatsApp) se actualiza si pasó un rato.
    useEffect(() => {
        function alVolver() {
            if (document.visibilityState === "visible" && Date.now() - cargadoEn.current.productos > RECARGAR_PRODUCTOS_MS) {
                recargarTodo();
            }
        }

        document.addEventListener("visibilitychange", alVolver);
        return () => document.removeEventListener("visibilitychange", alVolver);
    }, [recargarTodo]);

    function cambiarVista(nueva) {
        setVista(nueva);
        setMenuAbierto(false);
        window.scrollTo({ top: 0 });

        const hace = (clave) => Date.now() - cargadoEn.current[clave];

        if ((nueva === "ventas" || nueva === "inventario" || nueva === "compras") && hace("productos") > RECARGAR_PRODUCTOS_MS) {
            cargarProductos();
        }

        if (nueva === "panel" && hace("resumen") > RECARGAR_RESUMEN_MS) {
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

                    <Suspense fallback={<CargandoVista />}>
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
                            onReponer={() => cambiarVista("reposicion")}
                            carritoVenta={carritoVenta}
                            onAgregarVenta={agregarAVenta}
                            onIrAVenta={() => cambiarVista("ventas")}
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
                            carrito={carritoVenta}
                            onCarrito={setCarritoVenta}
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

                    {vistaActual.clave === "mermas" && (
                        <Mermas productos={productos} onCambio={recargarInventario} onError={manejarError} />
                    )}

                    {vistaActual.clave === "reposicion" && (
                        <Reposicion productos={productos} onCambio={recargarInventario} onError={manejarError} />
                    )}

                    {vistaActual.clave === "gastos" && (
                        <Gastos onCambio={cargarResumen} onError={manejarError} />
                    )}

                    {vistaActual.clave === "prestamos" && (
                        <Prestamos onCambio={cargarResumen} onError={manejarError} />
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
                    </Suspense>
                </main>
            </div>
        </>
    );
}
