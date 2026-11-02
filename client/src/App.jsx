import { Suspense, lazy, useCallback, useEffect, useState } from "react";
import { pedir } from "./api.js";
import Login from "./components/Login.jsx";

// Cada parte se descarga solo cuando se usa (el catálogo no baja el panel, y al revés).
const Panel = lazy(() => import("./components/Panel.jsx"));
const Catalogo = lazy(() => import("./components/Catalogo.jsx"));
const Boleta = lazy(() => import("./components/Boleta.jsx"));

export function PantallaCarga() {
    return (
        <div className="pantalla-carga" role="status">
            <span className="spinner" aria-hidden="true"></span>
            Cargando...
        </div>
    );
}

// Páginas públicas: no piden iniciar sesión.
export default function App() {
    const ruta = window.location.pathname;
    const boleta = /^\/boleta\/([^/]+)\/?$/.exec(ruta);

    let pagina = <AppPrivada />;

    if (/^\/catalogo\/?$/.test(ruta)) {
        pagina = <Catalogo />;
    } else if (boleta) {
        pagina = <Boleta token={decodeURIComponent(boleta[1])} />;
    }

    return <Suspense fallback={<PantallaCarga />}>{pagina}</Suspense>;
}

function AppPrivada() {
    const [usuario, setUsuario] = useState(null);
    const [cargando, setCargando] = useState(true);

    const consultarSesion = useCallback(
        () => pedir("/api/sesion")
            .then((resultado) => setUsuario(resultado.usuario || resultado))
            .catch(() => setUsuario(null)),
        []
    );

    useEffect(() => {
        consultarSesion().finally(() => setCargando(false));
    }, [consultarSesion]);

    if (cargando) {
        return <PantallaCarga />;
    }

    if (!usuario) {
        return <Login onIngresar={setUsuario} />;
    }

    return (
        <Panel
            usuario={usuario}
            onSalir={() => setUsuario(null)}
            onActualizarUsuario={consultarSesion}
        />
    );
}
