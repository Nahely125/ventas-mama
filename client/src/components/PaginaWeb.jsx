import { useEffect, useState } from "react";
import { pedir } from "../api.js";

const CAMPOS_EMPRESA = [
    { clave: "razonSocial", texto: "Razón social", ejemplo: "Ej. Mil Deseos E.I.R.L." },
    { clave: "ruc", texto: "RUC", ejemplo: "11 números", modo: "numeric" },
    { clave: "direccion", texto: "Dirección", ejemplo: "Ej. Av. ..., Lima" },
    { clave: "horario", texto: "Horario de atención", ejemplo: "Ej. Lunes a sábado, 9 a. m. a 7 p. m." },
    { clave: "telefono", texto: "Teléfono (además del WhatsApp)", ejemplo: "Opcional" },
    { clave: "correo", texto: "Correo", ejemplo: "Ej. ventas@...", tipo: "email" },
    { clave: "facebook", texto: "Facebook (enlace)", ejemplo: "https://facebook.com/...", tipo: "url" },
    { clave: "instagram", texto: "Instagram (enlace)", ejemplo: "https://instagram.com/...", tipo: "url" },
    { clave: "tiktok", texto: "TikTok (enlace)", ejemplo: "https://tiktok.com/@...", tipo: "url" }
];

/* Página web del catálogo (solo el jefe): "¿Quiénes somos?", misión, visión, valores,
   información corporativa, cupón de primera compra y envío gratis. */
export default function PaginaWeb({ onError }) {
    const [valores, setValores] = useState(null);
    const [mensaje, setMensaje] = useState(null);
    const [guardando, setGuardando] = useState(false);

    useEffect(() => {
        pedir("/api/tienda")
            .then(setValores)
            .catch((error) => onError(error, () => setMensaje({ tipo: "error", texto: error.message })));
    }, [onError]);

    if (!valores) return null;

    const cambiar = (cambios) => setValores((v) => ({ ...v, ...cambios }));
    const cambiarEn = (grupo, cambios) => setValores((v) => ({ ...v, [grupo]: { ...v[grupo], ...cambios } }));
    const cambiarValor = (indice, cambios) =>
        setValores((v) => ({ ...v, valores: v.valores.map((x, i) => (i === indice ? { ...x, ...cambios } : x)) }));

    async function guardar(evento) {
        evento.preventDefault();
        setMensaje(null);
        setGuardando(true);

        try {
            const resultado = await pedir("/api/tienda", {
                method: "PUT",
                cuerpo: {
                    ...valores,
                    cupon: { ...valores.cupon, porcentaje: Number(valores.cupon.porcentaje) },
                    envio: { ...valores.envio, gratisDesde: Number(valores.envio.gratisDesde) }
                }
            });
            setValores(resultado.tienda);
            setMensaje({ tipo: "exito", texto: "¡Página web guardada! Ya se ve en el catálogo." });
        } catch (error) {
            onError(error, () => setMensaje({ tipo: "error", texto: error.message }));
        } finally {
            setGuardando(false);
        }
    }

    return (
        <section className="tarjeta pagina-web">
            <div className="encabezado-seccion">
                <h2>🌐 Página web</h2>
                <a className="boton-secundario boton-pequeno enlace-boton" href="/catalogo#nosotros" target="_blank" rel="noopener">
                    Ver «Nosotros» ↗
                </a>
            </div>
            <p className="descripcion-seccion">
                Lo que ven los clientes en el catálogo: quiénes son, sus valores, los datos de la empresa y las promociones.
                Lo que dejes vacío no se muestra.
            </p>

            <form className="formulario" onSubmit={guardar}>
                <fieldset className="grupo-campos">
                    <legend>¿Quiénes somos?</legend>
                    <div className="campo">
                        <label htmlFor="web-quienes">Presentación</label>
                        <textarea id="web-quienes" rows={4} maxLength={1200} value={valores.quienesSomos}
                            onChange={(e) => cambiar({ quienesSomos: e.target.value })} />
                    </div>
                    <div className="fila-campos fila-dos">
                        <div className="campo">
                            <label htmlFor="web-mision">Misión</label>
                            <textarea id="web-mision" rows={3} maxLength={1200} value={valores.mision}
                                onChange={(e) => cambiar({ mision: e.target.value })} />
                        </div>
                        <div className="campo">
                            <label htmlFor="web-vision">Visión</label>
                            <textarea id="web-vision" rows={3} maxLength={1200} value={valores.vision}
                                onChange={(e) => cambiar({ vision: e.target.value })} />
                        </div>
                    </div>
                </fieldset>

                <fieldset className="grupo-campos">
                    <legend>Nuestros valores</legend>
                    <ul className="lista-valores-web">
                        {valores.valores.map((valor, indice) => (
                            <li key={indice}>
                                <input aria-label={`Valor ${indice + 1}`} placeholder="Ej. Confianza" maxLength={60} value={valor.titulo}
                                    onChange={(e) => cambiarValor(indice, { titulo: e.target.value })} />
                                <input aria-label={`Descripción del valor ${indice + 1}`} placeholder="Una frase corta" maxLength={300} value={valor.texto}
                                    onChange={(e) => cambiarValor(indice, { texto: e.target.value })} />
                                <button type="button" className="boton-enlace" aria-label={`Quitar el valor ${valor.titulo || indice + 1}`}
                                    onClick={() => cambiar({ valores: valores.valores.filter((_, i) => i !== indice) })}>
                                    Quitar
                                </button>
                            </li>
                        ))}
                    </ul>
                    {valores.valores.length < 8 && (
                        <button type="button" className="boton-secundario boton-pequeno"
                            onClick={() => cambiar({ valores: [...valores.valores, { titulo: "", texto: "" }] })}>
                            ➕ Agregar valor
                        </button>
                    )}
                </fieldset>

                <fieldset className="grupo-campos">
                    <legend>Información corporativa</legend>
                    <div className="fila-campos fila-dos">
                        {CAMPOS_EMPRESA.map((campo) => (
                            <div className="campo" key={campo.clave}>
                                <label htmlFor={`web-${campo.clave}`}>{campo.texto}</label>
                                <input id={`web-${campo.clave}`} type={campo.tipo ?? "text"} inputMode={campo.modo}
                                    placeholder={campo.ejemplo} value={valores.empresa[campo.clave]}
                                    onChange={(e) => cambiarEn("empresa", { [campo.clave]: e.target.value })} />
                            </div>
                        ))}
                    </div>
                    <span className="ayuda-campo">El WhatsApp de los pedidos siempre se muestra.</span>
                </fieldset>

                <fieldset className="grupo-campos">
                    <legend>Cupón de primera compra</legend>
                    <label className="casilla">
                        <input type="checkbox" checked={valores.cupon.activo}
                            onChange={(e) => cambiarEn("cupon", { activo: e.target.checked })} />
                        <span>Mostrar el cupón en el catálogo</span>
                    </label>
                    <div className="fila-campos fila-dos">
                        <div className="campo">
                            <label htmlFor="web-cupon">Código</label>
                            <input id="web-cupon" maxLength={20} value={valores.cupon.codigo}
                                onChange={(e) => cambiarEn("cupon", { codigo: e.target.value.toUpperCase().replace(/\s/g, "") })} />
                        </div>
                        <div className="campo">
                            <label htmlFor="web-porcentaje">Descuento (%)</label>
                            <input id="web-porcentaje" type="number" min="1" max="90" step="1" inputMode="numeric"
                                value={valores.cupon.porcentaje} onChange={(e) => cambiarEn("cupon", { porcentaje: e.target.value })} />
                        </div>
                    </div>
                    <div className="campo">
                        <label htmlFor="web-cupon-condiciones">Condiciones</label>
                        <input id="web-cupon-condiciones" maxLength={300} value={valores.cupon.condiciones}
                            onChange={(e) => cambiarEn("cupon", { condiciones: e.target.value })} />
                    </div>
                    <span className="ayuda-campo">
                        El cliente aplica el código en su pedido y el descuento llega en el mensaje de WhatsApp. Al registrar
                        la venta, descuéntalo con «DESCUENTO DEL JEFE». Revisa que de verdad sea su primera compra.
                    </span>
                </fieldset>

                <fieldset className="grupo-campos">
                    <legend>Envío gratis</legend>
                    <label className="casilla">
                        <input type="checkbox" checked={valores.envio.activo}
                            onChange={(e) => cambiarEn("envio", { activo: e.target.checked })} />
                        <span>Ofrecer envío gratis</span>
                    </label>
                    <div className="fila-campos fila-dos">
                        <div className="campo">
                            <label htmlFor="web-envio">En compras mayores a (S/)</label>
                            <input id="web-envio" type="number" min="0" step="0.01" inputMode="decimal"
                                value={valores.envio.gratisDesde} onChange={(e) => cambiarEn("envio", { gratisDesde: e.target.value })} />
                        </div>
                    </div>
                    <div className="campo">
                        <label htmlFor="web-envio-condiciones">Condiciones</label>
                        <input id="web-envio-condiciones" maxLength={300} value={valores.envio.condiciones}
                            onChange={(e) => cambiarEn("envio", { condiciones: e.target.value })} />
                    </div>
                </fieldset>

                <button type="submit" className="boton-principal" disabled={guardando}>
                    {guardando ? "Guardando..." : "Guardar página web"}
                </button>

                {mensaje && <p className={`mensaje mensaje-${mensaje.tipo}`} role="status">{mensaje.texto}</p>}
            </form>
        </section>
    );
}
