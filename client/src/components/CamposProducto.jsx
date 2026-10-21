import { useCallback, useState } from "react";
import { porDocena, textoCostoUnitario } from "../producto.js";
import CampoFoto from "./CampoFoto.jsx";
import Escaner from "./Escaner.jsx";
import { iconoTema, useSecciones } from "../secciones.js";
import { sugerirCategoria } from "../categoriasAuto.js";

// Valor del selector de ubicación: "c<id>" (categoría), "s<id>" (sección sin categoría) o "".
function valorUbicacion(valores) {
    if (valores.categoriaId) return `c${valores.categoriaId}`;
    if (valores.seccionId) return `s${valores.seccionId}`;
    return "";
}

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

            // Mientras no se elija la ubicación a mano, se sugiere la categoría según el nombre
            // (por ejemplo, "Pino nevado" → Árboles y pinos; "Reno de luces" → Renos de luces).
            if (name === "nombre" && !anteriores.ubicacionManual) {
                const sugerida = sugerirCategoria(value, secciones);

                if (sugerida) {
                    if (anteriores.ubicacionPrevia === undefined) {
                        nuevos.ubicacionPrevia = { seccionId: anteriores.seccionId, categoriaId: anteriores.categoriaId };
                    }
                    nuevos.categoriaId = String(sugerida.id);
                    nuevos.seccionId = String(sugerida.seccionId);
                } else if (anteriores.ubicacionPrevia !== undefined) {
                    nuevos.seccionId = anteriores.ubicacionPrevia.seccionId;
                    nuevos.categoriaId = anteriores.ubicacionPrevia.categoriaId;
                    nuevos.ubicacionPrevia = undefined;
                }
            }

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

    function cambiarUbicacion(evento) {
        const valor = evento.target.value;
        const tipo = valor.charAt(0);
        const numero = valor.slice(1);
        const seccionDeCategoria = secciones.find((s) => s.categorias.some((cat) => String(cat.id) === numero));

        onCambio((anteriores) => ({
            ...anteriores,
            ubicacionManual: true,
            ubicacionPrevia: undefined,
            categoriaId: tipo === "c" ? numero : "",
            seccionId: tipo === "c" ? String(seccionDeCategoria?.id ?? "") : tipo === "s" ? numero : ""
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
                    <label htmlFor={id("ubicacion")}>Ubicación en el catálogo</label>
                    <select
                        id={id("ubicacion")}
                        value={valorUbicacion(valores)}
                        onChange={cambiarUbicacion}
                    >
                        <option value="">Sin sección</option>
                        {secciones.map((seccion) => (
                            <optgroup
                                key={seccion.id}
                                label={`${iconoTema(seccion.tema)} ${seccion.nombre}${seccion.visible ? "" : " (oculta)"}`}
                            >
                                {seccion.categorias.map((categoria) => (
                                    <option key={categoria.id} value={`c${categoria.id}`}>
                                        {categoria.icono} {categoria.nombre}
                                    </option>
                                ))}
                                <option value={`s${seccion.id}`}>
                                    {seccion.categorias.length ? `Otros de ${seccion.nombre}` : seccion.nombre}
                                </option>
                            </optgroup>
                        ))}
                    </select>
                    {!valores.ubicacionManual && valores.categoriaId && (
                        <span className="ayuda-campo">✨ Sugerida por el nombre. Puedes cambiarla.</span>
                    )}
                </div>
            </div>

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

                <p className="costo-calculado">
                    {textoCostoUnitario(valores.precioCompra, valores.unidadesPorCaja)}
                </p>
            </fieldset>

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
