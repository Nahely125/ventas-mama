import { useEffect, useMemo, useRef, useState } from "react";
import { moneda, pedir } from "../api.js";
import { urlFoto } from "../fotos.js";
import { iconoTema } from "../secciones.js";

const TODO = "todo";
const SIN_SECCION = { id: 0, nombre: "Más productos", descripcion: null, tema: "general" };

// "Feria Navideña" → "feria-navidena" (para el enlace #seccion).
function slug(texto) {
    return texto
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");
}

function TarjetaProductoCatalogo({ producto, onAbrir }) {
    const foto = urlFoto(producto);

    return (
        <li className={`cat-producto ${producto.disponible ? "" : "cat-agotado"}`}>
            <button type="button" className="cat-producto-boton" onClick={() => onAbrir(producto)}>
                <span className="cat-foto">
                    {foto ? (
                        <img src={foto} alt="" loading="lazy" />
                    ) : (
                        <span className="cat-sin-foto" aria-hidden="true">✦</span>
                    )}
                    {!producto.disponible && <span className="cat-etiqueta">Agotado</span>}
                </span>
                <span className="cat-producto-datos">
                    <span className="cat-producto-nombre">{producto.nombre}</span>
                    <span className="cat-producto-precio">
                        {moneda(producto.precioMinimo)} <small>c/u</small>
                    </span>
                    <span className="cat-producto-docena">Docena {moneda(producto.precioDocena)}</span>
                </span>
            </button>
        </li>
    );
}

function Banner({ seccion, total, onVer }) {
    return (
        <section className={`cat-banner cat-tema-${seccion.tema}`}>
            <div className="cat-banner-texto">
                <span className="cat-banner-icono" aria-hidden="true">{iconoTema(seccion.tema)}</span>
                <p className="cat-banner-sobre">Mil Deseos presenta</p>
                <h2>{seccion.nombre}</h2>
                {seccion.descripcion && <p className="cat-banner-frase">{seccion.descripcion}</p>}
                <button type="button" className="cat-boton-claro" onClick={onVer}>
                    Ver {total} {total === 1 ? "producto" : "productos"}
                </button>
            </div>
        </section>
    );
}

// Página pública del catálogo, organizada por secciones (ferias). No necesita iniciar sesión.
export default function Catalogo() {
    const [datos, setDatos] = useState(null);
    const [error, setError] = useState("");
    const [activa, setActiva] = useState(() => window.location.hash.slice(1) || null);
    const [busqueda, setBusqueda] = useState("");
    const [buscando, setBuscando] = useState(false);
    const [soloDisponibles, setSoloDisponibles] = useState(false);
    const [detalle, setDetalle] = useState(null);
    const grilla = useRef(null);
    const campoBusqueda = useRef(null);

    useEffect(() => {
        document.title = "Catálogo | Mil Deseos";

        pedir("/api/publico/catalogo")
            .then(setDatos)
            .catch((err) => setError(err.message));
    }, []);

    // Secciones con productos; los productos sin sección van al final.
    const secciones = useMemo(() => {
        if (!datos) return [];

        const lista = datos.secciones.map((seccion) => ({
            ...seccion,
            slug: slug(seccion.nombre),
            productos: datos.productos.filter((p) => p.seccionId === seccion.id)
        }));

        const sueltos = datos.productos.filter(
            (p) => p.seccionId === null || !datos.secciones.some((s) => s.id === p.seccionId)
        );

        if (sueltos.length > 0) {
            lista.push({ ...SIN_SECCION, slug: "mas-productos", productos: sueltos });
        }

        return lista.filter((seccion) => seccion.productos.length > 0 || seccion.id !== 0);
    }, [datos]);

    // Sección elegida: la del enlace (#...) o la primera; "todo" muestra todas.
    const claveActiva = activa === TODO || secciones.some((s) => s.slug === activa)
        ? activa
        : secciones[0]?.slug ?? TODO;

    function elegir(clave) {
        setActiva(clave);
        setBusqueda("");
        history.replaceState(null, "", `#${clave}`);
        window.scrollTo({ top: 0, behavior: "smooth" });
    }

    function abrirBusqueda() {
        setBuscando((valor) => !valor);
        setTimeout(() => campoBusqueda.current?.focus(), 50);
    }

    const texto = busqueda.trim().toLowerCase();
    const coincide = (producto) =>
        (!soloDisponibles || producto.disponible) &&
        (!texto ||
            producto.nombre.toLowerCase().includes(texto) ||
            (producto.codigo ?? "").toLowerCase().includes(texto));

    const visibles = texto || claveActiva === TODO
        ? secciones
        : secciones.filter((s) => s.slug === claveActiva);

    const bloques = visibles
        .map((seccion) => ({ ...seccion, filtrados: seccion.productos.filter(coincide) }))
        .filter((seccion) => seccion.filtrados.length > 0);

    const seccionBanner = !texto && claveActiva !== TODO
        ? secciones.find((s) => s.slug === claveActiva)
        : null;

    const anuncio = secciones.find((s) => s.id !== 0);

    return (
        <div className="cat-pagina">
            <div className="cat-anuncio">
                {anuncio
                    ? `✦ ${anuncio.nombre} · Precios especiales por docena ✦`
                    : "✦ Bienvenida a Mil Deseos ✦"}
            </div>

            <header className="cat-cabecera">
                <div className="cat-cabecera-fila">
                    <button
                        type="button"
                        className="cat-icono-boton"
                        onClick={abrirBusqueda}
                        aria-label="Buscar productos"
                        aria-expanded={buscando}
                    >
                        <svg viewBox="0 0 24 24" aria-hidden="true">
                            <circle cx="11" cy="11" r="7" />
                            <path d="m20 20-3.5-3.5" />
                        </svg>
                    </button>

                    <a className="cat-logo" href="/catalogo" onClick={(e) => { e.preventDefault(); elegir(secciones[0]?.slug ?? TODO); }}>
                        Mil Deseos
                    </a>

                    <span className="cat-icono-boton cat-espaciador" aria-hidden="true"></span>
                </div>

                {buscando && (
                    <div className="cat-busqueda">
                        <input
                            ref={campoBusqueda}
                            type="search"
                            placeholder="¿Qué estás buscando?"
                            aria-label="Buscar por nombre o código"
                            value={busqueda}
                            onChange={(e) => setBusqueda(e.target.value)}
                        />
                    </div>
                )}

                {secciones.length > 0 && (
                    <nav className="cat-nav" aria-label="Secciones del catálogo">
                        <ul>
                            {secciones.map((seccion) => (
                                <li key={seccion.slug}>
                                    <button
                                        type="button"
                                        className={claveActiva === seccion.slug && !texto ? "activa" : ""}
                                        aria-current={claveActiva === seccion.slug && !texto ? "page" : undefined}
                                        onClick={() => elegir(seccion.slug)}
                                    >
                                        {seccion.nombre}
                                    </button>
                                </li>
                            ))}
                            {secciones.length > 1 && (
                                <li>
                                    <button
                                        type="button"
                                        className={claveActiva === TODO && !texto ? "activa" : ""}
                                        onClick={() => elegir(TODO)}
                                    >
                                        Ver todo
                                    </button>
                                </li>
                            )}
                        </ul>
                    </nav>
                )}
            </header>

            <main className="cat-contenido">
                {error ? (
                    <p className="mensaje mensaje-error cat-centrado">{error}</p>
                ) : datos === null ? (
                    <p className="cargando-imagen cat-centrado">
                        <span className="spinner" aria-hidden="true"></span> Cargando catálogo...
                    </p>
                ) : (
                    <>
                        {seccionBanner && (
                            <Banner
                                seccion={seccionBanner}
                                total={seccionBanner.productos.length}
                                onVer={() => grilla.current?.scrollIntoView({ behavior: "smooth" })}
                            />
                        )}

                        <div className="cat-filtros" ref={grilla}>
                            <p>
                                {texto
                                    ? `Resultados para “${busqueda.trim()}”`
                                    : claveActiva === TODO
                                        ? "Todo el catálogo"
                                        : seccionBanner?.nombre}
                            </p>
                            <label className="cat-chip">
                                <input
                                    type="checkbox"
                                    checked={soloDisponibles}
                                    onChange={(e) => setSoloDisponibles(e.target.checked)}
                                />
                                Solo disponibles
                            </label>
                        </div>

                        {bloques.length === 0 ? (
                            <p className="cat-vacio">
                                {texto
                                    ? "No encontramos productos con esa búsqueda."
                                    : "Pronto tendremos productos en esta sección. ✦"}
                            </p>
                        ) : (
                            bloques.map((seccion) => (
                                <section key={seccion.slug} className="cat-bloque" aria-label={seccion.nombre}>
                                    {(bloques.length > 1 || claveActiva === TODO || texto) && (
                                        <h2 className="cat-bloque-titulo">
                                            {seccion.nombre}
                                            <span>{seccion.filtrados.length}</span>
                                        </h2>
                                    )}
                                    <ul className="cat-grilla">
                                        {seccion.filtrados.map((producto) => (
                                            <TarjetaProductoCatalogo
                                                key={producto.id}
                                                producto={producto}
                                                onAbrir={setDetalle}
                                            />
                                        ))}
                                    </ul>
                                </section>
                            ))
                        )}
                    </>
                )}
            </main>

            <footer className="cat-pie">
                <span className="cat-logo cat-logo-pie">Mil Deseos</span>
                <p>Precios en soles (S/). Consulta disponibilidad antes de tu compra.</p>
            </footer>

            {detalle && <DetalleProducto producto={detalle} onCerrar={() => setDetalle(null)} />}
        </div>
    );
}

function DetalleProducto({ producto, onCerrar }) {
    const dialogo = useRef(null);
    const foto = urlFoto(producto);

    useEffect(() => {
        dialogo.current?.showModal();
    }, []);

    return (
        <dialog
            ref={dialogo}
            className="modal cat-detalle"
            onClose={onCerrar}
            onClick={(e) => e.target === dialogo.current && onCerrar()}
            aria-label={producto.nombre}
        >
            <div className="cat-detalle-contenido">
                <button type="button" className="boton-cerrar-modal cat-detalle-cerrar" onClick={onCerrar} aria-label="Cerrar">
                    ✕
                </button>
                <div className="cat-detalle-foto">
                    {foto ? <img src={foto} alt={producto.nombre} /> : <span aria-hidden="true">✦</span>}
                </div>
                <div className="cat-detalle-datos">
                    {producto.codigo && <span className="cat-codigo">Código {producto.codigo}</span>}
                    <h2>{producto.nombre}</h2>
                    <dl>
                        <div>
                            <dt>Por unidad</dt>
                            <dd>{moneda(producto.precioMinimo)}</dd>
                        </div>
                        <div>
                            <dt>Por docena</dt>
                            <dd>{moneda(producto.precioDocena)}</dd>
                        </div>
                    </dl>
                    <p className={producto.disponible ? "cat-disponible" : "cat-no-disponible"}>
                        {producto.disponible ? "● Disponible" : "● Agotado por ahora"}
                    </p>
                </div>
            </div>
        </dialog>
    );
}
