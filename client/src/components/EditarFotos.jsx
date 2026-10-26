import { useCallback, useEffect, useState } from "react";
import { pedir } from "../api.js";
import { guardarFoto, leerImagen, prepararFoto, prepararOriginal, urlFotoOriginal } from "../fotos.js";
import { ESTILOS, estiloAutomatico } from "../escenas.js";

const ESCENAS = ESTILOS.filter((e) => e.valor !== "original");

/* Vuelve a crear las fotos del catálogo con la escena elegida, usando cada foto subida
   (sin editar) como referencia: el producto es el real, solo cambia lo que lo rodea. */
export default function EditarFotos({ onError }) {
    const [productos, setProductos] = useState(null);
    const [temas, setTemas] = useState(new Map());
    const [estilo, setEstilo] = useState("auto");
    const [avance, setAvance] = useState(null); // { hechas, total }
    const [mensaje, setMensaje] = useState(null);

    const cargar = useCallback(async () => {
        try {
            const [lista, secciones] = await Promise.all([pedir("/api/productos"), pedir("/api/secciones")]);
            setProductos(lista.filter((p) => p.tieneFoto));
            setTemas(new Map(secciones.map((s) => [s.id, s.tema])));
        } catch (error) {
            onError(error, () => setMensaje({ tipo: "error", texto: error.message }));
        }
    }, [onError]);

    useEffect(() => {
        cargar();
    }, [cargar]);

    async function crear(lista) {
        if (lista.length > 1 && !confirm(`Se van a volver a crear ${lista.length} fotos. ¿Continuar?`)) return;

        let fallidas = 0;
        setMensaje(null);
        setAvance({ hechas: 0, total: lista.length });

        for (const [indice, producto] of lista.entries()) {
            try {
                const imagen = await leerImagen(urlFotoOriginal(producto));
                const escena = estilo === "auto" ? estiloAutomatico(temas.get(producto.seccionId)) : estilo;
                await guardarFoto(producto.id, await prepararFoto(imagen, { estilo: escena }), {
                    editada: true,
                    original: prepararOriginal(imagen)
                });
                imagen.close?.();
            } catch (error) {
                if (error.estado === 401) {
                    onError(error);
                    return;
                }
                console.error(`No se pudo crear la foto de ${producto.nombre}:`, error);
                fallidas++;
            }
            setAvance({ hechas: indice + 1, total: lista.length });
        }

        setAvance(null);
        setMensaje(
            fallidas === 0
                ? { tipo: "exito", texto: `¡Listo! Se crearon ${lista.length} ${lista.length === 1 ? "foto" : "fotos"} nuevas.` }
                : { tipo: "error", texto: `Se crearon ${lista.length - fallidas} fotos; ${fallidas} no se pudieron crear. Puedes intentarlo otra vez.` }
        );
        await cargar();
    }

    if (productos === null) return null;

    const pendientes = productos.filter((p) => !p.fotoEditada);
    const elegido = ESCENAS.find((e) => e.valor === estilo);

    return (
        <section className="tarjeta editar-fotos">
            <h2>✨ Fotos del catálogo</h2>
            <p className="descripcion-seccion">
                Crea fotos nuevas más bonitas a partir de las que subiste: se recorta el producto real y se coloca
                en una escena (estudio, navidad, madera, lila o blanco), con luz corregida, sombra y reflejo.
                Siempre se parte de la foto original, así que puedes cambiar de escena las veces que quieras.
            </p>

            {productos.length === 0 ? (
                <p>Todavía no hay productos con foto.</p>
            ) : avance ? (
                <div className="avance-fotos" role="status">
                    <p>
                        Creando foto {Math.min(avance.hechas + 1, avance.total)} de {avance.total}... No cierres esta página.
                    </p>
                    <progress max={avance.total} value={avance.hechas} />
                </div>
            ) : (
                <>
                    <div className="estilos-foto" role="radiogroup" aria-label="Escena para las fotos">
                        {ESCENAS.map((e) => (
                            <button
                                key={e.valor}
                                type="button"
                                role="radio"
                                aria-checked={estilo === e.valor}
                                className={estilo === e.valor ? "activo" : ""}
                                onClick={() => setEstilo(e.valor)}
                            >
                                {e.texto}
                            </button>
                        ))}
                    </div>
                    <p className="ayuda-campo">{elegido?.ayuda}</p>

                    <div className="acciones-fotos">
                        {pendientes.length > 0 && (
                            <button type="button" className="boton-principal" onClick={() => crear(pendientes)}>
                                ✨ Crear {pendientes.length} {pendientes.length === 1 ? "foto nueva" : "fotos nuevas"} (las que faltan)
                            </button>
                        )}
                        <button
                            type="button"
                            className={pendientes.length > 0 ? "boton-secundario" : "boton-principal"}
                            onClick={() => crear(productos)}
                        >
                            🔄 Volver a crear todas ({productos.length}) con esta escena
                        </button>
                    </div>
                </>
            )}

            {mensaje && <p className={`mensaje mensaje-${mensaje.tipo}`} role="status">{mensaje.texto}</p>}
        </section>
    );
}
