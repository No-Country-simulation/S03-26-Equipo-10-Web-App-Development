# Flujos del Sistema y Despliegue (C4 - Secuencia e Infraestructura)

Este documento detalla los flujos de interacción críticos (Perspectiva Funcional) y la topología de la infraestructura (Perspectiva de Despliegue).

## 1. Perspectiva Funcional (Diagramas de Secuencia)

### 1.1. Creación de Testimonio y Disparo de Webhook (Patrón Outbox)

Este flujo demuestra cómo el sistema maneja de forma asíncrona y tolerante a fallos la notificación a sistemas externos (Webhooks) cuando un testimonio cambia de estado (ej. de pendiente a publicado).

```mermaid
sequenceDiagram
    autonumber
    actor U as Usuario (Editor/Admin)
    participant API as API Gateway (NestJS)
    participant DB as PostgreSQL
    participant Redis as Redis Queue (BullMQ)
    participant Worker as Worker Service (BullMQ)
    participant Ext as URL Externa (Webhook)

    U->>API: POST /api/v1/testimonials { data }
    
    rect rgb(230, 240, 255)
    Note over API,DB: Transacción ACID
    API->>DB: BEGIN
    API->>DB: INSERT INTO testimonials (status: 'published')
    API->>DB: INSERT INTO outbox_events (type: 'testimonial.published', status: 'pending')
    API->>DB: COMMIT
    end

    API-->>U: 201 Created (Testimonio generado)

    Note over Worker,DB: Proceso Asíncrono Desacoplado
    loop Cada intervalo (Pooling/Listen)
        Worker->>DB: SELECT * FROM outbox_events WHERE status = 'pending'
        DB-->>Worker: Devuelve eventos
    end

    Worker->>Redis: Encola trabajo de envío de Webhook
    Worker->>DB: UPDATE outbox_events SET status = 'processing'
    
    Worker->>Ext: POST /webhook (Payload del evento, firmado con HMAC)
    
    alt Envío Exitoso (2xx)
        Ext-->>Worker: 200 OK
        Worker->>DB: UPDATE outbox_events SET status = 'processed'
        Worker->>DB: INSERT INTO webhook_deliveries (status: 'success')
    else Envío Fallido o Timeout
        Ext--xWorker: 500 Error / Timeout
        Worker->>Redis: Programa reintento (Exponential Backoff)
        Worker->>DB: INSERT INTO webhook_deliveries (status: 'failed')
    end
```

### 1.2. Generación y Consumo con API Keys

Para que sitios web externos o clientes consuman los testimonios de forma segura (sin exponer un usuario/contraseña de administrador), se emiten API Keys que viajan en el header HTTP.

```mermaid
sequenceDiagram
    autonumber
    actor Admin
    participant AdminApp as Next.js Admin Panel
    participant API as API Gateway (NestJS)
    participant DB as PostgreSQL
    actor Client as Sistema Externo (Website)

    Note over Admin,DB: Fase 1: Emisión de la API Key
    Admin->>AdminApp: Click en "Generar API Key"
    AdminApp->>API: POST /api/v1/api-keys
    API->>API: Genera Key cruda (ej. tkn_abc123)
    API->>API: Hashea la Key (bcrypt)
    API->>DB: INSERT INTO api_keys (key_hash, tenant_id)
    API-->>AdminApp: 201 Created { key: "tkn_abc123" }
    AdminApp-->>Admin: Muestra la Key (Solo una vez)

    Note over Client,DB: Fase 2: Consumo Externo
    Client->>API: GET /api/v1/public/testimonials<br/>Header: X-API-Key: tkn_abc123
    API->>DB: Busca api_keys activas por tenant
    DB-->>API: Devuelve hashes
    API->>API: Verifica si bcrypt_compare(tkn_abc123, hash) == true
    
    alt API Key Válida
        API->>DB: SELECT * FROM testimonials WHERE status = 'published'
        DB-->>API: Lista de testimonios
        API-->>Client: 200 OK (JSON)
    else API Key Inválida o Inactiva
        API-->>Client: 401 Unauthorized
    end
```

### 1.3. Flujo de Autenticación y Autorización (JWT)

El sistema admin utiliza un patrón de sesión corta con `access_token` y rotación de `refresh_token` para mitigar ataques y permitir revocación.

```mermaid
sequenceDiagram
    autonumber
    actor U as Usuario
    participant Next as Next.js Admin
    participant API as Auth Module (NestJS)
    participant DB as PostgreSQL

    U->>Next: Ingresa email y password
    Next->>API: POST /api/v1/auth/login
    API->>DB: Busca usuario por email
    DB-->>API: Usuario + password_hash
    API->>API: Verifica password (bcrypt)
    
    alt Credenciales Válidas
        API->>API: Genera AccessToken (JWT, exp: 15m)
        API->>API: Genera RefreshToken (Opaque, exp: 7d)
        API->>DB: Guarda RefreshToken hasheado
        API-->>Next: 200 OK { accessToken, refreshToken }
        Next->>Next: Guarda en HttpOnly Cookies
        Next-->>U: Redirige al Dashboard
    else Credenciales Inválidas
        API-->>Next: 401 Unauthorized
        Next-->>U: Muestra error
    end
```

---

## 2. Perspectiva de Despliegue (Infraestructura)

El siguiente diagrama muestra la arquitectura de despliegue objetivo (Cloud/Kubernetes o Docker Swarm) y las redes involucradas, cumpliendo el Nivel de "Deployment" del modelo C4.

```mermaid
flowchart TB
    subgraph Internet["Internet Público"]
        C[Cliente Web / Móvil]
        E[Servicios Externos<br/>Slack / CRM]
    end

    subgraph Cloud["Entorno Cloud (AWS / Vercel)"]
        
        subgraph CDN["Edge Network"]
            CF[Cloudflare / Vercel Edge<br/>(WAF, DDoS, Caching Estático)]
        end

        subgraph VPC["Red Privada Virtual (VPC)"]
            
            LB[Load Balancer / Nginx Reverse Proxy]
            
            subgraph K8s["Clúster de Contenedores (Docker / K8s)"]
                
                subgraph NextPods["Frontend Layer"]
                    Next1[Next.js App 1]
                    Next2[Next.js App 2]
                end

                subgraph APIPods["API Layer"]
                    API1[NestJS API 1]
                    API2[NestJS API 2]
                end

                subgraph WorkerPods["Async Processing"]
                    W1[BullMQ Worker 1]
                    W2[BullMQ Worker 2]
                end
            end
            
            subgraph DataStores["Bases de Datos Administradas"]
                PG[(PostgreSQL 16<br/>Primaria / Multi-AZ)]
                REDIS[(Redis 7<br/>Cache & BullMQ)]
            end
        end
    end

    C -- "HTTPS" --> CF
    CF -- "Trafico Limpio" --> LB
    
    LB -- "/admin, /" --> Next1 & Next2
    LB -- "/api" --> API1 & API2

    Next1 & Next2 -- "Llamadas API Internas" --> API1 & API2
    
    API1 & API2 -- "Consultas DML/DDL" --> PG
    API1 & API2 -- "Pub/Sub, Cache" --> REDIS
    
    W1 & W2 -- "Procesa Trabajos" --> REDIS
    W1 & W2 -- "Actualiza Estados" --> PG
    
    W1 & W2 -- "Notificaciones HTTPS" --> E
```
