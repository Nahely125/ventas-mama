import { useEffect, useState } from "react";
import { pedir } from "./api.js";

export const TEMAS = [
    { valor: "navidad", nombre: "Navidad", icono: "🎄" },
    { valor: "escolar", nombre: "Escolar", icono: "🎒" },
    { valor: "general", nombre: "General", icono: "🛍️" }
];

export function iconoTema(tema) {
    return TEMAS.find((t) => t.valor === tema)?.icono ?? "🛍️";
}

// Lista de secciones para los formularios (se vuelve a pedir cada vez que se monta).
export function useSecciones() {
    const [secciones, setSecciones] = useState([]);

    useEffect(() => {
        pedir("/api/secciones")
            .then(setSecciones)
            .catch(() => setSecciones([]));
    }, []);

    return secciones;
}
