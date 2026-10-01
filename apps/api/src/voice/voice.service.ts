import { Injectable } from '@nestjs/common';
import { AiService } from '../ai/ai.service.js';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const DEMO_ORGANIZATION_ID = 'org_real_estate_001';

@Injectable()
export class VoiceService {
  private readonly audioDir =
    process.env.VOICE_AUDIO_DIR ??
    '/tmp/tacksharp-voice';

  constructor(private readonly aiService: AiService) {}

  async handleCall(callData: any) {
    const startedAt = Date.now();

    console.log('VOICE CALL RECEIVED');
    console.log(JSON.stringify(callData, null, 2));

    const callId =
      callData.callId ??
      callData.CallUUID ??
      callData.callUUID ??
      '';

    const from =
      callData.from ??
      callData.From ??
      callData.To ??
      callId;

    const message =
      callData.message ??
      callData.Speech ??
      callData.speech ??
      callData.text ??
      '';

    if (!message.trim()) {
      return {
        success: false,
        callId,
        response: '',
        reason: 'No speech received',
      };
    }

    const result =
      await this.aiService.generateResponse({
        organizationId: DEMO_ORGANIZATION_ID,
        channel: 'voice',
        externalId: from,
        message: message.trim(),
        phone: from,
      });

    const elapsed = Date.now() - startedAt;

    console.log(
      `VOICE AI RESPONSE (${elapsed}ms):`,
      result.response,
    );

    return {
      success: true,
      callId,
      conversationId:
        result.conversationId,
      response: result.response,
    };
  }

  answerXml() {
    const baseUrl =
      process.env.PUBLIC_BASE_URL ??
      'http://localhost:3000';

    return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <GetInput
    action="${baseUrl}/voice/input"
    method="POST"
    inputType="speech"
    language="en-US"
    speechModel="phone_call"
    speechEndTimeout="2"
    startInputTimeout="5"
    executionTimeout="20"
    redirect="true">
    <Speak>Hello! Welcome to Tacksharp. Please tell me what you are looking for.</Speak>
  </GetInput>

  <Speak>Sorry, I didn't receive your request. Goodbye.</Speak>
  <Hangup/>
</Response>`;
  }

  async handleSpeech(data: any) {
    const speech =
      data.Speech ??
      data.speech ??
      data.text ??
      '';

    const cleanSpeech = speech.trim();

    console.log(
      'VOICE SPEECH INPUT:',
      JSON.stringify(cleanSpeech),
    );

    const baseUrl =
      process.env.PUBLIC_BASE_URL ??
      'http://localhost:3000';

    if (!cleanSpeech) {
      return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <GetInput
    action="${baseUrl}/voice/input"
    method="POST"
    inputType="speech"
    language="en-US"
    speechModel="phone_call"
    speechEndTimeout="2"
    startInputTimeout="5"
    executionTimeout="15"
    redirect="true">
    <Speak>Sorry, I didn't hear you. Please say that again.</Speak>
  </GetInput>

  <Speak>Sorry, I still didn't receive your request. Goodbye.</Speak>
  <Hangup/>
</Response>`;
    }

    const normalized =
      cleanSpeech
        .toLowerCase()
        .replace(/[.,!?]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

    const endCallPatterns = [
      /\bgoodbye\b/,
      /\bbye\b/,
      /\bbye bye\b/,
      /\bthat's all\b/,
      /\bthats all\b/,
      /\bno thanks\b/,
      /\bno thank you\b/,
      /\bnot interested\b/,
      /\bend the call\b/,
      /\bend call\b/,
      /\bhave a good day\b/,
    ];

    const shouldHangup =
      endCallPatterns.some(
        (pattern) =>
          pattern.test(normalized),
      );

    if (shouldHangup) {
      console.log(
        'VOICE CALL END DETECTED:',
        cleanSpeech,
      );

      const goodbye =
        'Thank you for contacting Tacksharp. Goodbye.';

      const audioUrl =
        await this.generateSarvamTts(goodbye);

      return this.buildAudioResponse(
        audioUrl,
        null,
      );
    }

    const startedAt = Date.now();

    const result =
      await this.handleCall({
        CallUUID: data.CallUUID,
        From: data.From,
        Speech: cleanSpeech,
      });

    const aiElapsed =
      Date.now() - startedAt;

    console.log(
      `VOICE TURN TOTAL AI TIME: ${aiElapsed}ms`,
    );

    const response =
      this.cleanForSpeech(
        result.response,
      );

    console.log(
      'VOICE TTS TEXT:',
      response,
    );

    const audioUrl =
      await this.generateSarvamTts(response);

    return this.buildAudioResponse(
      audioUrl,
      baseUrl,
    );
  }

  private async generateSarvamTts(
    text: string,
  ): Promise<string> {
    const apiKey =
      process.env.SARVAM_API_KEY;

    if (!apiKey) {
      console.warn(
        'SARVAM_API_KEY missing. Falling back to Plivo Speak.',
      );

      return '';
    }

    await fs.mkdir(
      this.audioDir,
      { recursive: true },
    );

    const model =
      process.env.SARVAM_TTS_MODEL ??
      'bulbul:v3';

    const speaker =
      process.env.SARVAM_TTS_SPEAKER ??
      'ishita';

    const languageCode =
      process.env.SARVAM_TTS_LANGUAGE ??
      'ta-IN';

    const pace = Number(
      process.env.SARVAM_TTS_PACE ??
      '0.95',
    );

    const startedAt = Date.now();

    const response =
      await fetch(
        'https://api.sarvam.ai/text-to-speech',
        {
          method: 'POST',
          headers: {
            'api-subscription-key':
              apiKey,
            'Content-Type':
              'application/json',
          },
          body: JSON.stringify({
            text: text.slice(0, 2500),
            model,
            speaker,
            language_code: languageCode,
            pace,
            output_audio_codec: 'wav',
            speech_sample_rate: 24000,
          }),
        },
      );

    if (!response.ok) {
      const errorText =
        await response.text();

      console.error(
        'SARVAM TTS ERROR:',
        response.status,
        errorText,
      );

      // Sarvam gateway/service failure.
      // Return empty URL so Plivo falls back to <Speak>.
      return '';
    }

    const result =
      await response.json() as {
        audios?: string[];
      };

    const audioBase64 =
      result.audios?.[0];

    if (!audioBase64) {
      throw new Error(
        'Sarvam TTS returned no audio',
      );
    }

    const audioBuffer =
      Buffer.from(
        audioBase64,
        'base64',
      );

    const filename =
      `${crypto.randomUUID()}.wav`;

    const filePath =
      path.join(
        this.audioDir,
        filename,
      );

    await fs.writeFile(
      filePath,
      audioBuffer,
    );

    console.log(
      `SARVAM TTS (${Date.now() - startedAt}ms): ${filename}`,
    );

    const publicBaseUrl =
      process.env.PUBLIC_BASE_URL ??
      'http://localhost:3000';

    return `${publicBaseUrl}/voice/audio/${filename}`;
  }

  private buildAudioResponse(
    audioUrl: string,
    baseUrl: string | null,
  ) {
    const fallback =
      baseUrl ??
      process.env.PUBLIC_BASE_URL ??
      'http://localhost:3000';

    const continueXml = `
  <GetInput
    action="${fallback}/voice/input"
    method="POST"
    inputType="speech"
    language="en-US"
    speechModel="phone_call"
    speechEndTimeout="2"
    startInputTimeout="5"
    executionTimeout="20"
    redirect="true">
    <Speak>What else can I help you with?</Speak>
  </GetInput>

  <Speak>Thank you for calling Tacksharp. Goodbye.</Speak>
  <Hangup/>`;

    if (!audioUrl) {
      return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Speak>Sorry, I am unable to respond right now.</Speak>
  ${continueXml}
</Response>`;
    }

    if (audioUrl.endsWith('Goodbye.')) {
      return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Play>${this.escapeXml(audioUrl)}</Play>
  <Hangup/>
</Response>`;
    }

    return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Play>${this.escapeXml(audioUrl)}</Play>
  ${continueXml}
</Response>`;
  }

  private cleanForSpeech(value: string) {
    return value
      .replace(/\*\*/g, '')
      .replace(/[*_`]/g, '')
      .replace(/#{1,6}\s?/g, '')
      .replace(/\n+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private escapeXml(value: string) {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }
}
