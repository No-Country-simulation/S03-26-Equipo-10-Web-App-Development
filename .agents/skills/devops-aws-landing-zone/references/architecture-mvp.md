# Arquitectura MVP de la Landing Zone

## Objetivo

Usar una topologia minima pero robusta para aplicaciones web en AWS con Terraform, separando red, computo y datos.

## Topologia base

- VPC unica con CIDR parametrico.
- Dos subredes publicas en AZ distintas para el ALB y salida controlada.
- Dos subredes privadas de aplicacion para ECS Fargate.
- Dos subredes privadas de datos para RDS PostgreSQL.
- Internet Gateway para trafico publico hacia el ALB.
- NAT Gateway solo si el workload necesita salida a internet desde privados.
- VPC endpoints cuando el caso pida evitar salida publica para servicios AWS como Secrets Manager.

## Flujo de trafico recomendado

1. El cliente entra por HTTPS al ALB en subredes publicas.
2. El ALB enruta solo a target groups saludables.
3. ECS Fargate corre en subredes privadas, sin IP publica.
4. La aplicacion consume secretos desde Secrets Manager mediante definicion de tarea.
5. RDS PostgreSQL vive en subredes privadas y acepta trafico solo desde ECS.

## Servicios que componen el MVP robusto

- `network`: VPC, subnets, route tables, IGW, NAT opcional.
- `security`: security groups, IAM roles y policies minimas.
- `ecs`: cluster, task definition, service, autoscaling, logs y ALB attachments.
- `rds`: subnet group, instancia PostgreSQL cifrada, parametros basicos y backups.
- `backend`: estado remoto Terraform en S3 con bloqueo via DynamoDB.

## Resiliencia minima esperada

- Distribuir ECS y RDS en al menos dos Availability Zones.
- Ejecutar el servicio ECS con `desired_count >= 2` cuando el entorno no sea local.
- Configurar health checks en el target group con un endpoint de salud real.
- Activar cifrado en reposo para RDS y para el bucket de estado.

## Decisiones por defecto

- Region por defecto: `us-east-1`, salvo que el usuario indique otra.
- Base de datos: PostgreSQL administrado en RDS.
- Compute: ECS Fargate.
- Balanceo: Application Load Balancer.
- Secretos: AWS Secrets Manager.
- Estado Terraform: backend `s3` + `dynamodb_table`.

## Cuando endurecer el baseline

Subir el nivel desde este MVP cuando el prompt pida auditoria, compliance o produccion dura. En ese caso sumar:

- CloudWatch alarms y dashboards.
- Rotacion de secretos.
- KMS keys administradas por cliente si hay requisito formal.
- VPC endpoints adicionales.
- Politicas IAM mas granulares por tarea o servicio.
