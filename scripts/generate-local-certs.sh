#!/usr/bin/env bash
set -e

CERTS_DIR="infra/nginx/certs"
DOMAIN="dev.testimonialcms.local"

# Verificar si mkcert esta instalado
if ! command -v mkcert &> /dev/null; then
    echo "mkcert no encontrado. Intentando instalar mkcert..."
    if command -v apt-get &> /dev/null; then
        echo "Usando apt-get para instalar dependencias..."
        sudo apt-get update
        sudo apt-get install -y libnss3-tools curl
        curl -JLO "https://dl.filippo.io/mkcert/latest?for=linux/amd64"
        chmod +x mkcert-v*-linux-amd64
        sudo mv mkcert-v*-linux-amd64 /usr/local/bin/mkcert
    elif command -v dnf &> /dev/null; then
        echo "Usando dnf para instalar dependencias (Fedora)..."
        sudo dnf install -y nss-tools curl
        curl -JLO "https://dl.filippo.io/mkcert/latest?for=linux/amd64"
        chmod +x mkcert-v*-linux-amd64
        sudo mv mkcert-v*-linux-amd64 /usr/local/bin/mkcert
    elif command -v brew &> /dev/null; then
        echo "Usando brew para instalar mkcert..."
        brew install mkcert
        brew install nss
    else
        echo "No se pudo instalar mkcert de forma automatica. Por favor instala mkcert manualmente."
        exit 1
    fi
fi

# Crear directorio de certificados si no existe
mkdir -p "$CERTS_DIR"

# Instalar CA local en el sistema
echo "Instalando la Autoridad Certificadora (CA) local..."
mkcert -install

# Generar certificados
echo "Generando certificados TLS para $DOMAIN y localhost..."
mkcert -cert-file "$CERTS_DIR/cert.pem" -key-file "$CERTS_DIR/key.pem" "$DOMAIN" "*.testimonialcms.local" localhost 127.0.0.1 ::1

echo "Certificados generados exitosamente en $CERTS_DIR."
