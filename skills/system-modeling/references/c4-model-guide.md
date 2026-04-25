# Guía del Modelo C4 (Contexto, Contenedores, Componentes y Código)

El modelo C4 permite documentar la arquitectura de software de forma jerárquica.

## Nivel 1: Diagrama de Contexto
Muestra el sistema en relación con los usuarios y otros sistemas.

```mermaid
graph LR
    User((Usuario Final)) --> System[Testimonial CMS]
    System --> EmailService[Servicio de Email]
    System --> DB[(Base de Datos)]
```

## Nivel 2: Diagrama de Contenedores
Muestra las aplicaciones (web, móvil, api) y almacenes de datos que componen el sistema.

```mermaid
graph TD
    Web[Next.js App] --> API[NestJS API]
    API --> Postgres[(PostgreSQL)]
    API --> Redis[(Redis Cache)]
    Worker[NestJS Worker] --> API
```

## Nivel 3: Diagrama de Componentes
Desglosa un contenedor en sus componentes internos (módulos, controladores, servicios).

## Nivel 4: Código (Opcional)
Detalles de implementación (Diagramas de clase UML).
