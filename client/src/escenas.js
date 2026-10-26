/* Escenas para las fotos del catálogo: fondos dibujados por la app (no se usa ningún servicio
   externo). Cada escena pinta el fondo y dice dónde va el piso y cómo se ve el producto
   (reflejo, sombra, pedestal). Todas miden lo mismo que la foto del catálogo (3:4). */

export const ESTILOS = [
    { valor: "auto", texto: "✨ Automático", ayuda: "Según la feria: navideña, madera para la escolar y estudio para lo demás." },
    { valor: "blanco", texto: "⬜ Blanco", ayuda: "Fondo blanco liso, como en las tiendas en línea." },
    { valor: "estudio", texto: "💡 Estudio", ayuda: "Luz de estudio con un reflejo suave en el piso." },
    { valor: "navidad", texto: "🎄 Navidad", ayuda: "Luces navideñas desenfocadas y piso de satín rojo." },
    { valor: "madera", texto: "🪵 Madera", ayuda: "Mesa de madera con luz cálida de ventana." },
    { valor: "lila", texto: "💜 Lila", ayuda: "Pedestal blanco sobre lila con destellos (colores de Mil Deseos)." },
    { valor: "original", texto: "📷 Original", ayuda: "La foto tal cual, sin editar." }
];

// Escena que se usa con "Automático", según el tema de la feria del producto.
export function estiloAutomatico(tema) {
    if (tema === "navidad") return "navidad";
    if (tema === "escolar") return "madera";
    return "estudio";
}

// Números "al azar" pero siempre los mismos para la misma semilla (la foto no cambia sola).
function azar(semilla) {
    let s = semilla >>> 0 || 1;
    return () => {
        s ^= s << 13;
        s ^= s >>> 17;
        s ^= s << 5;
        return (s >>> 0) / 4294967296;
    };
}

// Círculo de luz desenfocado (bokeh).
function bokeh(ctx, x, y, radio, color, opacidad) {
    const g = ctx.createRadialGradient(x, y, 0, x, y, radio);
    g.addColorStop(0, `rgba(${color}, ${opacidad})`);
    g.addColorStop(0.55, `rgba(${color}, ${opacidad * 0.75})`);
    g.addColorStop(1, `rgba(${color}, 0)`);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, radio, 0, Math.PI * 2);
    ctx.fill();
}

// Destello de cuatro puntas.
function destello(ctx, x, y, tamano, color) {
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = color;
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
        const angulo = (i * Math.PI) / 4;
        const r = i % 2 === 0 ? tamano : tamano * 0.18;
        ctx.lineTo(Math.cos(angulo) * r, Math.sin(angulo) * r);
    }
    ctx.closePath();
    ctx.fill();
    ctx.restore();
}

function degradadoVertical(ctx, y0, y1, colores) {
    const g = ctx.createLinearGradient(0, y0, 0, y1);
    colores.forEach((color, i) => g.addColorStop(i / (colores.length - 1), color));
    return g;
}

/* Pinta la escena y devuelve cómo colocar el producto:
   piso: altura (0 a 1) donde se apoya el producto; reflejo: opacidad del reflejo en el piso;
   sombra: opacidad de la sombra; pedestal: { y, radio } si el producto va sobre un pedestal. */
export function pintarEscena(ctx, ancho, alto, estilo, semilla = 7) {
    const r = azar(semilla);

    if (estilo === "estudio") {
        ctx.fillStyle = degradadoVertical(ctx, 0, alto, ["#fbfaff", "#efeaf5", "#e4dcee"]);
        ctx.fillRect(0, 0, ancho, alto);
        // Foco de luz detrás del producto.
        bokeh(ctx, ancho / 2, alto * 0.42, ancho * 0.75, "255, 255, 255", 0.9);
        // Piso: un poco más oscuro, con el horizonte suave.
        const piso = alto * 0.78;
        ctx.fillStyle = degradadoVertical(ctx, piso - 40, alto, ["rgba(214, 204, 228, 0)", "rgba(214, 204, 228, 0.55)", "rgba(196, 184, 214, 0.75)"]);
        ctx.fillRect(0, piso - 40, ancho, alto - piso + 40);
        return { piso: 0.8, reflejo: 0.16, sombra: 0.22 };
    }

    if (estilo === "navidad") {
        ctx.fillStyle = degradadoVertical(ctx, 0, alto, ["#0e3b2c", "#0a2a20", "#061a14"]);
        ctx.fillRect(0, 0, ancho, alto);
        // Luces navideñas desenfocadas.
        const colores = ["255, 214, 121", "255, 196, 92", "255, 240, 200", "255, 120, 110", "255, 214, 121"];
        for (let i = 0; i < 46; i++) {
            const radio = 12 + r() * 42;
            bokeh(ctx, r() * ancho, r() * alto * 0.72, radio, colores[Math.floor(r() * colores.length)], 0.18 + r() * 0.4);
        }
        // Brillo cálido detrás del producto.
        bokeh(ctx, ancho / 2, alto * 0.5, ancho * 0.55, "255, 224, 160", 0.22);
        // Piso de satín rojo.
        const piso = alto * 0.76;
        ctx.fillStyle = degradadoVertical(ctx, piso, alto, ["#7a1620", "#56101a", "#33080e"]);
        ctx.fillRect(0, piso, ancho, alto - piso);
        ctx.fillStyle = degradadoVertical(ctx, piso, piso + 60, ["rgba(255, 190, 170, 0.35)", "rgba(255, 190, 170, 0)"]);
        ctx.fillRect(0, piso, ancho, 60);
        for (let i = 0; i < 7; i++) {
            destello(ctx, r() * ancho, r() * alto * 0.6, 6 + r() * 10, "rgba(255, 246, 220, 0.85)");
        }
        return { piso: 0.79, reflejo: 0.24, sombra: 0.35 };
    }

    if (estilo === "madera") {
        // Pared cálida con luz de ventana.
        ctx.fillStyle = degradadoVertical(ctx, 0, alto, ["#f7efe6", "#efe2d3", "#e6d4c1"]);
        ctx.fillRect(0, 0, ancho, alto);
        bokeh(ctx, ancho * 0.28, alto * 0.22, ancho * 0.6, "255, 250, 240", 0.85);
        ctx.save();
        ctx.globalAlpha = 0.07;
        ctx.fillStyle = "#6b4a2b";
        for (let i = 0; i < 3; i++) {
            ctx.fillRect(ancho * (0.62 + i * 0.1), 0, ancho * 0.035, alto * 0.7);
        }
        ctx.restore();
        // Mesa de madera con vetas.
        const piso = alto * 0.74;
        ctx.fillStyle = degradadoVertical(ctx, piso, alto, ["#c08a5a", "#a8714a", "#8a5a39"]);
        ctx.fillRect(0, piso, ancho, alto - piso);
        ctx.save();
        ctx.beginPath();
        ctx.rect(0, piso, ancho, alto - piso);
        ctx.clip();
        for (let i = 0; i < 70; i++) {
            const y = piso + r() * (alto - piso);
            ctx.strokeStyle = `rgba(${r() < 0.5 ? "90, 55, 30" : "220, 170, 120"}, ${0.08 + r() * 0.14})`;
            ctx.lineWidth = 1 + r() * 2.5;
            ctx.beginPath();
            ctx.moveTo(0, y);
            for (let x = 0; x <= ancho; x += 50) {
                ctx.lineTo(x, y + Math.sin(x / 90 + i) * (2 + r() * 3));
            }
            ctx.stroke();
        }
        ctx.restore();
        // Borde de la mesa iluminado.
        ctx.fillStyle = "rgba(255, 230, 200, 0.35)";
        ctx.fillRect(0, piso, ancho, 3);
        return { piso: 0.8, reflejo: 0, sombra: 0.4 };
    }

    if (estilo === "lila") {
        ctx.fillStyle = degradadoVertical(ctx, 0, alto, ["#f6edff", "#e9d5ff", "#d8b4fe"]);
        ctx.fillRect(0, 0, ancho, alto);
        for (let i = 0; i < 26; i++) {
            bokeh(ctx, r() * ancho, r() * alto * 0.7, 10 + r() * 34, "255, 255, 255", 0.25 + r() * 0.35);
        }
        for (let i = 0; i < 9; i++) {
            destello(ctx, r() * ancho, r() * alto * 0.65, 6 + r() * 11, "rgba(255, 255, 255, 0.9)");
        }
        // Pedestal blanco (cilindro).
        const radio = ancho * 0.36;
        const arriba = alto * 0.74;
        const alturaPedestal = alto * 0.2;
        ctx.fillStyle = degradadoVertical(ctx, arriba, arriba + alturaPedestal, ["#ffffff", "#f1e6fb", "#e2cff5"]);
        ctx.beginPath();
        ctx.ellipse(ancho / 2, arriba + alturaPedestal, radio, radio * 0.16, 0, 0, Math.PI);
        ctx.lineTo(ancho / 2 - radio, arriba);
        ctx.ellipse(ancho / 2, arriba, radio, radio * 0.16, 0, Math.PI, 0, true);
        ctx.closePath();
        ctx.fill();
        // Cara de arriba del pedestal.
        const tapa = ctx.createRadialGradient(ancho / 2, arriba - 6, 4, ancho / 2, arriba, radio);
        tapa.addColorStop(0, "#ffffff");
        tapa.addColorStop(1, "#f3e9fc");
        ctx.fillStyle = tapa;
        ctx.beginPath();
        ctx.ellipse(ancho / 2, arriba, radio, radio * 0.16, 0, 0, Math.PI * 2);
        ctx.fill();
        return { piso: arriba / alto + 0.012, reflejo: 0, sombra: 0.28, anchoMaximo: (radio * 2 * 0.92) / ancho };
    }

    // Blanco liso.
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, ancho, alto);
    return { piso: 0.84, reflejo: 0, sombra: 0.24 };
}
