#!/bin/bash
# Doble clic para iniciar Delivery Studio (Mac).
cd "$(dirname "$0")"
node scripts/iniciar.mjs
echo; read -n 1 -s -r -p "Servidor detenido. Pulsa una tecla para cerrar."
