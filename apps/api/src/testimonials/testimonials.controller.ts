import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { AdminGuard } from '../auth/guards/admin.guard';
import { RequestWithUser } from '../auth/auth.types';
import { CreateTestimonialDto } from './dto/create-testimonial.dto';
import { UpdateTestimonialStatusDto } from './dto/update-testimonial-status.dto';
import { TestimonialsService } from './testimonials.service';

@Controller('testimonials')
export class TestimonialsController {
  constructor(private readonly testimonialsService: TestimonialsService) {}

  @Get()
  findAll() {
    return this.testimonialsService.findAll();
  }

  @Get('published')
  findPublished() {
    return this.testimonialsService.findPublished();
  }

  @UseGuards(AdminGuard)
  @Post()
  create(
    @Body() dto: CreateTestimonialDto,
    @Req() request: Request,
  ) {
    return this.testimonialsService.create(
      dto,
      (request as RequestWithUser).user,
    );
  }

  @UseGuards(AdminGuard)
  @Patch(':id/status')
  updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateTestimonialStatusDto,
  ) {
    return this.testimonialsService.updateStatus(id, dto);
  }
}
