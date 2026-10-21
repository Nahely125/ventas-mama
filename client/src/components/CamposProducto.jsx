import { useCallback, useState } from "react";
import { calcularGanancias, porDocena, stockTotal, textoCostoUnitario } from "../producto.js";
import { moneda } from "../api.js";
import CampoFoto from "./CampoFoto.jsx";
import Escaner from "./Escaner.jsx";
import { iconoTema, useSecciones } from "../secciones.js";
import { sugerirCategoria } from "../categoriasAuto.js";

// Ganancia que deja cada precio (se actualiza mientras se escribe).
function ResumenGanancia({ ganancias, stock2025 }) {
    if (!ganancias) {
        return <p className="ayuda-campo">Escribe el costo de compra para ver la ganancia de cada precio.</p>;
    }

    const filas = [
        { texto: "Por unidad", valor: ganancias.unidad, margen: ganancias.margenUnidad },
        { texto: "Por docena", valor: ganancias.docena },
        { texto: "Al mínimo por unidad", valor: ganancias.minimo, margen: ganancias.margenMinimo },
        { texto: "Al mínimo por docena", valor: ganancias.minimoDocena }
    ];

    return (
        <div className="resumen-ganancia" aria-live="polite">
            <h4>💰 Ganancia al vender</h4>
            <dl>
                {filas.map((fila) => (
                    <div key={fila.texto} className={fila.valor !== null && fila.valor < 0 ? "perdida" : ""}>
                        <dt>{fila.texto}</dt>
                        <dd>
                            {fila.valor === null ? "—" : moneda(fila.valor)}
                            {fila.margen != null && Number.isFinite(fila.margen) && <small> ({fila.margen.toFixed(0)}%)</small>}
                        </dd>
                    </div>
                ))}
            </dl>
            {ganancias.todoElStock !== null && (
                <p className="ganancia-total-stock">
                    Si vendes todo el stock por unidad: <strong>{moneda(ganancias.todoElStock)}</strong>
                    {stock2025 > 0 && <small> (las {stock2025} u. del 2025 no restan costo)</small>}
                </p>
            )}
            {filas.some((f) => f.valor !== null && f.valor < 0) && (
                <p className="texto-error">⚠️ Algún precio está por debajo del costo: venderías con pérdida.</p>
            )}
        </div>
    );
}

// Valor del selector de ubicación: "c<id>" (categoría), "s<id>" (sección sin categoría) o "".
function valorUbicacion(valores) {
    if (valores.categoriaId) return `c${valores.categoriaId}`;
    if (valores.seccionId) return `s${valores.seccionId}`;
    return "";
}

/* Campos compartidos por el formulario de registro y el modal de edición.
   valores.minimoDocenaAuto: mientras sea true, el mínimo por docena sigue al mínimo por unidad × 12.
   El precio por docena no se escribe: es precio por unidad × 12.
   valores.stockNuevo + valores.stock2025 = stock total.
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

            // Los precios por docena se calculan solos (× 12) hasta que se escriban a mano.
            if (name === "precioMinimoDocena") {
                nuevos.minimoDocenaAuto = false;
            }

            if (name === "precioMinimo" && anteriores.minimoDocenaAuto) {
                nuevos.precioMinimoDocena = porDocena(value);
            }

            return nuevos;
        });
    }

    function recalcular(campo, base, bandera) {
        onCambio((anteriores) => ({
            ...anteriores,
            [campo]: porDocena(anteriores[base]),
            [bandera]: true
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
                        <label htmlFor={id("stockNuevo")}>Stock nuevo (comprado este año)</label>
                        <input
                            type="number"
                            id={id("stockNuevo")}
                            name="stockNuevo"
                            min="0"
                            step="1"
                            inputMode="numeric"
                            placeholder="24"
                            value={valores.stockNuevo}
                            onChange={cambiar}
                            required
                        />
                    </div>
                </div>

                <p className="costo-calculado">
                    {textoCostoUnitario(valores.precioCompra, valores.unidadesPorCaja)}
                </p>
            </fieldset>

            <fieldset className="grupo-campos grupo-sobrante">
                <legend>📦 Mercadería sobrante del año pasado</legend>

                <div className="campo">
                    <label htmlFor={id("stock2025")}>Unidades sobrantes del 2025</label>
                    <input
                        type="number"
                        id={id("stock2025")}
                        name="stock2025"
                        min="0"
                        step="1"
                        inputMode="numeric"
                        placeholder="0"
                        value={valores.stock2025 ?? ""}
                        onChange={cambiar}
                    />
                    <span className="ayuda-campo">
                        Ya se pagó el año pasado: al venderla, todo lo cobrado es <strong>ganancia neta</strong> y no
                        cuenta para recuperar la inversión de este año. Se vende primero. Déjalo en 0 si no hay sobrante.
                    </span>
                </div>

                <p className="resumen-stock">
                    Stock total: <strong>{stockTotal(valores)} unidades</strong>
                    {Number(valores.stock2025) > 0 && (
                        <> ({Number(valores.stockNuevo) || 0} nuevas + {Number(valores.stock2025)} sobrantes)</>
                    )}
                    {Number(valores.stock2025) > 0 && Number(valores.precio) > 0 && (
                        <>
                            <br />
                            Lo sobrante deja hasta <strong>{moneda(Number(valores.stock2025) * Number(valores.precio))}</strong> de
                            ganancia neta al precio por unidad.
                        </>
                    )}
                </p>
            </fieldset>

            <fieldset className="grupo-campos">
                <legend>Precios de venta</legend>

                <div className="fila-campos tabla-precios">
                    {[
                        { campo: "precio", etiqueta: "Precio por unidad (S/)", ejemplo: "3.00" },
                        { campo: "precioMinimo", etiqueta: "Precio mínimo por unidad (S/)", ejemplo: "2.50" },
                        { campo: "precioMinimoDocena", etiqueta: "Precio mínimo por docena (S/)", ejemplo: "30.00", base: "precioMinimo", bandera: "minimoDocenaAuto", texto: "mínimo por unidad" }
                    ].map((precio) => (
                        <div className="campo" key={precio.campo}>
                            <label htmlFor={id(precio.campo)}>{precio.etiqueta}</label>
                            <input
                                type="number"
                                id={id(precio.campo)}
                                name={precio.campo}
                                min="0"
                                step="0.01"
                                inputMode="decimal"
                                placeholder={precio.ejemplo}
                                value={valores[precio.campo]}
                                onChange={cambiar}
                                required
                            />
                            {precio.base && (
                                <span className="ayuda-campo dato-calculado">
                                    {valores[precio.bandera] ? (
                                        <>Calculado: {precio.texto} × 12. Puedes cambiarlo.</>
                                    ) : (
                                        <button
                                            type="button"
                                            className="boton-enlace"
                                            onClick={() => recalcular(precio.campo, precio.base, precio.bandera)}
                                        >
                                            Usar {precio.texto} × 12 (S/ {porDocena(valores[precio.base]) || "0.00"})
                                        </button>
                                    )}
                                </span>
                            )}
                        </div>
                    ))}
                </div>

                <p className="costo-calculado">
                    Precio por docena: <strong>S/ {porDocena(valores.precio) || "0.00"}</strong>
                    <small> (calculado: precio por unidad × 12)</small>
                </p>

                <ResumenGanancia ganancias={calcularGanancias(valores)} stock2025={Number(valores.stock2025 || 0)} />
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
