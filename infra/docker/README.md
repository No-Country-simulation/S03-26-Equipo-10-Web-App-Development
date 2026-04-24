# Docker Infrastructure

Artefactos de build para publicar las imágenes de producción en ECR.

## Imágenes

- `infra/docker/api.Dockerfile`
- `infra/docker/web.Dockerfile`

Ambos Dockerfiles usan el repo raíz como contexto porque el proyecto es un monorepo `npm workspaces`.

## Build local

### API

```bash
docker build -f infra/docker/api.Dockerfile -t testimonial-cms-api:local .
```

### Web

```bash
docker build -f infra/docker/web.Dockerfile -t testimonial-cms-web:local .
```

## Runtime esperado

- `api` expone `4000`
- `web` expone `3000`

El frontend se empaqueta con `Next.js standalone` para que la imagen final no dependa de un árbol completo del monorepo.
