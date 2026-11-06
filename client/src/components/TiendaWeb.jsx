import { useEffect, useRef, useState } from "react";
import { moneda } from "../api.js";
import { urlFoto } from "../fotos.js";
import { iconoTema } from "../secciones.js";
import { BILLETERAS, RECARGO_TARJETA } from "../datosPago.js";
import { enlaceWhatsApp, telefonoLegible, urlImagenTienda } from "../tienda.js";
import { CarruselPortada, prefiereQuieto } from "./Carrusel.jsx";

/* Partes de la página web del catálogo (inspirada en las tiendas de moda en línea):
   barra de promociones, portada, "Nosotros", pie de página y ventana de bienvenida con el cupón. */

const CLAVE_BIENVENIDA = "mil-deseos-bienvenida";
const ICONOS_VALORES = ["💜", "✨", "🏷️", "🤝", "🎁", "🌟", "🎄", "📚"];

// "S/ 600.00" → "S/ 600" (los montos redondos se leen mejor sin decimales).
function montoCorto(valor) {
    return moneda(valor).replace(/.00$/, "");
}

function textoEnvio(tienda) {
    return `Envío gratis en compras mayores a ${montoCorto(tienda.envio.gratisDesde)}`;
}

// Mensajes de la barra superior (cupón, envío gratis y la feria del momento).
function mensajesPromocion(tienda, feria) {
    const mensajes = [];
    if (tienda?.cupon.activo) mensajes.push({ texto: `${tienda.cupon.porcentaje}% OFF en tu primera compra · Código ${tienda.cupon.codigo}`, cupon: true });
    if (tienda?.envio.activo) mensajes.push({ texto: textoEnvio(tienda) });
    if (feria) mensajes.push({ texto: `${feria.nombre} · Precios especiales por docena` });
    if (mensajes.length === 0) mensajes.push({ texto: "Bienvenida a Mil Deseos" });
    return mensajes;
}

// Barra superior con las promociones; cambia de mensaje cada pocos segundos.
export function BarraPromociones({ tienda, feria, onCupon }) {
    const mensajes = mensajesPromocion(tienda, feria);
    const [indice, setIndice] = useState(0);
    const [quieto] = useState(prefiereQuieto);
    // Con movimiento (y sin cupón que tocar): los mensajes pasan de derecha a izquierda sin parar.
    const desplazar = !quieto && !mensajes.some((m) => m.cupon);

    useEffect(() => {
        if (desplazar || mensajes.length < 2 || window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return undefined;
        const reloj = setInterval(() => setIndice((i) => (i + 1) % mensajes.length), 4500);
        return () => clearInterval(reloj);
    }, [mensajes.length, desplazar]);

    if (desplazar) {
        const vuelta = Array.from({ length: Math.max(2, 4 - mensajes.length) }, () => mensajes).flat();
        return (
            <div className="cat-anuncio cat-anuncio-movil" aria-label={mensajes.map((m) => m.texto).join(". ")}>
                <div className="cat-anuncio-pista" aria-hidden="true">
                    {[0, 1].map((copia) => (
                        <span key={copia} className="cat-anuncio-tramo">
                            {vuelta.map((m, i) => <span key={i}>✦ {m.texto}</span>)}
                        </span>
                    ))}
                </div>
            </div>
        );
    }

    const actual = mensajes[indice % mensajes.length];

    return (
        <div className="cat-anuncio" aria-live="off">
            {actual.cupon ? (
                <button type="button" className="cat-anuncio-boton" onClick={onCupon} key={indice}>
                    ✦ {actual.texto} ✦
                </button>
            ) : (
                <span key={indice} className="cat-anuncio-texto">✦ {actual.texto} ✦</span>
            )}
        </div>
    );
}

// Cuadro con el código del cupón y el botón para copiarlo.
function CodigoCupon({ codigo }) {
    const [copiado, setCopiado] = useState(false);

    async function copiar() {
        try {
            await navigator.clipboard.writeText(codigo);
            setCopiado(true);
            setTimeout(() => setCopiado(false), 1600);
        } catch {
            // Si el navegador no deja copiar, el código igual se ve en pantalla.
        }
    }

    return (
        <span className="cat-codigo-cupon">
            <strong>{codigo}</strong>
            <button type="button" onClick={copiar}>{copiado ? "¡Copiado!" : "Copiar"}</button>
        </span>
    );
}

// Promociones (cupón y envío gratis) en dos bloques grandes.
function BloquesPromocion({ tienda, onAplicarCupon }) {
    if (!tienda || (!tienda.cupon.activo && !tienda.envio.activo)) return null;

    return (
        <section className="cat-promos revelar" aria-label="Promociones">
            {tienda.cupon.activo && (
                <article className="cat-promo cat-promo-cupon">
                    <p className="cat-promo-sobre">Bienvenida a Mil Deseos</p>
                    <h2>
                        {tienda.cupon.porcentaje}% <span>OFF</span>
                    </h2>
                    <p>en tu primera compra</p>
                    <CodigoCupon codigo={tienda.cupon.codigo} />
                    <button type="button" className="cat-boton-claro" onClick={onAplicarCupon}>
                        Aplicar a mi pedido
                    </button>
                </article>
            )}
            {tienda.envio.activo && (
                <article className="cat-promo cat-promo-envio">
                    <p className="cat-promo-sobre">Te lo llevamos</p>
                    <h2>
                        Envío <span>gratis</span>
                    </h2>
                    <p>en compras mayores a {montoCorto(tienda.envio.gratisDesde)}</p>
                    <span className="cat-promo-icono" aria-hidden="true">🚚</span>
                </article>
            )}
        </section>
    );
}

// "Compra en 3 pasos": explica en un vistazo cómo se compra.
function PasosCompra() {
    const pasos = [
        { icono: "🛍️", titulo: "Elige", texto: "Toca «Agregar» en lo que te guste: por unidad, media docena o docena." },
        { icono: "🧾", titulo: "Revisa tu pedido", texto: "Mira el total y cuánto te falta para el envío gratis." },
        { icono: "💬", titulo: "Envíalo por WhatsApp", texto: "Te confirmamos stock y total, y coordinamos el pago y la entrega." }
    ];

    return (
        <section className="cat-pasos revelar" aria-labelledby="titulo-pasos">
            <h2 id="titulo-pasos" className="cat-titulo-centrado">Compra en 3 pasos</h2>
            <ol>
                {pasos.map((paso, i) => (
                    <li key={paso.titulo}>
                        <span className="cat-paso-icono" aria-hidden="true">{paso.icono}</span>
                        <span className="cat-paso-numero">Paso {i + 1}</span>
                        <strong>{paso.titulo}</strong>
                        <p>{paso.texto}</p>
                    </li>
                ))}
            </ol>
        </section>
    );
}

// Categorías de todo el catálogo, con la foto de uno de sus productos.
function CategoriasInicio({ categorias, onIr }) {
    if (categorias.length < 2) return null;

    return (
        <section className="cat-categorias-inicio revelar" aria-labelledby="titulo-categorias-inicio">
            <h2 id="titulo-categorias-inicio" className="cat-titulo-centrado">Compra por categoría</h2>
            <ul>
                {categorias.map((categoria) => (
                    <li key={`${categoria.seccion}-${categoria.slug}`}>
                        <button type="button" onClick={() => onIr(categoria.seccion, categoria.slug)}>
                            <span className="cat-categoria-circulo">
                                {categoria.foto ? (
                                    <img src={urlFoto(categoria.foto, "mini")} alt="" loading="lazy" />
                                ) : (
                                    <span aria-hidden="true">{categoria.icono ?? "✦"}</span>
                                )}
                            </span>
                            <span className="cat-categoria-nombre">{categoria.nombre}</span>
                            <small>{categoria.total} {categoria.total === 1 ? "producto" : "productos"}</small>
                        </button>
                    </li>
                ))}
            </ul>
        </section>
    );
}

// "Lo que dicen de nosotros": comentarios de clientes (solo si el jefe los agregó).
function Testimonios({ tienda }) {
    if (!tienda?.testimonios?.length) return null;

    return (
        <section className="cat-testimonios revelar" aria-labelledby="titulo-testimonios">
            <h2 id="titulo-testimonios" className="cat-titulo-centrado">Lo que dicen de nosotros</h2>
            <ul>
                {tienda.testimonios.map((t) => (
                    <li key={`${t.nombre}-${t.texto.slice(0, 20)}`}>
                        <span className="cat-estrellas" aria-hidden="true">★★★★★</span>
                        <blockquote>“{t.texto}”</blockquote>
                        <cite>— {t.nombre}</cite>
                    </li>
                ))}
            </ul>
        </section>
    );
}

// Preguntas frecuentes: se abren al tocarlas.
export function PreguntasFrecuentes({ tienda, id }) {
    if (!tienda?.preguntas?.length) return null;

    return (
        <section className="cat-preguntas revelar" id={id} aria-labelledby={`${id ?? "inicio"}-titulo-preguntas`}>
            <h2 id={`${id ?? "inicio"}-titulo-preguntas`} className="cat-titulo-centrado">Preguntas frecuentes</h2>
            <div>
                {tienda.preguntas.map((p) => (
                    <details key={p.pregunta}>
                        <summary>{p.pregunta}</summary>
                        <p>{p.respuesta}</p>
                    </details>
                ))}
            </div>
            <p className="cat-preguntas-mas">
                ¿Otra duda?{" "}
                <a href={enlaceWhatsApp("Hola Mil Deseos 👋 Tengo una consulta.")} target="_blank" rel="noopener">
                    Escríbenos por WhatsApp
                </a>
            </p>
        </section>
    );
}

// Botón redondo de WhatsApp, siempre a la vista.
export function BotonWhatsAppFlotante() {
    return (
        <a
            className="cat-whatsapp-flotante"
            href={enlaceWhatsApp("Hola Mil Deseos 👋 Tengo una consulta.")}
            target="_blank"
            rel="noopener"
            aria-label="Escríbenos por WhatsApp"
        >
            <svg viewBox="0 0 32 32" aria-hidden="true">
                <path d="M16 3a13 13 0 0 0-11.2 19.6L3 29l6.6-1.7A13 13 0 1 0 16 3Zm0 23.7a10.7 10.7 0 0 1-5.5-1.5l-.4-.2-3.9 1 1-3.8-.3-.4A10.7 10.7 0 1 1 16 26.7Zm5.9-8c-.3-.2-1.9-.9-2.2-1s-.5-.2-.7.2-.8 1-1 1.2-.4.2-.7 0a8.8 8.8 0 0 1-4.4-3.8c-.3-.6.3-.5 1-1.7.1-.2 0-.4 0-.6l-1-2.4c-.3-.6-.5-.5-.7-.5h-.6a1.2 1.2 0 0 0-.9.4 3.6 3.6 0 0 0-1.1 2.7 6.3 6.3 0 0 0 1.3 3.3 14.4 14.4 0 0 0 5.5 4.9c2 .9 2.8 1 3.9.8a3.3 3.3 0 0 0 2.2-1.5 2.7 2.7 0 0 0 .2-1.6c-.1-.1-.3-.2-.6-.4Z" />
            </svg>
        </a>
    );
}

// Portada: presentación, cómo comprar, categorías, más vendidos, novedades, comentarios y preguntas.
export function Portada({ tienda, secciones, categorias, destacados, masVendidos, grilla, carrusel, onIr, onAbrir, onAplicarCupon }) {
    const portada = urlImagenTienda(tienda, "portada");
    // Carrusel de la portada: la foto subida en «Página web» y fotos de productos (más vendidos y novedades).
    const conFoto = [...masVendidos, ...destacados]
        .filter((p, i, lista) => p.tieneFoto && lista.findIndex((x) => x.id === p.id) === i)
        .slice(0, portada ? 3 : 4);
    const diapositivas = [
        portada && { clave: "portada", src: portada },
        ...conFoto.map((p) => ({
            clave: p.id,
            src: urlFoto(p),
            titulo: p.nombre,
            detalle: `${moneda(p.precioMinimo)} c/u`,
            onVer: () => onAbrir(p)
        }))
    ].filter(Boolean);

    return (
        <>
            <section className={`cat-heroe ${diapositivas.length ? "cat-heroe-con-carrusel" : ""}`}>
                <CarruselPortada diapositivas={diapositivas} />
                <div className="cat-heroe-texto">
                    <p className="cat-banner-sobre">Nueva temporada</p>
                    <h1>Haz realidad tus deseos</h1>
                    <p className="cat-heroe-frase">
                        Adornos, luces, árboles, útiles y regalos para cada celebración. Por unidad, media docena o docena.
                    </p>
                    <div className="cat-heroe-acciones">
                        <button type="button" className="cat-boton-claro" onClick={() => onIr(secciones[0]?.slug ?? "todo")}>
                            Comprar ahora
                        </button>
                        <a className="cat-boton-borde" href="#nosotros" onClick={(e) => { e.preventDefault(); onIr("nosotros"); }}>
                            Conócenos
                        </a>
                    </div>
                </div>
            </section>

            <PasosCompra />

            <CategoriasInicio categorias={categorias} onIr={onIr} />

            {masVendidos.length > 0 && (
                <section className="cat-bloque cat-bloque-carrusel revelar" aria-label="Los más vendidos">
                    <h2 className="cat-titulo-centrado">Los más vendidos</h2>
                    {carrusel(masVendidos, "Los más vendidos")}
                </section>
            )}

            <BloquesPromocion tienda={tienda} onAplicarCupon={onAplicarCupon} />

            {secciones.length > 0 && (
                <section className="cat-ferias revelar" aria-label="Compra por feria">
                    <h2 className="cat-titulo-centrado">Compra por feria</h2>
                    <ul>
                        {secciones.map((seccion) => {
                            const conFoto = seccion.productos.find((p) => p.tieneFoto);
                            return (
                                <li key={seccion.slug}>
                                    <button type="button" className={`cat-feria cat-tema-${seccion.tema}`} onClick={() => onIr(seccion.slug)}>
                                        {conFoto && <img src={urlFoto(conFoto)} alt="" loading="lazy" />}
                                        <span className="cat-feria-texto">
                                            <span aria-hidden="true">{iconoTema(seccion.tema)}</span>
                                            <strong>{seccion.nombre}</strong>
                                            <small>{seccion.productos.length} {seccion.productos.length === 1 ? "producto" : "productos"} · Ver todo →</small>
                                        </span>
                                    </button>
                                </li>
                            );
                        })}
                    </ul>
                </section>
            )}

            {destacados.length > 0 && (
                <section className="cat-bloque cat-bloque-carrusel revelar" aria-label="Novedades">
                    <h2 className="cat-titulo-centrado">Novedades</h2>
                    {carrusel(destacados, "Novedades")}
                    <div className="cat-centrado">
                        <button type="button" className="cat-boton-oscuro" onClick={() => onIr("todo")}>
                            Ver todo el catálogo
                        </button>
                    </div>
                </section>
            )}

            <Testimonios tienda={tienda} />

            <PreguntasFrecuentes tienda={tienda} />

            {tienda && (
                <section className="cat-nosotros-breve revelar">
                    <div>
                        <p className="cat-banner-sobre">¿Quiénes somos?</p>
                        <h2>Un negocio familiar lleno de ilusión</h2>
                        <p>{tienda.quienesSomos}</p>
                        <button type="button" className="cat-boton-oscuro" onClick={() => onIr("nosotros")}>
                            Conoce más de nosotros
                        </button>
                    </div>
                    {tienda.valores.length > 0 && (
                        <ul className="cat-valores-breve" aria-label="Nuestros valores">
                            {tienda.valores.map((valor, i) => (
                                <li key={valor.titulo}>
                                    <span aria-hidden="true">{ICONOS_VALORES[i % ICONOS_VALORES.length]}</span>
                                    {valor.titulo}
                                </li>
                            ))}
                        </ul>
                    )}
                </section>
            )}
        </>
    );
}

function DatoEmpresa({ titulo, children }) {
    if (!children) return null;
    return (
        <div>
            <dt>{titulo}</dt>
            <dd>{children}</dd>
        </div>
    );
}

// Página "Nosotros": quiénes somos, misión y visión, valores, información corporativa,
// cómo comprar y promociones (con sus condiciones).
export function Nosotros({ tienda, apartado }) {
    useEffect(() => {
        if (apartado) {
            setTimeout(() => document.getElementById(`nosotros-${apartado}`)?.scrollIntoView({ behavior: "smooth" }), 60);
        } else {
            window.scrollTo({ top: 0 });
        }
    }, [apartado]);

    if (!tienda) {
        return <p className="cat-vacio">Cargando...</p>;
    }

    const empresa = tienda.empresa;

    return (
        <div className="cat-nosotros">
            <section className="cat-nosotros-cabecera" id="nosotros-quienes-somos">
                <p className="cat-banner-sobre">Mil Deseos</p>
                <h1>¿Quiénes somos?</h1>
                <p>{tienda.quienesSomos}</p>
            </section>

            {(tienda.mision || tienda.vision) && (
                <section className="cat-mision" id="nosotros-mision">
                    {tienda.mision && (
                        <article>
                            <h2>Nuestra misión</h2>
                            <p>{tienda.mision}</p>
                        </article>
                    )}
                    {tienda.vision && (
                        <article>
                            <h2>Nuestra visión</h2>
                            <p>{tienda.vision}</p>
                        </article>
                    )}
                </section>
            )}

            {tienda.valores.length > 0 && (
                <section className="cat-valores" id="nosotros-valores">
                    <h2 className="cat-titulo-centrado">Nuestros valores</h2>
                    <ul>
                        {tienda.valores.map((valor, i) => (
                            <li key={valor.titulo}>
                                <span className="cat-valor-icono" aria-hidden="true">{ICONOS_VALORES[i % ICONOS_VALORES.length]}</span>
                                <h3>{valor.titulo}</h3>
                                {valor.texto && <p>{valor.texto}</p>}
                            </li>
                        ))}
                    </ul>
                </section>
            )}

            <section className="cat-como-comprar" id="nosotros-como-comprar">
                <h2 className="cat-titulo-centrado">¿Cómo comprar?</h2>
                <ol>
                    <li><strong>Elige</strong> tus productos y agrégalos a tu pedido (por unidad, media docena o docena).</li>
                    {tienda.cupon.activo && <li><strong>Aplica</strong> tu cupón de primera compra, si lo tienes.</li>}
                    <li><strong>Envía</strong> tu pedido por WhatsApp: te confirmamos la disponibilidad y el total.</li>
                    <li>
                        <strong>Paga</strong> con {Object.values(BILLETERAS).map((b) => b.nombre).join(", ")}, transferencia o
                        tarjeta de débito o crédito (con nuestro POS Izipay, al recoger o al recibir tu pedido; con tarjeta
                        se suma {RECARGO_TARJETA}%), y coordinamos la entrega.
                    </li>
                </ol>
            </section>

            {(tienda.cupon.activo || tienda.envio.activo) && (
                <section className="cat-condiciones" id="nosotros-promociones">
                    <h2 className="cat-titulo-centrado">Promociones y envíos</h2>
                    <div>
                        {tienda.cupon.activo && (
                            <article>
                                <h3>🏷️ {tienda.cupon.porcentaje}% de descuento en tu primera compra</h3>
                                <p>
                                    Usa el código <strong>{tienda.cupon.codigo}</strong> en tu pedido. {tienda.cupon.condiciones}
                                </p>
                            </article>
                        )}
                        {tienda.envio.activo && (
                            <article>
                                <h3>🚚 {textoEnvio(tienda)}</h3>
                                <p>{tienda.envio.condiciones}</p>
                            </article>
                        )}
                    </div>
                </section>
            )}

            <PreguntasFrecuentes tienda={tienda} id="nosotros-preguntas" />

            <Testimonios tienda={tienda} />

            <section className="cat-empresa" id="nosotros-empresa">
                <h2 className="cat-titulo-centrado">Información corporativa</h2>
                <dl>
                    <DatoEmpresa titulo="Razón social">{empresa.razonSocial}</DatoEmpresa>
                    <DatoEmpresa titulo="RUC">{empresa.ruc}</DatoEmpresa>
                    <DatoEmpresa titulo="Dirección">{empresa.direccion}</DatoEmpresa>
                    <DatoEmpresa titulo="Horario de atención">{empresa.horario}</DatoEmpresa>
                    <DatoEmpresa titulo="WhatsApp">
                        <a href={enlaceWhatsApp()} target="_blank" rel="noopener">{telefonoLegible()}</a>
                    </DatoEmpresa>
                    <DatoEmpresa titulo="Teléfono">{empresa.telefono}</DatoEmpresa>
                    <DatoEmpresa titulo="Correo">
                        {empresa.correo && <a href={`mailto:${empresa.correo}`}>{empresa.correo}</a>}
                    </DatoEmpresa>
                </dl>
            </section>
        </div>
    );
}

function RedesSociales({ empresa }) {
    const redes = [
        { clave: "facebook", nombre: "Facebook" },
        { clave: "instagram", nombre: "Instagram" },
        { clave: "tiktok", nombre: "TikTok" }
    ].filter((r) => empresa[r.clave]);

    return (
        <ul className="cat-redes">
            <li>
                <a href={enlaceWhatsApp()} target="_blank" rel="noopener">WhatsApp</a>
            </li>
            {redes.map((r) => (
                <li key={r.clave}>
                    <a href={empresa[r.clave]} target="_blank" rel="noopener">{r.nombre}</a>
                </li>
            ))}
        </ul>
    );
}

// Pie de página con columnas, como en las tiendas en línea.
export function PieTienda({ tienda, secciones, onIr }) {
    const enlace = (destino, texto) => (
        <li>
            <a href={`#${destino}`} onClick={(e) => { e.preventDefault(); onIr(destino); }}>{texto}</a>
        </li>
    );
    const empresa = tienda?.empresa;

    return (
        <footer className="cat-pie">
            <div className="cat-pie-columnas">
                <div className="cat-pie-marca">
                    <span className="cat-logo cat-logo-pie">
                        {urlImagenTienda(tienda, "logo") ? <img src={urlImagenTienda(tienda, "logo")} alt="Mil Deseos" /> : "Mil Deseos"}
                    </span>
                    <p>Adornos, luces, útiles y regalos para cada celebración.</p>
                    {empresa && <RedesSociales empresa={empresa} />}
                </div>
                <nav aria-label="Mil Deseos">
                    <h2>Mil Deseos</h2>
                    <ul>
                        {enlace("nosotros", "¿Quiénes somos?")}
                        {enlace("nosotros/valores", "Nuestros valores")}
                        {enlace("nosotros/empresa", "Información corporativa")}
                    </ul>
                </nav>
                <nav aria-label="Comprar">
                    <h2>Comprar</h2>
                    <ul>
                        {secciones.map((s) => enlace(s.slug, s.nombre))}
                        {enlace("todo", "Ver todo")}
                    </ul>
                </nav>
                <nav aria-label="Ayuda">
                    <h2>Ayuda</h2>
                    <ul>
                        {enlace("nosotros/como-comprar", "¿Cómo comprar?")}
                        {tienda?.preguntas?.length > 0 && enlace("nosotros/preguntas", "Preguntas frecuentes")}
                        {enlace("nosotros/promociones", "Promociones y envíos")}
                        <li>
                            <a href={enlaceWhatsApp("Hola Mil Deseos 👋 Tengo una consulta.")} target="_blank" rel="noopener">
                                Escríbenos por WhatsApp
                            </a>
                        </li>
                    </ul>
                </nav>
            </div>
            <p className="cat-pie-pagos">
                <strong>Aceptamos:</strong> {Object.values(BILLETERAS).map((b) => b.nombre).join(" · ")} · Transferencia · 💳 Tarjetas de débito y crédito (+{RECARGO_TARJETA}%)
            </p>
            <p className="cat-pie-legal">
                © {new Date().getFullYear()} Mil Deseos
                {empresa?.razonSocial ? ` · ${empresa.razonSocial}` : ""}
                {empresa?.ruc ? ` · RUC ${empresa.ruc}` : ""} · Precios en soles (S/). Consulta disponibilidad antes de tu compra.
            </p>
        </footer>
    );
}

/* Ventana de bienvenida con el cupón de primera compra: aparece una sola vez por navegador
   (o al tocar la promoción en la barra superior). */
export function VentanaBienvenida({ tienda, forzada, onAplicar, onCerrar }) {
    const dialogo = useRef(null);
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        if (!tienda?.cupon.activo) return undefined;

        if (forzada) {
            setVisible(true);
            return undefined;
        }

        let vista = false;
        try {
            vista = localStorage.getItem(CLAVE_BIENVENIDA) === tienda.cupon.codigo;
        } catch {
            vista = true; // sin almacenamiento no se insiste
        }
        if (vista) return undefined;

        const espera = setTimeout(() => setVisible(true), 1500);
        return () => clearTimeout(espera);
    }, [tienda, forzada]);

    useEffect(() => {
        if (visible) dialogo.current?.showModal();
    }, [visible]);

    function cerrar() {
        try {
            localStorage.setItem(CLAVE_BIENVENIDA, tienda.cupon.codigo);
        } catch {
            // No pasa nada si no se puede recordar.
        }
        setVisible(false);
        onCerrar();
    }

    if (!visible) return null;

    return (
        <dialog
            ref={dialogo}
            className="modal cat-bienvenida"
            onClose={cerrar}
            onClick={(e) => e.target === dialogo.current && cerrar()}
            aria-labelledby="titulo-bienvenida"
        >
            <div className="cat-bienvenida-contenido">
                <button type="button" className="boton-cerrar-modal cat-detalle-cerrar" onClick={cerrar} aria-label="Cerrar">
                    ✕
                </button>
                <p className="cat-banner-sobre">Bienvenida a Mil Deseos</p>
                <h2 id="titulo-bienvenida">
                    {tienda.cupon.porcentaje}% <span>OFF</span>
                </h2>
                <p>en tu primera compra</p>
                <CodigoCupon codigo={tienda.cupon.codigo} />
                <button
                    type="button"
                    className="cat-boton-oscuro"
                    onClick={() => {
                        onAplicar();
                        cerrar();
                    }}
                >
                    Aplicar a mi pedido
                </button>
                <small>{tienda.cupon.condiciones}</small>
            </div>
        </dialog>
    );
}
