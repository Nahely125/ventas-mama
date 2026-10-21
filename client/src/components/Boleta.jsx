import { useEffect, useState } from "react";
import { pedir } from "../api.js";
import { generarImagenComprobante } from "../imagenComprobante.js";
import { numeroComprobante } from "../venta.js";

// Página pública de una boleta: la abre el cliente desde el enlace de WhatsApp.
export default function Boleta({ token }) {
    const [venta, setVenta] = useState(null);
    const [imagen, setImagen] = useState(null);
    const [url, setUrl] = useState("");
    const [error, setError] = useState("");

    useEffect(() => {
        document.title = "Boleta | Mil Deseos";
        let direccion = "";
        let cancelado = false;

        pedir(`/api/publico/boletas/${encodeURIComponent(token)}`)
            .then(async (datos) => {
                if (cancelado) return;
                setVenta(datos);
                const archivo = await generarImagenComprobante(datos);
                if (cancelado) return;
                direccion = URL.createObjectURL(archivo);
                setImagen(archivo);
                setUrl(direccion);
            })
            .catch((err) => !cancelado && setError(err.message));

        return () => {
            cancelado = true;
            if (direccion) URL.revokeObjectURL(direccion);
        };
    }, [token]);

    function descargar() {
        const enlace = document.createElement("a");
        enlace.href = url;
        enlace.download = imagen.name;
        enlace.click();
    }

    return (
        <div className="pagina-publica">
            <header className="encabezado-catalogo">
                <div className="encabezado-catalogo-interno">
                    <h1>Mil Deseos</h1>
                    <p>{venta ? `Boleta de venta N° ${numeroComprobante(venta)}` : "Boleta de venta"}</p>
                </div>
            </header>

            <main className="contenedor-boleta">
                {error ? (
                    <p className="mensaje mensaje-error">{error}</p>
                ) : !url ? (
                    <p className="cargando-imagen">
                        <span className="spinner" aria-hidden="true"></span> Cargando boleta...
                    </p>
                ) : (
                    <>
                        {venta?.anulada && (
                            <p className="mensaje mensaje-error">⊘ Esta venta fue anulada.</p>
                        )}
                        <img
                            className="imagen-boleta"
                            src={url}
                            alt={`Boleta de venta N° ${numeroComprobante(venta)}`}
                        />
                        <div className="acciones-boleta">
                            <button type="button" className="boton-secundario" onClick={descargar}>
                                ⬇️ Descargar boleta
                            </button>
                            <a className="boton-principal" href="/catalogo">
                                🛍️ Ver catálogo
                            </a>
                        </div>
                    </>
                )}
            </main>
        </div>
    );
}
