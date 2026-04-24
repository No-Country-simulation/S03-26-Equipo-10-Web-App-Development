'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';

/**
 * Ejemplo de Server Action Validado
 * Skill: SKL-JS-002
 */

const schema = z.object({
  title: z.string().min(3, 'El título debe tener al menos 3 caracteres'),
  content: z.string().min(10, 'El contenido debe tener al menos 10 caracteres'),
});

export async function createTestimonial(formData: FormData) {
  // 1. Validar datos con Zod
  const validatedFields = schema.safeParse({
    title: formData.get('title'),
    content: formData.get('content'),
  });

  if (!validatedFields.success) {
    return {
      errors: validatedFields.error.flatten().fieldErrors,
    };
  }

  // 2. Lógica de negocio (Persistencia)
  try {
    // await db.insert(testimonials).values(validatedFields.data);
    console.log('Persistiendo dato:', validatedFields.data);
  } catch (error) {
    return {
      message: 'Error de base de datos: No se pudo crear el testimonio',
    };
  }

  // 3. Revalidar caché y retornar éxito
  revalidatePath('/testimonials');
  return { success: true };
}
