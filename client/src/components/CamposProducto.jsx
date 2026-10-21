import { useCallback, useState } from "react";
import { porDocena } from "../producto.js";
import CampoFoto from "./CampoFoto.jsx";
import Escaner from "./Escaner.jsx";
import { iconoTema, useSecciones } from "../secciones.js";

/* Campos compartidos por el formulario de registro y el modal de edición.
   valores.docenaAuto: mientras sea true, el precio por docena sigue al precio mínimo × 12.
   valores.foto: data URL nueva, null para quitarla, undefined para dejarla igual.
   valores.fotoActual: URL de la foto ya guardada (solo al editar). */
export default function CamposProducto({ valores, onCambio, prefijo, etiquetaCompra }) {
    const [escaneando, setEscaneando] = useState(false);
    const secciones = useSecciones();

    const codigoLeido = useCallback((codigo) => {
        setEscaneando(false);
        onCambio((anteriores) => ({ ...anteriores, codigo }));
    }, [onCambio]);

    function cambiar(evento) {
        const { name, value } = evento.target;

        onCambio((anteriores) => {
            const nuevos = { ...anteriores, [name]: value };

            if (name === "precioDocena") {
                nuevos.docenaAuto = false;
            }

            if (name === "precioMinimo" && anteriores.docenaAuto) {
                nuevos.precioDocena = porDocena(value);
            }

            return nuevos;
        });
    }

    function recalcularDocena() {
        onCambio((anteriores) => ({
            ...anteriores,
            precioDocena: porDocena(anteriores.precioMinimo),
            docenaAuto: true
        }));
    }

    const id = (campo) => `${prefijo}-${campo}`;
    const minimoDocena = porDocena(valores.precioMinimo);

    return (
        <>
            <div className="fila-campos fila-codigo">
                <div className="campo">
                    <label htmlFor={id("codigo")}>Código del producto</label>
                    <div className="campo-con-boton">
                        <input
                            type="text"
                            id={id("codigo")}
                            name="codigo"
                            placeholder="Escanéalo o escríbelo"
                            maxLength={50}
                            autoCapitalize="characters"
                            autoComplete="off"
                            spellCheck={false}
                            value={valores.codigo}
                            onChange={cambiar}
                            required
                        />
                        <button
                            type="button"
                            className="boton-escanear"
                            onClick={() => setEscaneando(true)}
                            aria-label="Escanear código con la cámara"
                            title="Escanear código"
                        >
                            📷
                        </button>
                    </div>
                </div>

                <div className="campo">
                    <label htmlFor={id("nombre")}>Nombre del producto</label>
                    <input
                        type="text"
                        id={id("nombre")}
                        name="nombre"
                        placeholder="Ej. Cinta navideña"
                        maxLength={150}
                        value={valores.nombre}
                        onChange={cambiar}
                        required
                    />
                </div>

                <div className="campo">
                    <label htmlFor={id("seccionId")}>Sección del catálogo</label>
                    <select
                        id={id("seccionId")}
                        name="seccionId"
                        value={valores.seccionId ?? ""}
                        onChange={cambiar}
                    >
                        <option value="">Sin sección</option>
                        {secciones.map((seccion) => (
                            <option key={seccion.id} value={seccion.id}>
                                {iconoTema(seccion.tema)} {seccion.nombre}{seccion.visible ? "" : " (oculta)"}
                            </option>
                        ))}
                    </select>
                </div>
            </div>

            <fieldset className="grupo-campos">
                <legend>Precios de venta</legend>

                <div className="fila-campos">
                    <div className="campo">
                        <label htmlFor={id("precio")}>Precio por unidad (S/)</label>
                        <input
                            type="number"
                            id={id("precio")}
                            name="precio"
                            min="0"
                            step="0.01"
                            inputMode="decimal"
                            placeholder="3.00"
                            value={valores.precio}
                            onChange={cambiar}
                            required
                        />
                    </div>

                    <div className="campo">
                        <label htmlFor={id("precioMinimo")}>Precio mínimo por unidad (S/)</label>
                        <input
                            type="number"
                            id={id("precioMinimo")}
                            name="precioMinimo"
                            min="0"
                            step="0.01"
                            inputMode="decimal"
                            placeholder="2.50"
                            value={valores.precioMinimo}
                            onChange={cambiar}
                            required
                        />
                    </div>
                    <div className="campo">
                        <label htmlFor={id("precioDocena")}>Precio por docena (S/)</label>
                        <input
                            type="number"
                            id={id("precioDocena")}
                            name="precioDocena"
                            min="0"
                            step="0.01"
                            inputMode="decimal"
                            placeholder="36.00"
                            value={valores.precioDocena}
                            onChange={cambiar}
                            required
                        />
                        <span className="ayuda-campo dato-calculado">
                            {valores.docenaAuto ? (
                                <>Calculado: precio mínimo × 12 = <strong>S/ {minimoDocena || "0.00"}</strong>. Puedes cambiarlo.</>
                            ) : (
                                <button type="button" className="boton-enlace" onClick={recalcularDocena}>
                                    Usar mínimo × 12 (S/ {minimoDocena || "0.00"})
                                </button>
                            )}
                        </span>
                    </div>

                </div>
            </fieldset>

            <fieldset className="grupo-campos">
                <legend>Compra y stock</legend>

                <div className="fila-campos">
                    <div className="campo">
                        <label htmlFor={id("precioCompra")}>{etiquetaCompra}</label>
                        <input
                            type="number"
                            id={id("precioCompra")}
                            name="precioCompra"
                            min="0"
                            step="0.01"
                            inputMode="decimal"
                            placeholder="48.00"
                            value={valores.precioCompra}
                            onChange={cambiar}
                            required
                        />
                    </div>

                    <div className="campo">
                        <label htmlFor={id("unidadesPorCaja")}>Unidades por caja</label>
                        <input
                            type="number"
                            id={id("unidadesPorCaja")}
                            name="unidadesPorCaja"
                            min="1"
                            step="1"
                            inputMode="numeric"
                            value={valores.unidadesPorCaja}
                            onChange={cambiar}
                            required
                        />
                    </div>

                    <div className="campo">
                        <label htmlFor={id("stock")}>Stock (unidades)</label>
                        <input
                            type="number"
                            id={id("stock")}
                            name="stock"
                            min="0"
                            step="1"
                            inputMode="numeric"
                            placeholder="24"
                            value={valores.stock}
                            onChange={cambiar}
                            required
                        />
                    </div>
                </div>
            </fieldset>

            <CampoFoto
                id={id("foto")}
                foto={valores.foto}
                fotoActual={valores.fotoActual}
                onCambio={(foto) => onCambio((anteriores) => ({ ...anteriores, foto }))}
            />

            {escaneando && (
                <Escaner onLeido={codigoLeido} onCerrar={() => setEscaneando(false)} />
            )}
        </>
    );
}
