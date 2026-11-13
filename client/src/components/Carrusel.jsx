import { useEffect, useRef, useState } from "react";

/* Piezas con movimiento del catálogo: fotos que se adaptan a su forma, carrusel de la portada,
   filas de productos que avanzan solas y secciones que aparecen al bajar. */

// ¿El cliente pidió menos animaciones en su celular?
export function prefiereQuieto() {
    return typeof window !== "undefined" && Boolean(window.matchMedia?.("(prefers-reduced-motion: reduce)").matches);
}

/* Foto adaptada al recuadro (3:4):
   - Si la foto es vertical (casi 3:4), llena el recuadro.
   - Si es horizontal o cuadrada, se ve completa, sin cortarse, sobre un fondo suave. Con «difuminado»
     (solo en la ficha), el fondo es la misma foto difuminada: se ve lindo pero le cuesta al celular,
     por eso no se usa en las listas de muchas tarjetas.
   Mientras carga se ve un brillo suave, y aparece con un desvanecido. */
export function FotoAdaptada({ src, alt = "", prioridad = false, difuminado = false }) {
    const [modo, setModo] = useState(null); // null (cargando) | "llenar" | "ajustar"

    function alCargar(evento) {
        const { naturalWidth: ancho, naturalHeight: alto } = evento.currentTarget;
        const proporcion = ancho / alto;
        setModo(proporcion > 0.66 && proporcion < 0.84 ? "llenar" : "ajustar");
    }

    return (
        <span className={`foto-adaptada ${modo ? `cargada foto-${modo}` : ""}`}>
            {modo === "ajustar" && difuminado && <img className="foto-adaptada-fondo" src={src} alt="" aria-hidden="true" decoding="async" />}
            <img
                className="foto-adaptada-principal"
                src={src}
                alt={alt}
                loading={prioridad ? "eager" : "lazy"}
                fetchPriority={prioridad ? "high" : "auto"}
                decoding="async"
                onLoad={alCargar}
                onError={() => setModo("ajustar")}
            />
        </span>
    );
}

/* Carrusel de la portada: las fotos pasan solas cada pocos segundos, con un acercamiento lento.
   Se puede deslizar con el dedo o tocar los puntos. Solo se descargan la foto actual y la siguiente. */
export function CarruselPortada({ diapositivas, intervalo = 5500 }) {
    const [actual, setActual] = useState(0);
    const [vistas, setVistas] = useState(() => new Set([0, 1]));
    const [pausado, setPausado] = useState(false);
    const inicioToque = useRef(null);
    const total = diapositivas.length;

    const ir = (indice) => {
        const destino = (indice + total) % total;
        setActual(destino);
        setVistas((v) => new Set([...v, destino, (destino + 1) % total]));
    };

    useEffect(() => {
        if (total < 2 || pausado || prefiereQuieto()) return undefined;
        const reloj = setInterval(() => {
            if (!document.hidden) ir(actual + 1);
        }, intervalo);
        return () => clearInterval(reloj);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [actual, total, pausado, intervalo]);

    if (total === 0) return null;

    return (
        <div
            className="carrusel-portada"
            onPointerDown={(e) => { inicioToque.current = e.clientX; }}
            onPointerUp={(e) => {
                if (inicioToque.current === null) return;
                const distancia = e.clientX - inicioToque.current;
                inicioToque.current = null;
                if (Math.abs(distancia) > 40) {
                    setPausado(true);
                    ir(actual + (distancia < 0 ? 1 : -1));
                }
            }}
        >
            {diapositivas.map((d, i) => (
                <div
                    key={d.clave}
                    className={`carrusel-diapositiva ${d.producto ? "carrusel-diapositiva-producto" : ""} ${i === actual ? "activa" : ""}`}
                    aria-hidden={i !== actual}
                >
                    {vistas.has(i) && (
                        <img className="carrusel-foto" src={d.src} alt="" decoding="async" fetchPriority={i === 0 ? "high" : "low"} draggable="false" />
                    )}
                    {/* En pantallas grandes: el producto completo a la derecha, sin estirar la foto. */}
                    {vistas.has(i) && d.producto && (
                        <img className="carrusel-producto" src={d.src} alt="" decoding="async" draggable="false" />
                    )}
                    {d.titulo && i === actual && (
                        <button type="button" className="carrusel-leyenda" onClick={d.onVer} tabIndex={-1}>
                            <span>{d.titulo}</span>
                            {d.detalle && <strong>{d.detalle}</strong>}
                            <em>Ver →</em>
                        </button>
                    )}
                </div>
            ))}

            {total > 1 && (
                <div className="carrusel-puntos" role="group" aria-label="Fotos de la portada">
                    {diapositivas.map((d, i) => (
                        <button
                            key={d.clave}
                            type="button"
                            className={i === actual ? "activo" : ""}
                            aria-label={`Foto ${i + 1} de ${total}`}
                            aria-current={i === actual ? "true" : undefined}
                            onClick={() => { setPausado(true); ir(i); }}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}

/* Fila de productos deslizable (carrusel). Avanza sola mientras se ve en pantalla;
   en cuanto el cliente la toca o usa las flechas, deja de moverse sola. */
export function CarruselFila({ etiqueta, children, auto = true }) {
    const fila = useRef(null);
    const [tocada, setTocada] = useState(false);
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        const elemento = fila.current;
        if (!elemento || !("IntersectionObserver" in window)) return undefined;
        const observador = new IntersectionObserver(([entrada]) => setVisible(entrada.isIntersecting), { threshold: 0.4 });
        observador.observe(elemento);
        return () => observador.disconnect();
    }, []);

    useEffect(() => {
        if (!auto || tocada || !visible || prefiereQuieto()) return undefined;
        const reloj = setInterval(() => {
            const elemento = fila.current;
            if (!elemento || document.hidden) return;
            const paso = elemento.firstElementChild?.getBoundingClientRect().width ?? 200;
            const alFinal = elemento.scrollLeft + elemento.clientWidth >= elemento.scrollWidth - 8;
            elemento.scrollTo({ left: alFinal ? 0 : elemento.scrollLeft + paso + 12, behavior: "smooth" });
        }, 3800);
        return () => clearInterval(reloj);
    }, [auto, tocada, visible]);

    function mover(direccion) {
        setTocada(true);
        const elemento = fila.current;
        elemento?.scrollBy({ left: direccion * elemento.clientWidth * 0.85, behavior: "smooth" });
    }

    return (
        <div className="carrusel-fila">
            <button type="button" className="carrusel-flecha carrusel-flecha-izq" onClick={() => mover(-1)} aria-label={`Anteriores de ${etiqueta}`}>
                ‹
            </button>
            <ul
                ref={fila}
                className="carrusel-fila-lista"
                aria-label={etiqueta}
                onPointerDown={() => setTocada(true)}
                onWheel={() => setTocada(true)}
                onFocus={() => setTocada(true)}
            >
                {children}
            </ul>
            <button type="button" className="carrusel-flecha carrusel-flecha-der" onClick={() => mover(1)} aria-label={`Siguientes de ${etiqueta}`}>
                ›
            </button>
        </div>
    );
}

/* Secciones que aparecen suavemente al bajar (las que tienen la clase "revelar").
   Se vuelve a revisar cuando cambia la página. Sin animaciones si el cliente las desactivó. */
export function useRevelar(dependencias) {
    useEffect(() => {
        if (prefiereQuieto() || !("IntersectionObserver" in window)) return undefined;
        document.documentElement.classList.add("con-revelar");

        const mostrar = (elemento) => {
            elemento.classList.add("visible");
            observador.unobserve(elemento);
        };
        const observador = new IntersectionObserver((entradas) => {
            for (const entrada of entradas) {
                if (entrada.isIntersecting) mostrar(entrada.target);
            }
        }, { rootMargin: "0px 0px -8% 0px", threshold: 0.08 });

        // Si se bajó de golpe, las secciones que quedaron arriba también se muestran.
        let pendiente = false;
        const alDesplazar = () => {
            if (pendiente) return;
            pendiente = true;
            requestAnimationFrame(() => {
                pendiente = false;
                document.querySelectorAll(".revelar:not(.visible)").forEach((el) => {
                    if (el.getBoundingClientRect().top < window.innerHeight) mostrar(el);
                });
            });
        };
        window.addEventListener("scroll", alDesplazar, { passive: true });

        // Espera un momento a que React pinte la página nueva.
        const espera = setTimeout(() => {
            document.querySelectorAll(".revelar:not(.visible)").forEach((el) => observador.observe(el));
        }, 30);

        return () => {
            clearTimeout(espera);
            observador.disconnect();
            window.removeEventListener("scroll", alDesplazar);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, dependencias);
}
