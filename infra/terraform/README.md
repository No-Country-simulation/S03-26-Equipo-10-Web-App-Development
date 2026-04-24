# Terraform Infrastructure

Infraestructura real para desplegar `testimonial-cms` en AWS con:

- `web` en ECS Fargate detrás de CloudFront y ALB.
- `api` en ECS Fargate detrás de ALB con TLS.
- `PostgreSQL` en RDS Multi-AZ y subredes privadas.
- `ECR`, `Route53`, `ACM`, `Secrets Manager`, `CloudWatch Logs`.
- estado remoto Terraform en `S3 + DynamoDB`.

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
