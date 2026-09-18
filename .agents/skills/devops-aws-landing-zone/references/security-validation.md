# Seguridad y Validacion

## Guardrails obligatorios

- No poner credenciales en `.tfvars`, variables por defecto, comentarios, ejemplos ni outputs.
- No abrir el SG de RDS a CIDRs globales.
- No desplegar tareas ECS con `assign_public_ip = true` salvo una justificacion explicita.
- No usar permisos administrativos en roles de ECS.
- No omitir cifrado en RDS ni en el bucket de estado.

## Reglas de seguridad por capa

### ALB

- Permitir `80/443` desde internet solo si el servicio es publico.
- Reenviar al SG de ECS en el puerto del contenedor.

### ECS

- Permitir ingreso solo desde el SG del ALB.
- Permitir egreso minimo necesario.
- Usar un `execution role` para ECR y Secrets Manager.
- Usar un `task role` separado para permisos de la aplicacion.

### RDS

- Permitir ingreso solo desde el SG de ECS.
- Usar subredes privadas de datos y subnet group dedicado.
- Activar backups y `storage_encrypted = true`.

## Validaciones minimas

Ejecutar o recomendar siempre:

```bash
terraform fmt -check
terraform validate
tflint
```

Agregar estas verificaciones cuando corresponda:

- Revisar que el backend remoto use `encrypt = true`.
- Confirmar que exista `dynamodb_table` para bloqueo del estado.
- Confirmar que los secretos viajen en `secrets` de ECS task definition, no en `environment`.
- Confirmar que el target group tenga health check funcional.
- Confirmar que ECS y RDS usen al menos dos AZs si el entorno no es efimero.

## Antipatrones a marcar

- SG de base de datos con `0.0.0.0/0`.
- Passwords parametrizadas como strings planos.
- Todo el stack en un solo `main.tf` sin modulos.
- Recursos criticos en subredes publicas.
- Terraform state local para equipos o entornos compartidos.
- Uso de ClickOps como parte del flujo normal.

## Definition of Done

La solucion debe quedar alineada con estos criterios:

- `terraform validate` y `tflint` pasan o quedan explicitamente preparados.
- La red es independiente del servicio de computo.
- No hay credenciales en texto plano dentro del codigo.
- ECS escala por CPU o memoria.
- RDS queda cifrado y privado.
- El trafico solo llega al contenedor si el health check es satisfactorio.
