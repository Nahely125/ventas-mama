/* Separa el producto del fondo con un modelo pequeño de inteligencia artificial
   (U²-Net "u2netp", ~4.5 MB, licencia Apache 2.0) que corre en el mismo navegador:
   la foto no se envía a ningún servicio externo. Se carga solo la primera vez que se usa. */

const LADO_MODELO = 320;
const MEDIA = [0.485, 0.456, 0.406];
const DESVIACION = [0.229, 0.224, 0.225];

let cargando = null;

function cargarModelo() {
    if (!cargando) {
        cargando = (async () => {
            const ort = await import("onnxruntime-web/wasm");
            ort.env.wasm.numThreads = 1;
            const sesion = await ort.InferenceSession.create("/modelos/u2netp.onnx", {
                executionProviders: ["wasm"]
            });
            return { ort, sesion };
        })();
        // Si falla (sin internet, navegador antiguo), se puede volver a intentar luego.
        cargando.catch(() => {
            cargando = null;
        });
    }

    return cargando;
}

/* Devuelve, para cada píxel del lienzo, qué tan seguro es que es parte del producto
   (0 = fondo, 255 = producto), como un lienzo del mismo tamaño en escala de grises (en el alfa). */
export async function mascaraProducto(lienzo) {
    const { ort, sesion } = await cargarModelo();

    const chico = document.createElement("canvas");
    chico.width = LADO_MODELO;
    chico.height = LADO_MODELO;
    const ctxChico = chico.getContext("2d", { willReadFrequently: true });
    ctxChico.drawImage(lienzo, 0, 0, LADO_MODELO, LADO_MODELO);
    const pixeles = ctxChico.getImageData(0, 0, LADO_MODELO, LADO_MODELO).data;

    let maximo = 1;
    for (let i = 0; i < pixeles.length; i += 4) {
        maximo = Math.max(maximo, pixeles[i], pixeles[i + 1], pixeles[i + 2]);
    }

    const area = LADO_MODELO * LADO_MODELO;
    const entrada = new Float32Array(area * 3);

    for (let i = 0; i < area; i++) {
        for (let canal = 0; canal < 3; canal++) {
            entrada[canal * area + i] = (pixeles[i * 4 + canal] / maximo - MEDIA[canal]) / DESVIACION[canal];
        }
    }

    const tensor = new ort.Tensor("float32", entrada, [1, 3, LADO_MODELO, LADO_MODELO]);
    const resultado = await sesion.run({ [sesion.inputNames[0]]: tensor });
    const salida = resultado[sesion.outputNames[0]].data;

    let menor = Infinity;
    let mayor = -Infinity;
    for (let i = 0; i < area; i++) {
        menor = Math.min(menor, salida[i]);
        mayor = Math.max(mayor, salida[i]);
    }

    // La máscara se agranda al tamaño de la foto (queda con bordes suaves).
    const mascara = ctxChico.createImageData(LADO_MODELO, LADO_MODELO);
    const rango = mayor - menor || 1;

    for (let i = 0; i < area; i++) {
        mascara.data[i * 4 + 3] = Math.round(((salida[i] - menor) / rango) * 255);
    }

    ctxChico.putImageData(mascara, 0, 0);

    const grande = document.createElement("canvas");
    grande.width = lienzo.width;
    grande.height = lienzo.height;
    const ctxGrande = grande.getContext("2d", { willReadFrequently: true });
    ctxGrande.imageSmoothingQuality = "high";
    ctxGrande.drawImage(chico, 0, 0, grande.width, grande.height);

    return ctxGrande.getImageData(0, 0, grande.width, grande.height).data;
}
