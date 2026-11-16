#!/usr/bin/env python3
"""Transcribe audios localmente a texto con marcas de tiempo.

Usa faster-whisper si está instalado; si no, openai-whisper. Todo corre en el equipo:
el audio no sale a ningún servicio externo.

Instalación (una vez, pedir permiso al usuario antes):
  pip install faster-whisper        # recomendado, más rápido
  # requiere ffmpeg para algunos formatos: brew install ffmpeg (macOS)

Uso:
  python3 .pipeline/scripts/transcribe.py <audio> [<audio> ...] --salida evidence/_transcripciones \
      [--idioma es] [--modelo small]
"""
import argparse
import sys
from pathlib import Path


def fmt(seg):
    m, s = divmod(int(seg), 60)
    h, m = divmod(m, 60)
    return f"{h:02d}:{m:02d}:{s:02d}"


def con_faster_whisper(rutas, salida, idioma, modelo):
    from faster_whisper import WhisperModel
    m = WhisperModel(modelo, device="auto", compute_type="int8")
    for r in rutas:
        segs, info = m.transcribe(str(r), language=idioma, vad_filter=True)
        lineas = [f"[{fmt(s.start)}] {s.text.strip()}" for s in segs]
        escribir(r, salida, lineas, info.duration)


def con_openai_whisper(rutas, salida, idioma, modelo):
    import whisper
    m = whisper.load_model(modelo)
    for r in rutas:
        res = m.transcribe(str(r), language=idioma)
        lineas = [f"[{fmt(s['start'])}] {s['text'].strip()}" for s in res["segments"]]
        dur = res["segments"][-1]["end"] if res["segments"] else 0
        escribir(r, salida, lineas, dur)


def escribir(ruta, salida, lineas, duracion):
    destino = salida / (Path(ruta).stem + ".txt")
    cab = [f"# Transcripción de {Path(ruta).name}", f"# Duración: {fmt(duracion)}",
           "# Transcripción automática: puede tener errores en nombres propios y cifras.", ""]
    destino.write_text("\n".join(cab + lineas) + "\n", encoding="utf-8")
    print(f"{ruta} -> {destino} ({len(lineas)} segmentos)")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("audios", nargs="+")
    ap.add_argument("--salida", default="evidence/_transcripciones")
    ap.add_argument("--idioma", default="es")
    ap.add_argument("--modelo", default="small", help="tiny, base, small, medium, large-v3 (más grande = más lento y preciso)")
    a = ap.parse_args()
    salida = Path(a.salida)
    salida.mkdir(parents=True, exist_ok=True)
    rutas = [Path(x) for x in a.audios if Path(x).exists()]
    faltan = [x for x in a.audios if not Path(x).exists()]
    if faltan:
        print(f"No existen: {', '.join(faltan)}", file=sys.stderr)
    try:
        con_faster_whisper(rutas, salida, a.idioma, a.modelo)
    except ImportError:
        try:
            con_openai_whisper(rutas, salida, a.idioma, a.modelo)
        except ImportError:
            sys.exit("No hay motor de transcripción. Pide permiso al usuario y ejecuta: pip install faster-whisper")


if __name__ == "__main__":
    main()
