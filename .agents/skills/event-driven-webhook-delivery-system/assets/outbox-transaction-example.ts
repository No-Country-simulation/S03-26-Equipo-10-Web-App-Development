import { Injectable } from '@nestjs/common';
import { PrismaService } from './prisma.service';

/**
 * Ejemplo de Implementación del Patrón Transactional Outbox
 * Skill: SKL-SYS-001
 */

@Injectable()
export class TestimonialService {
  constructor(private prisma: PrismaService) {}

  async create(tenantId: string, data: any) {
    // Usamos una transacción para asegurar que el negocio y el evento ocurran juntos
    return this.prisma.$transaction(async (tx) => {
      // 1. Lógica de Negocio
      const testimonial = await tx.testimonial.create({
        data: {
          ...data,
          tenantId,
          statusId: 1, // Pending
        },
      });

      // 2. Creación del Evento en el Outbox
      // Este evento será procesado asincrónicamente por un Worker
      await tx.outboxEvent.create({
        data: {
          tenantId,
          eventType: 'testimonial.created',
          payload: {
            id: testimonial.id,
            authorName: testimonial.authorName,
            createdAt: testimonial.createdAt,
          },
          status: 'pending',
        },
      });

      return testimonial;
    });
  }
}
