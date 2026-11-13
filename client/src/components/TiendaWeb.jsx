import { useEffect, useRef, useState } from "react";
import { moneda } from "../api.js";
import { urlFoto } from "../fotos.js";
import { BILLETERAS, RECARGO_TARJETA } from "../datosPago.js";
import { enlaceWhatsApp, telefonoLegible, urlImagenTienda } from "../tienda.js";
import { CarruselPortada, FotoAdaptada, prefiereQuieto } from "./Carrusel.jsx";
import Icono from "./Iconos.jsx";

/* Marca de la tienda: el logo subido en «Página web» o, si no hay, un monograma «MD»
   con el nombre en letra elegante. */
export function MarcaTienda({ tienda }) {
    const logo = urlImagenTienda(tienda, "logo");
    if (logo) return <img src={logo} alt="Mil Deseos" />;

    return (
        <span className="cat-marca">
            <span className="cat-monograma" aria-hidden="true">MD</span>
            <span className="cat-marca-nombre">Mil Deseos</span>
        </span>
    );
}

// Franja de confianza (sobre el pie de página): pagos, envíos, atención y el negocio familiar.
function FranjaConfianza({ tienda }) {
    const puntos = [
        { icono: "tarjeta", titulo: "Paga como prefieras", texto: `${Object.values(BILLETERAS).map((b) => b.nombre).join(", ")}, transferencia o tarjeta` },
        {
            icono: "camion",
            titulo: "Envíos",
            texto: tienda?.envio?.activo ? `Gratis en compras mayores a ${montoCorto(tienda.envio.gratisDesde)}` : "Coordinamos la entrega contigo"
        },
        { icono: "chat", titulo: "Atención por WhatsApp", texto: "Te confirmamos stock y total antes de pagar" },
        { icono: "corazon", titulo: "Negocio familiar", texto: "Elegimos cada producto con cariño" }
    ];

    return (
        <section className="cat-confianza" aria-label="Por qué comprar en Mil Deseos">
            <ul>
                {puntos.map((p) => (
                    <li key={p.icono}>
                        <Icono nombre={p.icono} className="cat-confianza-icono" />
                        <span>
                            <strong>{p.titulo}</strong>
                            <small>{p.texto}</small>
                        </span>
                    </li>
                ))}
            </ul>
        </section>
    );
}

/* Partes de la página web del catálogo (inspirada en las tiendas de moda en línea):
   barra de promociones, portada, "Nosotros", pie de página y ventana de bienvenida con el cupón. */

const CLAVE_BIENVENIDA = "mil-deseos-bienvenida";
// Íconos de línea para los valores (se repiten si hay más valores que íconos).
const ICONOS_VALORES = ["corazon", "estrella", "etiqueta", "chat", "regalo", "bolsa", "camion", "recibo"];

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

// Encabezado de cada sección: palabra pequeña, título y, a la derecha, un enlace («Ver todo»).
function EncabezadoBanda({ id, sobre, titulo, accion, centrado = false }) {
    return (
        <div className={`cat-banda-cabecera ${centrado ? "cat-banda-cabecera-centrada" : ""}`}>
            <div>
                {sobre && <p className="cat-sobre">{sobre}</p>}
                <h2 id={id}>{titulo}</h2>
            </div>
            {accion && (
                <button type="button" className="cat-enlace-subrayado" onClick={accion.onClick}>
                    {accion.texto}
                </button>
            )}
        </div>
    );
}

/* Banda: una sección que ocupa todo el ancho de la pantalla (con su color de fondo)
   y ordena su contenido en una columna centrada. */
function Banda({ id, etiqueta, fondo = "blanca", clase = "", children }) {
    return (
        <section id={id} className={`cat-banda cat-banda-${fondo} revelar`} aria-labelledby={etiqueta}>
            <div className={`cat-banda-interior ${clase}`}>{children}</div>
        </section>
    );
}

// Promociones (envío gratis y, si está activo, el cupón) en una franja de todo el ancho.
function BandaPromociones({ tienda, onAplicarCupon }) {
    if (!tienda || (!tienda.cupon.activo && !tienda.envio.activo)) return null;

    return (
        <section className="cat-banda cat-banda-promo revelar" aria-label="Promociones">
            <div className="cat-banda-interior cat-promos-fila">
                {tienda.cupon.activo && (
                    <article className="cat-promo-item">
                        <Icono nombre="etiqueta" className="cat-promo-item-icono" />
                        <div>
                            <p className="cat-sobre">Bienvenida a Mil Deseos</p>
                            <h2>{tienda.cupon.porcentaje}% <em>OFF</em></h2>
                            <p>en tu primera compra</p>
                            <div className="cat-promo-item-acciones">
                                <CodigoCupon codigo={tienda.cupon.codigo} />
                                <button type="button" className="cat-enlace-subrayado" onClick={onAplicarCupon}>
                                    Aplicar a mi pedido
                                </button>
                            </div>
                        </div>
                    </article>
                )}
                {tienda.envio.activo && (
                    <article className="cat-promo-item">
                        <Icono nombre="camion" className="cat-promo-item-icono" />
                        <div>
                            <p className="cat-sobre">Te lo llevamos</p>
                            <h2>Envío <em>gratis</em></h2>
                            <p>en compras mayores a {montoCorto(tienda.envio.gratisDesde)}</p>
                        </div>
                    </article>
                )}
            </div>
        </section>
    );
}

// "Compra en 3 pasos": una franja corta bajo la portada que explica cómo se compra.
function PasosCompra() {
    const pasos = [
        { icono: "bolsa", titulo: "Elige", texto: "Toca «Agregar»: por unidad, media docena o docena." },
        { icono: "recibo", titulo: "Revisa tu pedido", texto: "Mira el total y cuánto falta para el envío gratis." },
        { icono: "chat", titulo: "Envíalo por WhatsApp", texto: "Te confirmamos stock, total, pago y entrega." }
    ];

    return (
        <section className="cat-banda cat-banda-pasos revelar" aria-labelledby="titulo-pasos">
            <div className="cat-banda-interior">
                <h2 id="titulo-pasos" className="cat-sobre cat-pasos-titulo">Compra en 3 pasos</h2>
                <ol className="cat-pasos-tira">
                    {pasos.map((paso, i) => (
                        <li key={paso.titulo}>
                            <span className="cat-paso-icono"><Icono nombre={paso.icono} /></span>
                            <div>
                                <strong><span className="cat-paso-numero">{i + 1}.</span> {paso.titulo}</strong>
                                <p>{paso.texto}</p>
                            </div>
                        </li>
                    ))}
                </ol>
            </div>
        </section>
    );
}

// Mosaico de categorías: una foto grande por categoría (en el celular se desliza).
function CategoriasInicio({ categorias, onIr }) {
    if (categorias.length < 2) return null;

    return (
        <Banda etiqueta="titulo-categorias-inicio">
            <EncabezadoBanda
                id="titulo-categorias-inicio"
                sobre="Explora"
                titulo="Compra por categoría"
                accion={{ texto: "Ver todo", onClick: () => onIr("todo") }}
            />
            <ul className="cat-mosaico-categorias" style={{ "--columnas": Math.min(Math.max(categorias.length, 4), 6) }}>
                {categorias.map((categoria) => (
                    <li key={`${categoria.seccion}-${categoria.slug}`}>
                        <button type="button" onClick={() => onIr(categoria.seccion, categoria.slug)}>
                            <span className="cat-mosaico-foto">
                                {categoria.foto ? (
                                    <FotoAdaptada src={urlFoto(categoria.foto, "mini")} />
                                ) : (
                                    <span className="cat-sin-foto" aria-hidden="true">{categoria.icono ?? "✦"}</span>
                                )}
                            </span>
                            <span className="cat-mosaico-nombre">{categoria.nombre}</span>
                            <span className="cat-mosaico-total">
                                {categoria.total} {categoria.total === 1 ? "producto" : "productos"}
                            </span>
                        </button>
                    </li>
                ))}
            </ul>
        </Banda>
    );
}

// Ferias como banners divididos: foto arriba y, debajo, el nombre, la frase y «Comprar ahora».
function FeriasInicio({ secciones, onIr }) {
    if (secciones.length === 0) return null;

    return (
        <Banda etiqueta="titulo-ferias">
            <EncabezadoBanda id="titulo-ferias" sobre="Temporadas" titulo="Compra por feria" />
            <ul className={`cat-ferias-divididas ${secciones.length === 1 ? "cat-ferias-una" : ""}`}>
                {secciones.map((seccion) => {
                    const conFoto = seccion.productos.find((p) => p.tieneFoto && p.disponible) ?? seccion.productos.find((p) => p.tieneFoto);
                    return (
                        <li key={seccion.slug}>
                            <button type="button" className="cat-feria-dividida" onClick={() => onIr(seccion.slug)}>
                                <span className={`cat-feria-dividida-foto cat-tema-${seccion.tema}`}>
                                    {conFoto ? (
                                        <img src={urlFoto(conFoto)} alt="" loading="lazy" decoding="async" />
                                    ) : (
                                        <Icono nombre="regalo" className="cat-feria-sin-foto" />
                                    )}
                                </span>
                                <span className="cat-feria-dividida-texto">
                                    <span className="cat-sobre">
                                        {seccion.productos.length} {seccion.productos.length === 1 ? "producto" : "productos"}
                                    </span>
                                    <strong>{seccion.nombre}</strong>
                                    {seccion.descripcion && <span className="cat-feria-frase">{seccion.descripcion}</span>}
                                    <span className="cat-enlace-subrayado">Comprar ahora</span>
                                </span>
                            </button>
                        </li>
                    );
                })}
            </ul>
        </Banda>
    );
}

// "Lo que dicen de nosotros": comentarios de clientes (solo si el jefe los agregó).
function Testimonios({ tienda }) {
    if (!tienda?.testimonios?.length) return null;

    return (
        <Banda etiqueta="titulo-testimonios">
            <EncabezadoBanda id="titulo-testimonios" sobre="Clientes felices" titulo="Lo que dicen de nosotros" centrado />
            <ul className="cat-testimonios-lista">
                {tienda.testimonios.map((t) => (
                    <li key={`${t.nombre}-${t.texto.slice(0, 20)}`}>
                        <span className="cat-estrellas" aria-hidden="true">★★★★★</span>
                        <blockquote>“{t.texto}”</blockquote>
                        <cite>— {t.nombre}</cite>
                    </li>
                ))}
            </ul>
        </Banda>
    );
}

// Preguntas frecuentes: se abren al tocarlas.
export function PreguntasFrecuentes({ tienda, id }) {
    if (!tienda?.preguntas?.length) return null;
    const titulo = `${id ?? "inicio"}-titulo-preguntas`;

    return (
        <Banda id={id} etiqueta={titulo} fondo="suave" clase="cat-faq">
            <EncabezadoBanda id={titulo} sobre="¿Tienes dudas?" titulo="Preguntas frecuentes" centrado />
            <div className="cat-faq-lista">
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
        </Banda>
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

/* Portada de la tienda, ordenada por secciones de todo el ancho:
   portada con carrusel → cómo comprar → categorías → más vendidos → ferias → novedades
   → promociones → comentarios → preguntas → quiénes somos. */
export function Portada({ tienda, secciones, categorias, destacados, masVendidos, carrusel, onIr, onAbrir, onAplicarCupon }) {
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
            producto: true,
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
                    <h1>{tienda?.portada?.titulo || "Haz realidad tus deseos"}</h1>
                    <p className="cat-heroe-frase">
                        {tienda?.portada?.frase || "Adornos, luces, árboles, útiles y regalos para cada celebración. Por unidad, media docena o docena."}
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
                <Banda etiqueta="titulo-mas-vendidos" fondo="suave">
                    <EncabezadoBanda
                        id="titulo-mas-vendidos"
                        sobre="Favoritos de nuestros clientes"
                        titulo="Los más vendidos"
                        accion={{ texto: "Ver todo", onClick: () => onIr("todo") }}
                    />
                    {carrusel(masVendidos, "Los más vendidos")}
                </Banda>
            )}

            <FeriasInicio secciones={secciones} onIr={onIr} />

            {destacados.length > 0 && (
                <Banda etiqueta="titulo-novedades" fondo="suave">
                    <EncabezadoBanda
                        id="titulo-novedades"
                        sobre="Recién llegados"
                        titulo="Novedades"
                        accion={{ texto: "Ver todo el catálogo", onClick: () => onIr("todo") }}
                    />
                    {carrusel(destacados, "Novedades")}
                </Banda>
            )}

            <BandaPromociones tienda={tienda} onAplicarCupon={onAplicarCupon} />

            <Testimonios tienda={tienda} />

            <PreguntasFrecuentes tienda={tienda} />

            {tienda && (
                <Banda etiqueta="titulo-quienes-somos" clase="cat-nosotros-inicio">
                    <div>
                        <p className="cat-sobre">¿Quiénes somos?</p>
                        <h2 id="titulo-quienes-somos">Un negocio familiar lleno de ilusión</h2>
                        <p>{tienda.quienesSomos}</p>
                        <button type="button" className="cat-enlace-subrayado" onClick={() => onIr("nosotros")}>
                            Conoce más de nosotros
                        </button>
                    </div>
                    {tienda.valores.length > 0 && (
                        <ul className="cat-valores-breve" aria-label="Nuestros valores">
                            {tienda.valores.map((valor, i) => (
                                <li key={valor.titulo}>
                                    <Icono nombre={ICONOS_VALORES[i % ICONOS_VALORES.length]} className="cat-valor-chip-icono" />
                                    {valor.titulo}
                                </li>
                            ))}
                        </ul>
                    )}
                </Banda>
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
                                <span className="cat-valor-icono"><Icono nombre={ICONOS_VALORES[i % ICONOS_VALORES.length]} /></span>
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
                                <h3><Icono nombre="etiqueta" /> {tienda.cupon.porcentaje}% de descuento en tu primera compra</h3>
                                <p>
                                    Usa el código <strong>{tienda.cupon.codigo}</strong> en tu pedido. {tienda.cupon.condiciones}
                                </p>
                            </article>
                        )}
                        {tienda.envio.activo && (
                            <article>
                                <h3><Icono nombre="camion" /> {textoEnvio(tienda)}</h3>
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
        <>
        <FranjaConfianza tienda={tienda} />
        <footer className="cat-pie">
            <div className="cat-pie-columnas">
                <div className="cat-pie-marca">
                    <span className="cat-logo cat-logo-pie">
                        <MarcaTienda tienda={tienda} />
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
                <strong>Aceptamos:</strong> {Object.values(BILLETERAS).map((b) => b.nombre).join(" · ")} · Transferencia · Tarjetas de débito y crédito (+{RECARGO_TARJETA}%)
            </p>
            <p className="cat-pie-legal">
                © {new Date().getFullYear()} Mil Deseos
                {empresa?.razonSocial ? ` · ${empresa.razonSocial}` : ""}
                {empresa?.ruc ? ` · RUC ${empresa.ruc}` : ""} · Precios en soles (S/). Consulta disponibilidad antes de tu compra.
            </p>
        </footer>
        </>
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
