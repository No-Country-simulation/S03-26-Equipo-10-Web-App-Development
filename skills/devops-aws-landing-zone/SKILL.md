---
name: devops-aws-landing-zone
description: Design, scaffold, review, or harden AWS infrastructure as code with Terraform for modern web stacks. Use when Codex needs to work on landing zones, VPC segmentation, ECS Fargate, ALB routing, RDS PostgreSQL, Secrets Manager injection, remote state in S3 with DynamoDB locking, autoscaling, or least-privilege security groups for AWS environments.
---

# Devops Aws Landing Zone

Design AWS Terraform solutions that are modular, secure by default, and ready to evolve into production infrastructure. Prefer this skill for three kinds of work: architecture proposals, Terraform scaffolding, and reviews of existing IaC.

## Workflow

1. Classify the request as one of these paths:
   - `design`: explain the target architecture and justify the tradeoffs.
   - `scaffold`: propose or generate a Terraform layout and starter files.
   - `review`: inspect existing Terraform and call out security, modularity, or operability issues.
2. Anchor every answer to the MVP landing-zone baseline in [references/architecture-mvp.md](references/architecture-mvp.md).
3. Structure Terraform using [references/terraform-modules.md](references/terraform-modules.md) and the templates in `assets/terraform-mvp/`.
4. Apply the mandatory security and validation rules from [references/security-validation.md](references/security-validation.md).
5. When working inside this repository, place real Terraform under `infra/terraform` and keep the skill assets as non-runtime templates only.

## Output Contract

Produce these sections unless the user asks for something narrower:

- `Arquitectura`: describe traffic flow, subnet placement, AZ strategy, and state management.
- `Estructura Terraform`: show the directory tree and the module split.
- `Bloques clave`: include only the snippets needed to illustrate backend, networking, ECS, RDS, secrets, or scaling.
- `Seguridad`: explain SG boundaries, IAM minimums, encryption, and secret handling.
- `Validacion`: list `terraform fmt -check`, `terraform validate`, `tflint`, and any targeted checks that match the request.

## Non-Negotiable Rules

- Keep network, compute, data, and security concerns separated. Do not collapse everything into one root module.
- Keep RDS in private subnets. Do not expose database ingress to `0.0.0.0/0`.
- Allow database access only from the ECS service security group or another explicitly justified producer.
- Use Secrets Manager for runtime credentials. Do not place secrets in `.tfvars`, plain variables, or example code.
- Use remote state in S3 with DynamoDB locking for team-safe Terraform workflows.
- Prefer Multi-AZ layouts for ECS tasks and RDS when the prompt targets shared, staging, or production-like environments.
- Prefer Fargate with ALB health checks and target groups for HTTP workloads unless the user explicitly wants a different compute model.
- Include autoscaling based on CPU or memory whenever the request describes scalable services.

## Repo Guidance

- Align proposals with `docs/operations/01_infrastructure.md`, but keep this skill stricter than the repo narrative when security or Terraform hygiene requires it.
- Treat `infra/terraform/README.md` as a placeholder. If asked to implement Terraform, replace the placeholder incrementally instead of inventing a second IaC root.
- Keep examples parameterized and reusable. Use placeholders such as `project_name`, `environment`, `vpc_cidr`, and `container_image` instead of hard-coded values.

## Resource Map

- Read [references/architecture-mvp.md](references/architecture-mvp.md) for the baseline topology and required AWS services.
- Read [references/terraform-modules.md](references/terraform-modules.md) when you need the module boundaries, root composition, or recommended inputs and outputs.
- Read [references/security-validation.md](references/security-validation.md) when you need guardrails, antipatrones, or a definition-of-done checklist.
- Reuse `assets/terraform-mvp/backend.tf.example` for remote state, `root-main.tf.example` for root composition, `rds.tf.example` for encrypted PostgreSQL, and `ecs-task-and-service.tf.example` for Fargate plus Secrets Manager injection.

## Typical Triggers

Use this skill when the request sounds like any of these:

- "Disena una landing zone AWS con Terraform para una app web."
- "Estructura modulos Terraform para VPC, ECS y RDS."
- "Revisa este stack Terraform y marca riesgos de seguridad."
- "Configura ECS Fargate con RDS Postgres y secretos seguros."
- "Prepara una base IaC modular para AWS siguiendo buenas practicas."
