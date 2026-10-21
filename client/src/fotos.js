import { pedir } from "./api.js";

const LADO_MAXIMO = 800;

// Dirección de la foto de un producto, o null si no tiene.
// La versión cambia cada vez que se sube una foto nueva, así no se queda la vieja en caché.
export function urlFoto(producto) {
    return producto?.tieneFoto
        ? `/api/productos/${producto.id}/foto?v=${producto.fotoVersion}`
        : null;
}

// Reduce la foto (las del celular pesan varios MB) y la convierte a JPEG.
export async function reducirFoto(archivo) {
    if (!archivo.type.startsWith("image/")) {
        throw new Error("El archivo debe ser una imagen.");
    }

    const imagen = await createImageBitmap(archivo);
    const escala = Math.min(1, LADO_MAXIMO / Math.max(imagen.width, imagen.height));
    const lienzo = document.createElement("canvas");

    lienzo.width = Math.round(imagen.width * escala);
    lienzo.height = Math.round(imagen.height * escala);

    const ctx = lienzo.getContext("2d");
    ctx.fillStyle = "#ffffff"; // fondo blanco para PNG con transparencia
    ctx.fillRect(0, 0, lienzo.width, lienzo.height);
    ctx.drawImage(imagen, 0, 0, lienzo.width, lienzo.height);
    imagen.close?.();

    return lienzo.toDataURL("image/jpeg", 0.82);
}

// Guarda o quita la foto según lo elegido en el formulario.
// foto: data URL nueva, null para quitarla, undefined para dejarla igual.
export async function guardarFoto(productoId, foto) {
    if (foto === undefined) return;

    if (foto === null) {
        await pedir(`/api/productos/${productoId}/foto`, { method: "DELETE" });
    } else {
        await pedir(`/api/productos/${productoId}/foto`, { method: "PUT", cuerpo: { foto } });
    }
}
