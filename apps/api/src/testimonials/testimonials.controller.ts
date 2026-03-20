import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { AuthenticatedUser } from '../auth/auth.types';
import { CreateTestimonialDto } from './dto/create-testimonial.dto';
import { TestimonialsService } from './testimonials.service';

@Controller('testimonials')
@UseGuards(JwtAuthGuard)
export class TestimonialsController {
  constructor(private readonly testimonialsService: TestimonialsService) {}

  @Get()
  findAll(@CurrentUser() user: AuthenticatedUser) {
    return this.testimonialsService.findAll(user);
  }

  @Post()
  create(
    @Body() dto: CreateTestimonialDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.testimonialsService.create(dto, user);
  }
}
