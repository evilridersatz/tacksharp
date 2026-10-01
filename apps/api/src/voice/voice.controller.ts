import {
  Body,
  Controller,
  Get,
  Post,
  Res,
  Param,
  NotFoundException,
} from '@nestjs/common';
import type { Response } from 'express';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { VoiceService } from './voice.service.js';

@Controller('voice')
export class VoiceController {
  constructor(
    private readonly voiceService: VoiceService,
  ) {}

  @Get('health')
  health() {
    return {
      success: true,
      service: 'tacksharp-voice',
      status: 'ready',
    };
  }

  @Get('answer')
  answer(@Res() res: Response) {
    res.type('application/xml');
    res.send(
      this.voiceService.answerXml(),
    );
  }

  @Post('answer')
  answerPost(@Res() res: Response) {
    res.type('application/xml');
    res.send(
      this.voiceService.answerXml(),
    );
  }

  @Post('input')
  async input(
    @Body() body: any,
    @Res() res: Response,
  ) {
    res.type('application/xml');
    res.send(
      await this.voiceService.handleSpeech(body),
    );
  }

  @Post('call')
  async handleCall(@Body() body: any) {
    return this.voiceService.handleCall(body);
  }

  @Get('audio/:filename')
  async audio(
    @Param('filename') filename: string,
    @Res() res: Response,
  ) {
    // Prevent path traversal.
    const safeFilename =
      path.basename(filename);

    if (
      safeFilename !== filename ||
      !safeFilename.endsWith('.wav')
    ) {
      throw new NotFoundException();
    }

    const audioDir =
      process.env.VOICE_AUDIO_DIR ??
      '/tmp/tacksharp-voice';

    const filePath =
      path.join(
        audioDir,
        safeFilename,
      );

    try {
      const audio =
        await fs.readFile(filePath);

      res.setHeader(
        'Content-Type',
        'audio/wav',
      );

      res.setHeader(
        'Content-Length',
        audio.length.toString(),
      );

      res.setHeader(
        'Cache-Control',
        'public, max-age=3600',
      );

      res.send(audio);
    } catch {
      throw new NotFoundException(
        'Voice audio not found',
      );
    }
  }
}
