import { Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module.js';
import { VoiceController } from './voice.controller.js';
import { VoiceService } from './voice.service.js';

@Module({
  imports: [AiModule],
  controllers: [VoiceController],
  providers: [VoiceService],
  exports: [VoiceService],
})
export class VoiceModule {}
