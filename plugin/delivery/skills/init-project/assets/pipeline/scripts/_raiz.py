"""Ubica la carpeta raíz del proyecto (la que contiene .pipeline/pipeline.json).

Los scripts del pipeline se pueden llamar desde cualquier directorio: en la aplicación de
escritorio la sesión no siempre arranca dentro de la carpeta del proyecto. Orden de búsqueda:

  1. La variable de entorno DELIVERY_PROYECTO, si está definida.
  2. La ubicación de este mismo archivo: <proyecto>/.pipeline/scripts/_raiz.py.
  3. El directorio actual y sus carpetas superiores.
  4. Las carpetas conectadas a la sesión ($HOME/mnt/<carpeta>) y un nivel dentro de ellas.
"""
import os
import sys
from pathlib import Path


def _es_proyecto(p):
    return (p / ".pipeline" / "pipeline.json").exists()


def raiz(obligatoria=True):
    env = os.environ.get("DELIVERY_PROYECTO")
    if env and _es_proyecto(Path(env).expanduser()):
        return Path(env).expanduser().resolve()
    aqui = Path(__file__).resolve()
    if len(aqui.parents) >= 3 and aqui.parent.name == "scripts" and _es_proyecto(aqui.parents[2]):
        return aqui.parents[2]
    p = Path.cwd().resolve()
    for c in [p, *p.parents]:
        if _es_proyecto(c):
            return c
    candidatos = []
    mnt = Path.home() / "mnt"
    if mnt.is_dir():
        for c in sorted(mnt.iterdir()):
            if not c.is_dir():
                continue
            if _es_proyecto(c):
                candidatos.append(c)
            else:
                try:
                    candidatos += [h for h in sorted(c.iterdir()) if h.is_dir() and _es_proyecto(h)]
                except OSError:
                    pass
    if len(candidatos) == 1:
        return candidatos[0].resolve()
    if not obligatoria:
        return None
    if candidatos:
        sys.exit("Hay varios proyectos en las carpetas conectadas: " + ", ".join(str(c) for c in candidatos)
                 + ". Entra con cd al que corresponde y vuelve a ejecutar.")
    sys.exit("No encontré .pipeline/pipeline.json. Entra con cd a la carpeta del proyecto, o corre /delivery:init-project "
             "si el proyecto aún no está inicializado.")
