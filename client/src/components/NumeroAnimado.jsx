import { useEffect, useRef, useState } from "react";
import { moneda } from "../api.js";

// Anima la cifra desde el valor anterior hasta el nuevo.
export default function NumeroAnimado({ valor, formato = "numero" }) {
    const destino = Number(valor) || 0;
    const [actual, setActual] = useState(0);
    const previo = useRef(0);

    useEffect(() => {
        const valorInicial = previo.current;
        previo.current = destino;

        if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
            setActual(destino);
            return;
        }

        const duracion = 700;
        const inicio = performance.now();
        let cuadro;

        function actualizar(tiempo) {
            const progreso = Math.min((tiempo - inicio) / duracion, 1);
            const suave = 1 - Math.pow(1 - progreso, 3);
            setActual(valorInicial + (destino - valorInicial) * suave);

            if (progreso < 1) {
                cuadro = requestAnimationFrame(actualizar);
            }
        }

        cuadro = requestAnimationFrame(actualizar);
        return () => cancelAnimationFrame(cuadro);
    }, [destino]);

    return formato === "moneda" ? moneda(actual) : Math.round(actual).toString();
}
