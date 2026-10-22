import { useEffect, useMemo, useRef, useState } from "react";
import { moneda, pedir } from "../api.js";
import { urlFoto } from "../fotos.js";
import { iconoTema } from "../secciones.js";
import { WHATSAPP_NEGOCIO } from "../datosPago.js";
import CarritoCatalogo, { detalleCarrito, precioCatalogo, useCarrito } from "./CarritoCatalogo.jsx";

// Enlace para pedir un producto por WhatsApp con el mensaje ya escrito.
function enlacePedido(producto) {
    const mensaje = [
        "Hola Mil Deseos 👋 Quiero pedir:",
        `• ${producto.nombre}${producto.codigo ? ` (código ${producto.codigo})` : ""}`,
        `Precio: ${moneda(producto.precioMinimo)} c/u · Media docena ${moneda(precioCatalogo(producto, "media"))} · Docena ${moneda(producto.precioMinimoDocena)}`,
        "¿Cuántas unidades tienen disponibles?",
        `Lo vi en el catálogo: ${window.location.origin}/catalogo`
    ].join("\n");

    return `https://wa.me/${WHATSAPP_NEGOCIO}?text=${encodeURIComponent(mensaje)}`;
}

function BotonPedir({ producto, grande = false }) {
    return (
        <a
            className={`cat-pedir ${grande ? "cat-pedir-grande" : ""}`}
            href={enlacePedido(producto)}
            target="_blank"
            rel="noopener"
            aria-label={`Pedir ${producto.nombre} por WhatsApp`}
        >
            <span aria-hidden="true">💬</span> {grande ? "Pedir por WhatsApp" : "Pedir solo este por WhatsApp"}
        </a>
    );
}

const TODO = "todo";
const OTROS = "otros";
const SIN_SECCION = { id: 0, nombre: "Más productos", descripcion: null, tema: "general", categorias: [] };

// "Feria Navideña" → "feria-navidena" (para el enlace #seccion/categoria).
function slug(texto) {
    return texto
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");
}

function leerHash() {
    const [seccion = null, categoria = null] = decodeURIComponent(window.location.hash.slice(1)).split("/");
    return { seccion: seccion || null, categoria: categoria || null };
}

// Botón para sumar el producto al pedido; muestra cuántas unidades ya lleva.
function BotonAgregar({ producto, enPedido, onAgregar, grande = false }) {
    const [recien, setRecien] = useState(false);

    useEffect(() => {
        if (!recien) return undefined;
        const espera = setTimeout(() => setRecien(false), 1200);
        return () => clearTimeout(espera);
    }, [recien]);

    if (!producto.disponible) {
        return (
            <button type="button" className={`cat-agregar ${grande ? "cat-agregar-grande" : ""}`} disabled>
                Agotado
            </button>
        );
    }

    return (
        <button
            type="button"
            className={`cat-agregar ${grande ? "cat-agregar-grande" : ""} ${enPedido ? "en-pedido" : ""}`}
            onClick={() => {
                onAgregar(producto);
                setRecien(true);
            }}
            aria-label={`Agregar ${producto.nombre} al pedido`}
        >
            {recien ? "✓ Agregado" : enPedido ? `🛒 Agregar otro (${enPedido})` : grande ? "🛒 Agregar al pedido" : "🛒 Agregar"}
        </button>
    );
}

function TarjetaProductoCatalogo({ producto, onAbrir, enPedido, onAgregar }) {
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
                    <span className="cat-producto-docena">Docena {moneda(producto.precioMinimoDocena)}</span>
                </span>
            </button>
            <BotonAgregar producto={producto} enPedido={enPedido} onAgregar={onAgregar} />
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

function Grilla({ productos, onAbrir, enPedido, onAgregar }) {
    return (
        <ul className="cat-grilla">
            {productos.map((producto) => (
                <TarjetaProductoCatalogo
                    key={producto.id}
                    producto={producto}
                    onAbrir={onAbrir}
                    enPedido={enPedido(producto.id)}
                    onAgregar={onAgregar}
                />
            ))}
        </ul>
    );
}

// Página pública del catálogo: secciones (ferias) → categorías → productos. No necesita iniciar sesión.
export default function Catalogo() {
    const [datos, setDatos] = useState(null);
    const [error, setError] = useState("");
    const [ruta, setRuta] = useState(leerHash);
    const [busqueda, setBusqueda] = useState("");
    const [buscando, setBuscando] = useState(false);
    const [soloDisponibles, setSoloDisponibles] = useState(false);
    const [detalle, setDetalle] = useState(null);
    const [viendoPedido, setViendoPedido] = useState(false);
    const carrito = useCarrito();
    const listado = useRef(null);
    const campoBusqueda = useRef(null);

    useEffect(() => {
        document.title = "Catálogo | Mil Deseos";

        pedir("/api/publico/catalogo")
            .then(setDatos)
            .catch((err) => setError(err.message));
    }, []);

    // Secciones con sus categorías y productos. Los productos sin sección van a "Más productos";
    // los que no tienen categoría, a "Otros" dentro de su sección.
    const secciones = useMemo(() => {
        if (!datos) return [];

        const lista = datos.secciones.map((seccion) => {
            const productos = datos.productos.filter((p) => p.seccionId === seccion.id);
            const categorias = seccion.categorias
                .map((categoria) => ({
                    ...categoria,
                    slug: slug(categoria.nombre),
                    productos: productos.filter((p) => p.categoriaId === categoria.id)
                }))
                .filter((categoria) => categoria.productos.length > 0);

            const sinCategoria = productos.filter((p) => !categorias.some((c) => c.id === p.categoriaId));

            if (sinCategoria.length > 0 && categorias.length > 0) {
                categorias.push({ id: -seccion.id, nombre: "Otros", icono: "🛍️", slug: OTROS, productos: sinCategoria });
            }

            return { ...seccion, slug: slug(seccion.nombre), productos, categorias };
        });

        const sueltos = datos.productos.filter(
            (p) => p.seccionId === null || !datos.secciones.some((s) => s.id === p.seccionId)
        );

        if (sueltos.length > 0) {
            lista.push({ ...SIN_SECCION, slug: "mas-productos", productos: sueltos, categorias: [] });
        }

        return lista;
    }, [datos]);

    // Pedido: solo cuenta lo que sigue en el catálogo.
    const pedido = detalleCarrito(carrito.lineas, datos?.productos ?? []);
    const enPedido = (id) => pedido.items.filter((i) => i.id === id).reduce((suma, i) => suma + i.cantidad, 0);
    const agregar = (producto) => carrito.agregar(producto);

    // Sección elegida: la del enlace o la primera; "todo" muestra todas.
    const seccionClave = ruta.seccion === TODO || secciones.some((s) => s.slug === ruta.seccion)
        ? ruta.seccion
        : secciones[0]?.slug ?? TODO;
    const seccionActiva = secciones.find((s) => s.slug === seccionClave) ?? null;
    const categoriaActiva = seccionActiva?.categorias.find((c) => c.slug === ruta.categoria) ?? null;

    function ir(seccion, categoria = null, desplazar = true) {
        setRuta({ seccion, categoria });
        setBusqueda("");
        history.replaceState(null, "", `#${seccion}${categoria ? `/${categoria}` : ""}`);

        if (desplazar && categoria) {
            setTimeout(() => listado.current?.scrollIntoView({ behavior: "smooth" }), 30);
        } else {
            window.scrollTo({ top: 0, behavior: "smooth" });
        }
    }

    function abrirBusqueda() {
        setBuscando((valor) => !valor);
        setTimeout(() => campoBusqueda.current?.focus(), 50);
    }

    const texto = busqueda.trim().toLowerCase();
    const filtrar = (productos) => productos.filter((p) => !soloDisponibles || p.disponible);

    // Búsqueda: nombre, código o categoría, en todas las secciones.
    const resultados = texto
        ? secciones.flatMap((seccion) =>
            seccion.productos.filter((p) => {
                const categoria = seccion.categorias.find((c) => c.id === p.categoriaId);
                return (
                    p.nombre.toLowerCase().includes(texto) ||
                    (p.codigo ?? "").toLowerCase().includes(texto) ||
                    (categoria?.nombre ?? "").toLowerCase().includes(texto)
                );
            }))
        : [];

    // Bloques a mostrar (título + productos).
    let bloques;

    if (texto) {
        bloques = [{ clave: "busqueda", titulo: null, productos: filtrar(resultados) }];
    } else if (seccionClave === TODO) {
        bloques = secciones.flatMap((seccion) =>
            seccion.categorias.length
                ? seccion.categorias.map((c) => ({
                    clave: `${seccion.slug}-${c.slug}`,
                    titulo: `${c.icono ?? ""} ${c.nombre}`,
                    subtitulo: seccion.nombre,
                    productos: filtrar(c.productos)
                }))
                : [{ clave: seccion.slug, titulo: seccion.nombre, productos: filtrar(seccion.productos) }]
        );
    } else if (categoriaActiva) {
        bloques = [{ clave: categoriaActiva.slug, titulo: null, productos: filtrar(categoriaActiva.productos) }];
    } else if (seccionActiva?.categorias.length) {
        bloques = seccionActiva.categorias.map((c) => ({
            clave: c.slug,
            titulo: `${c.icono ?? ""} ${c.nombre}`,
            categoria: c,
            productos: filtrar(c.productos)
        }));
    } else {
        bloques = [{ clave: "seccion", titulo: null, productos: filtrar(seccionActiva?.productos ?? []) }];
    }

    bloques = bloques.filter((b) => b.productos.length > 0);

    const mostrarBanner = !texto && seccionActiva && !categoriaActiva;
    const anuncio = secciones.find((s) => s.id !== 0);
    const tituloListado = texto
        ? `Resultados para “${busqueda.trim()}”`
        : seccionClave === TODO
            ? "Todo el catálogo"
            : categoriaActiva
                ? `${categoriaActiva.icono ?? ""} ${categoriaActiva.nombre}`
                : seccionActiva?.nombre;

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

                    <a className="cat-logo" href="/catalogo" onClick={(e) => { e.preventDefault(); ir(secciones[0]?.slug ?? TODO); }}>
                        Mil Deseos
                    </a>

                    <button
                        type="button"
                        className="cat-icono-boton cat-boton-pedido"
                        onClick={() => setViendoPedido(true)}
                        aria-label={`Ver mi pedido (${pedido.piezas} ${pedido.piezas === 1 ? "producto" : "productos"})`}
                    >
                        <svg viewBox="0 0 24 24" aria-hidden="true">
                            <path d="M5 8h14l-1.2 11.2a2 2 0 0 1-2 1.8H8.2a2 2 0 0 1-2-1.8z" />
                            <path d="M9 8V6.5a3 3 0 0 1 6 0V8" />
                        </svg>
                        {pedido.piezas > 0 && <span className="cat-contador">{pedido.piezas}</span>}
                    </button>
                </div>

                {buscando && (
                    <div className="cat-busqueda">
                        <input
                            ref={campoBusqueda}
                            type="search"
                            placeholder="Busca: árbol, luces, reno, cascanueces..."
                            aria-label="Buscar por nombre, código o categoría"
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
                                        className={seccionClave === seccion.slug && !texto ? "activa" : ""}
                                        aria-current={seccionClave === seccion.slug && !texto ? "page" : undefined}
                                        onClick={() => ir(seccion.slug)}
                                    >
                                        {seccion.nombre}
                                    </button>
                                </li>
                            ))}
                            {secciones.length > 1 && (
                                <li>
                                    <button
                                        type="button"
                                        className={seccionClave === TODO && !texto ? "activa" : ""}
                                        onClick={() => ir(TODO)}
                                    >
                                        Ver todo
                                    </button>
                                </li>
                            )}
                        </ul>
                    </nav>
                )}

                {/* Barra de categorías de la sección: siempre a la vista para saltar rápido. */}
                {!texto && seccionActiva?.categorias.length > 0 && (
                    <nav className="cat-subnav" aria-label={`Categorías de ${seccionActiva.nombre}`}>
                        <ul>
                            <li>
                                <button
                                    type="button"
                                    className={!categoriaActiva ? "activa" : ""}
                                    onClick={() => ir(seccionActiva.slug, null)}
                                >
                                    Todas
                                </button>
                            </li>
                            {seccionActiva.categorias.map((categoria) => (
                                <li key={categoria.slug}>
                                    <button
                                        type="button"
                                        className={categoriaActiva?.slug === categoria.slug ? "activa" : ""}
                                        onClick={() => ir(seccionActiva.slug, categoria.slug)}
                                    >
                                        <span aria-hidden="true">{categoria.icono}</span> {categoria.nombre}
                                    </button>
                                </li>
                            ))}
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
                        {mostrarBanner && (
                            <Banner
                                seccion={seccionActiva}
                                total={seccionActiva.productos.length}
                                onVer={() => listado.current?.scrollIntoView({ behavior: "smooth" })}
                            />
                        )}

                        {/* Tarjetas "Compra por categoría" */}
                        {mostrarBanner && seccionActiva.categorias.length > 1 && (
                            <section className="cat-categorias" aria-label="Compra por categoría">
                                <h2 className="cat-titulo-centrado">Compra por categoría</h2>
                                <ul>
                                    {seccionActiva.categorias.map((categoria) => (
                                        <li key={categoria.slug}>
                                            <button type="button" onClick={() => ir(seccionActiva.slug, categoria.slug)}>
                                                <span className="cat-categoria-icono" aria-hidden="true">{categoria.icono}</span>
                                                <span className="cat-categoria-nombre">{categoria.nombre}</span>
                                                <span className="cat-categoria-total">
                                                    {categoria.productos.length} {categoria.productos.length === 1 ? "producto" : "productos"}
                                                </span>
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                            </section>
                        )}

                        <div className="cat-filtros" ref={listado}>
                            <p>{tituloListado}</p>
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
                                    : "Pronto tendremos productos aquí. ✦"}
                            </p>
                        ) : (
                            bloques.map((bloque) => (
                                <section key={bloque.clave} className="cat-bloque" aria-label={bloque.titulo ?? tituloListado}>
                                    {bloque.titulo && (
                                        <h2 className="cat-bloque-titulo">
                                            {bloque.titulo}
                                            {bloque.subtitulo && <em>{bloque.subtitulo}</em>}
                                            <span>{bloque.productos.length}</span>
                                            {bloque.categoria && (
                                                <button
                                                    type="button"
                                                    className="cat-ver-mas"
                                                    onClick={() => ir(seccionActiva.slug, bloque.categoria.slug)}
                                                >
                                                    Ver solo esta →
                                                </button>
                                            )}
                                        </h2>
                                    )}
                                    <Grilla productos={bloque.productos} onAbrir={setDetalle} enPedido={enPedido} onAgregar={agregar} />
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

            {pedido.piezas > 0 && !viendoPedido && (
                <button type="button" className="cat-barra-pedido" onClick={() => setViendoPedido(true)}>
                    <span>🛒 Ver mi pedido ({pedido.piezas})</span>
                    <strong>{moneda(pedido.total)}</strong>
                </button>
            )}

            {detalle && (
                <DetalleProducto
                    producto={detalle}
                    enPedido={enPedido(detalle.id)}
                    onAgregar={agregar}
                    onCerrar={() => setDetalle(null)}
                />
            )}

            {viendoPedido && (
                <CarritoCatalogo carrito={carrito} productos={datos?.productos ?? []} onCerrar={() => setViendoPedido(false)} />
            )}
        </div>
    );
}

function DetalleProducto({ producto, enPedido, onAgregar, onCerrar }) {
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
                            <dt>Por media docena</dt>
                            <dd>{moneda(precioCatalogo(producto, "media"))}</dd>
                        </div>
                        <div>
                            <dt>Por docena</dt>
                            <dd>{moneda(producto.precioMinimoDocena)}</dd>
                        </div>
                    </dl>
                    <p className={producto.disponible ? "cat-disponible" : "cat-no-disponible"}>
                        {producto.disponible ? "● Disponible" : "● Agotado por ahora"}
                    </p>
                    {(producto.colores ?? []).length > 0 && (
                        <div className="cat-colores">
                            <span>Colores</span>
                            <ul>
                                {producto.colores.map((color) => (
                                    <li key={color.nombre} className={color.disponible ? "" : "agotado"} title={color.disponible ? "Disponible" : "Agotado"}>
                                        {color.nombre}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                    <BotonAgregar producto={producto} enPedido={enPedido} onAgregar={onAgregar} grande />
                    <BotonPedir producto={producto} />
                </div>
            </div>
        </dialog>
    );
}
