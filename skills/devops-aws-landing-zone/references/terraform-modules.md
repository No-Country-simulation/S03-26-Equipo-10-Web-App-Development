# Estructura Modular de Terraform

## Directorio recomendado

```text
infra/terraform/
├── backend.tf
├── providers.tf
├── variables.tf
├── main.tf
├── outputs.tf
├── modules/
│   ├── vpc/
│   ├── security/
│   ├── ecs/
│   └── rds/
└── environments/
    ├── dev/
    └── prod/
```

## Responsabilidad por modulo

### `modules/vpc`

- Crear VPC, subnets publicas y privadas, route tables, IGW y NAT opcional.
- Exponer como outputs: `vpc_id`, `public_subnet_ids`, `private_app_subnet_ids`, `private_db_subnet_ids`.

### `modules/security`

- Crear SG del ALB, ECS y RDS.
- Crear IAM roles para task execution y task role.
- Permitir que solo ECS hable con RDS en el puerto de PostgreSQL.

### `modules/ecs`

- Crear cluster ECS.
- Definir task definition con secretos inyectados desde Secrets Manager.
- Crear service Fargate en subredes privadas.
- Registrar el servicio en target groups del ALB.
- Configurar autoscaling por CPU y memoria.

### `modules/rds`

- Crear DB subnet group sobre subredes privadas de datos.
- Crear instancia o despliegue Multi-AZ PostgreSQL con cifrado habilitado.
- Exponer endpoint, puerto y nombre del secreto relacionado, nunca la password en claro.

## Root module

El root module debe limitarse a:

- Declarar provider y backend.
- Definir variables globales.
- Instanciar modulos y pasar outputs entre ellos.
- Exponer outputs utiles para integracion.

No debe contener reglas de SG, recursos ECS o recursos RDS inline salvo un caso excepcional y documentado.

## Inputs minimos recomendados

- `project_name`
- `environment`
- `aws_region`
- `vpc_cidr`
- `availability_zones`
- `container_image`
- `container_port`
- `desired_count`
- `db_name`
- `db_instance_class`
- `secret_arn`

## Outputs utiles

- `alb_dns_name`
- `ecs_cluster_name`
- `ecs_service_name`
- `rds_endpoint`
- `vpc_id`

## Convenciones

- Nombrar recursos con `project_name` + `environment`.
- Mantener `variables.tf` y `outputs.tf` por modulo.
- Usar `tags` comunes en todos los recursos.
- Reservar `environments/dev` y `environments/prod` para valores no sensibles y composicion por entorno.
