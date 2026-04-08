import { Module } from '@nestjs/common';
import { WebhooksModule } from '../../webhooks/webhooks.module';
import { CloudinaryService } from './cloudinary.service';
import { YoutubeService } from './youtube.service';

@Module({
  imports: [WebhooksModule],
  providers: [CloudinaryService, YoutubeService],
  exports: [CloudinaryService, YoutubeService],
})
export class CloudModule {}
