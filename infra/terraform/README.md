# Terraform Infrastructure

Infraestructura real para desplegar `testimonial-cms` en AWS con:

- `web` en ECS Fargate detrás de CloudFront y ALB.
- `api` en ECS Fargate detrás de ALB con TLS.
- `PostgreSQL` en RDS Multi-AZ y subredes privadas.
- `Redis 7` en ElastiCache, con TLS, AUTH y acceso solo desde la API; una réplica en producción.
- `ECR`, `Route53`, `ACM`, `Secrets Manager`, `CloudWatch Logs`, filtros de métricas y alarmas CloudWatch/SNS.
- estado remoto Terraform en `S3 + DynamoDB`.
- ACL de egreso en subredes de aplicación para bloquear redes internas habituales; el transporte de webhooks bloquea además DNS privado, redirecciones e IMDS.

La API recibe `METRICS_TOKEN` aleatorio desde Secrets Manager. Configurar `alert_notification_email` en variables de despliegue fuera del repositorio y confirmar la suscripción SNS antes de usar las alarmas en producción. `otel_exporter_otlp_traces_endpoint` es opcional y debe apuntar a un receptor HTTPS accesible desde las tareas. Ver [procedimiento de fase 8](../../docs/operations/14_phase8_observability_rollout.md); Terraform aquí solo prepara recursos, no acredita que estén activos.

## Estructura

```text
infra/terraform/
├── bootstrap/backend/        # Crea bucket S3 y tabla DynamoDB del backend remoto
├── environments/
│   ├── staging/
│   └── production/
├── modules/
│   ├── acm-certificate/
│   ├── alb/
│   ├── cloudfront/
│   ├── dns/
│   ├── ecr/
│   ├── ecs-cluster/
│   ├── ecs-service/
│   ├── network/
│   ├── rds/
│   ├── redis/
│   ├── secrets/
│   └── security/
└── *.tf                      # Root module compartido
```

## Bootstrap del backend remoto

Ejecutar una sola vez:

```bash
cd infra/terraform/bootstrap/backend
terraform init
terraform apply
```

Eso crea:

- bucket `testimonial-cms-terraform-state`
- tabla `testimonial-cms-terraform-locks`

## Despliegue por entorno

### Staging

```bash
cd infra/terraform
terraform init -backend-config=environments/staging/backend.hcl
terraform plan -var-file=environments/staging/terraform.tfvars
terraform apply -var-file=environments/staging/terraform.tfvars
```

### Production

```bash
cd infra/terraform
terraform init -backend-config=environments/production/backend.hcl
terraform plan -var-file=environments/production/terraform.tfvars
terraform apply -var-file=environments/production/terraform.tfvars
```

## Variables sensibles

No están committeadas. Deben inyectarse por `TF_VAR_...` o desde el runner de CI:

- `TF_VAR_jwt_secret`
- `TF_VAR_cloudinary_upload_url`
- `TF_VAR_cloudinary_upload_preset`
- `TF_VAR_youtube_api_key`

## Imágenes

Terraform crea los repositorios ECR y espera imágenes para:

- `web`
- `api`

Los Dockerfiles de producción están en `infra/docker/`.

## Migraciones Prisma

Terraform deja listo el task definition del servicio `api`. Antes de promover tráfico estable, ejecutar una tarea one-off con override de comando:

- `npm run db:migrate --workspace @testimonial-cms/api`

Los datos necesarios para lanzar esa tarea quedan expuestos como outputs de Terraform.

## Ventana de destinos HTTP legados

En el primer despliegue que incorpora el cierre SSRF, fijar `webhook_legacy_http_started_at` a la fecha y hora UTC real (`YYYY-MM-DDTHH:mm:ssZ`) en la configuración del entorno. El valor debe ser idéntico para todas las réplicas y permanecer inmutable durante los 30 días. Si no se establece, el envío a destinos HTTP legados falla cerrado. Las altas y cambios solo aceptan HTTPS.

La ACL de las subredes privadas de aplicación es stateless y se asocia después de crear sus reglas. Validar primero en staging la salud de ambos ALB, PostgreSQL, DNS, CloudWatch y salida HTTPS. AWS no permite filtrar IMDS ni Route 53 Resolver con ACL de VPC; el transporte de webhooks deniega sus IP antes de abrir el socket. Ver [runbook de SSRF](../../docs/operations/08_webhook_ssrf_rollout.md).
