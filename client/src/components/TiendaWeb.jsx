import { useEffect, useRef, useState } from "react";
import { moneda } from "../api.js";
import { urlFoto } from "../fotos.js";
import { iconoTema } from "../secciones.js";
import { BILLETERAS } from "../datosPago.js";
import { enlaceWhatsApp, telefonoLegible } from "../tienda.js";

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

    useEffect(() => {
        if (mensajes.length < 2 || window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return undefined;
        const reloj = setInterval(() => setIndice((i) => (i + 1) % mensajes.length), 4500);
        return () => clearInterval(reloj);
    }, [mensajes.length]);

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
        <section className="cat-promos" aria-label="Promociones">
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

// Portada: presentación, promociones, ferias, productos destacados y "Nosotros" en breve.
export function Portada({ tienda, secciones, destacados, grilla, onIr, onAplicarCupon }) {
    const fotos = destacados.filter((p) => p.tieneFoto).slice(0, 3);

    return (
        <>
            <section className="cat-heroe">
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
                {fotos.length > 0 && (
                    <div className={`cat-heroe-fotos cat-heroe-fotos-${fotos.length}`} aria-hidden="true">
                        {fotos.map((producto) => (
                            <img key={producto.id} src={urlFoto(producto)} alt="" />
                        ))}
                    </div>
                )}
            </section>

            <BloquesPromocion tienda={tienda} onAplicarCupon={onAplicarCupon} />

            {secciones.length > 0 && (
                <section className="cat-ferias" aria-label="Compra por feria">
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
                <section className="cat-bloque" aria-label="Lo más nuevo">
                    <h2 className="cat-titulo-centrado">Lo más nuevo</h2>
                    {grilla(destacados)}
                    <div className="cat-centrado">
                        <button type="button" className="cat-boton-oscuro" onClick={() => onIr("todo")}>
                            Ver todo el catálogo
                        </button>
                    </div>
                </section>
            )}

            {tienda && (
                <section className="cat-nosotros-breve">
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
                    <li><strong>Aplica</strong> tu cupón de primera compra, si lo tienes.</li>
                    <li><strong>Envía</strong> tu pedido por WhatsApp: te confirmamos la disponibilidad y el total.</li>
                    <li>
                        <strong>Paga</strong> con {Object.values(BILLETERAS).map((b) => b.nombre).join(", ")} o transferencia, y coordinamos la entrega.
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
                    <span className="cat-logo cat-logo-pie">Mil Deseos</span>
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
                        {enlace("nosotros/promociones", "Promociones y envíos")}
                        <li>
                            <a href={enlaceWhatsApp("Hola Mil Deseos 👋 Tengo una consulta.")} target="_blank" rel="noopener">
                                Escríbenos por WhatsApp
                            </a>
                        </li>
                    </ul>
                </nav>
            </div>
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
