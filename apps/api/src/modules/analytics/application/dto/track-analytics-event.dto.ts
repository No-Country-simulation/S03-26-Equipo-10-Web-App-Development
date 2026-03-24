import { IsIn, IsOptional, IsString, IsUUID } from 'class-validator';

export class TrackAnalyticsEventDto {
  @IsUUID()
  testimonialId!: string;

  @IsIn(['view', 'click', 'play'])
  eventType!: 'view' | 'click' | 'play';

  @IsOptional()
  @IsString()
  source?: string;
}
