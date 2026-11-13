/* Íconos de línea fina para el catálogo (en vez de emojis: se ven iguales en todos los celulares).
   Toman el color del texto (currentColor). Uso: <Icono nombre="camion" />. */

const TRAZOS = {
    bolsa: (
        <>
            <path d="M5 8h14l-1.2 11.2a2 2 0 0 1-2 1.8H8.2a2 2 0 0 1-2-1.8z" />
            <path d="M9 8V6.5a3 3 0 0 1 6 0V8" />
        </>
    ),
    recibo: (
        <>
            <path d="M6 3h12v18l-3-2-3 2-3-2-3 2z" />
            <path d="M9 8h6M9 12h6M9 16h3" />
        </>
    ),
    chat: (
        <>
            <path d="M20 12a8 8 0 0 1-11.6 7.1L4 20l1-4A8 8 0 1 1 20 12z" />
            <path d="M9 11h.01M12 11h.01M15 11h.01" />
        </>
    ),
    camion: (
        <>
            <path d="M3 6h11v10H3z" />
            <path d="M14 9h4l3 3v4h-7" />
            <circle cx="7" cy="17.5" r="1.8" />
            <circle cx="17" cy="17.5" r="1.8" />
        </>
    ),
    tarjeta: (
        <>
            <rect x="3" y="5.5" width="18" height="13" rx="2" />
            <path d="M3 10h18M7 15h4" />
        </>
    ),
    celular: (
        <>
            <rect x="7" y="2.5" width="10" height="19" rx="2" />
            <path d="M11 18.5h2" />
        </>
    ),
    corazon: <path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" />,
    etiqueta: (
        <>
            <path d="M3 12V4h8l10 10-8 8z" />
            <circle cx="7.5" cy="8.5" r="1.3" />
        </>
    ),
    regalo: (
        <>
            <rect x="3.5" y="8" width="17" height="4" rx="1" />
            <path d="M5 12v8h14v-8M12 8v12" />
            <path d="M12 8c-1.5-3-5-3.5-5-1.2C7 8 9 8 12 8zM12 8c1.5-3 5-3.5 5-1.2C17 8 15 8 12 8z" />
        </>
    ),
    estrella: <path d="m12 3 2.6 5.6 6 .7-4.5 4.1 1.2 6L12 16.4 6.7 19.4l1.2-6L3.4 9.3l6-.7z" />,
    mas: <path d="M12 5v14M5 12h14" />,
    hecho: <path d="m5 12.5 4.5 4.5L19 7.5" />
};

export default function Icono({ nombre, className = "", titulo }) {
    return (
        <svg
            className={`icono ${className}`}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden={titulo ? undefined : "true"}
            role={titulo ? "img" : undefined}
            aria-label={titulo}
        >
            {TRAZOS[nombre]}
        </svg>
    );
}
