# Mejores Prácticas de Docker (Advanced)

Esta referencia resume las prácticas críticas para cumplir con el Skill **SKL-PRO-002**.

## 1. Optimización de Imágenes

- **Multi-Stage Builds**: Separa el entorno de compilación del de ejecución. Reduce drásticamente el tamaño final (ej: de 1GB a 100MB).
- **Orden de Capas**: Coloca los comandos que menos cambian (como la instalación de dependencias) al principio para aprovechar el caché de Docker.
- **Unión de Comandos**: Usa `&&` para unir comandos `RUN` y limpia archivos temporales en la misma capa.

## 2. Seguridad en Contenedores

- **User Non-Root**: Nunca ejecutes procesos como `root` dentro del contenedor. Usa la instrucción `USER`.
- **Imágenes Base Mínimas**: Prefiere `alpine` o `distroless` sobre distribuciones completas como Ubuntu.
- **Escaneo de Vulnerabilidades**: Integra herramientas como **Trivy** en el pipeline de CI/CD.

## 3. Operación y Resiliencia

- **Healthchecks**: Define la instrucción `HEALTHCHECK` para que el orquestador (ECS, Kubernetes) sepa si la aplicación está realmente lista para recibir tráfico.
- **Límites de Recursos**: Siempre define límites de CPU y Memoria en `docker-compose.yml` para evitar "noisy neighbors".
- **Logging**: Envía logs a `stdout` y `stderr`. Docker se encarga de recolectarlos.

---

## Checklist de Calidad (DoD)

- [ ] ¿El Dockerfile usa multi-stage?
- [ ] ¿Se ejecuta con un usuario no root?
- [ ] ¿Se han eliminado los archivos temporales de instalación?
- [ ] ¿Tiene definido un HEALTHCHECK?
- [ ] ¿Se han evitado secretos en variables de entorno fijas?
