import { useCallback, useEffect, useState } from "react";
import { pedir } from "../api.js";
import { guardarFoto, leerImagen, prepararFoto, urlFoto } from "../fotos.js";

// Edita de una sola vez las fotos que aún no tienen el estilo del catálogo (fondo blanco).
export default function EditarFotos({ onError }) {
    const [pendientes, setPendientes] = useState(null);
    const [avance, setAvance] = useState(null); // { hechas, total, fallidas }
    const [mensaje, setMensaje] = useState(null);

    const cargar = useCallback(async () => {
        try {
            const productos = await pedir("/api/productos");
            setPendientes(productos.filter((p) => p.tieneFoto && !p.fotoEditada));
        } catch (error) {
            onError(error, () => setMensaje({ tipo: "error", texto: error.message }));
        }
    }, [onError]);

    useEffect(() => {
        cargar();
    }, [cargar]);

    async function editarTodas() {
        const lista = pendientes;
        let fallidas = 0;
        setMensaje(null);
        setAvance({ hechas: 0, total: lista.length, fallidas: 0 });

        for (const [indice, producto] of lista.entries()) {
            try {
                const imagen = await leerImagen(urlFoto(producto));
                await guardarFoto(producto.id, await prepararFoto(imagen), true);
            } catch (error) {
                if (error.estado === 401) {
                    onError(error);
                    return;
                }
                console.error(`No se pudo editar la foto de ${producto.nombre}:`, error);
                fallidas++;
            }
            setAvance({ hechas: indice + 1, total: lista.length, fallidas });
        }

        setAvance(null);
        setMensaje(
            fallidas === 0
                ? { tipo: "exito", texto: `¡Listo! Se editaron ${lista.length} ${lista.length === 1 ? "foto" : "fotos"}.` }
                : { tipo: "error", texto: `Se editaron ${lista.length - fallidas} fotos; ${fallidas} no se pudieron editar. Puedes intentarlo otra vez.` }
        );
        await cargar();
    }

    if (pendientes === null) return null;

    return (
        <section className="tarjeta editar-fotos">
            <h2>✨ Fotos del catálogo</h2>
            <p className="descripcion-seccion">
                Las fotos nuevas se editan solas al subirlas: se quita el fondo, se mejora la luz y el producto queda
                sobre fondo blanco. Aquí puedes editar de una vez las fotos que se subieron antes.
            </p>

            {avance ? (
                <div className="avance-fotos" role="status">
                    <p>
                        Editando foto {Math.min(avance.hechas + 1, avance.total)} de {avance.total}... No cierres esta página.
                    </p>
                    <progress max={avance.total} value={avance.hechas} />
                </div>
            ) : pendientes.length === 0 ? (
                <p className="texto-exito">✅ Todas las fotos ya están editadas con fondo blanco.</p>
            ) : (
                <button type="button" className="boton-principal" onClick={editarTodas}>
                    ✨ Editar {pendientes.length} {pendientes.length === 1 ? "foto" : "fotos"} con fondo blanco
                </button>
            )}

            {mensaje && <p className={`mensaje mensaje-${mensaje.tipo}`} role="status">{mensaje.texto}</p>}
        </section>
    );
}
