import { SessionsService } from './sessions.service';
import { CreateSessionTokenDto } from './dto/session.dto';

describe('SessionsService Voice & Language Mode Configuration', () => {
  let service: SessionsService;
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env.GEMINI_LIVE_VOICE = 'Aoede';
    service = new SessionsService();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  describe('Voice Resolution (getVoiceForSession)', () => {
    it('should default to Aoede for standard coaching sessions', () => {
      const dto = new CreateSessionTokenDto();
      dto.topic = 'General Practice';
      dto.languageMode = 'sinhala';
      expect(service.getVoiceForSession(dto)).toBe('Aoede');
    });

    it('should default to Aoede for English immersion sessions', () => {
      const dto = new CreateSessionTokenDto();
      dto.topic = 'General Practice';
      dto.languageMode = 'english';
      expect(service.getVoiceForSession(dto)).toBe('Aoede');
    });

    it('should respect custom GEMINI_LIVE_VOICE env var', () => {
      process.env.GEMINI_LIVE_VOICE = 'Kore';
      const customService = new SessionsService();
      const dto = new CreateSessionTokenDto();
      expect(customService.getVoiceForSession(dto)).toBe('Kore');
    });

    it('should route scenario emotions appropriately', () => {
      const dto = new CreateSessionTokenDto();
      dto.scenarioPrompt = 'You are an angry customer';
      dto.emotionTags = ['angry', 'strict'];
      expect(service.getVoiceForSession(dto)).toBe('Kore');

      const playfulDto = new CreateSessionTokenDto();
      playfulDto.scenarioPrompt = 'You are a playful friend';
      playfulDto.emotionTags = ['playful'];
      expect(service.getVoiceForSession(playfulDto)).toBe('Puck');
    });
  });

  describe('Language Mode Whitelist (isSinhalaSession)', () => {
    it('should recognize "balanced" as a Sinhala session', () => {
      const dto = new CreateSessionTokenDto();
      dto.languageMode = 'balanced';
      expect(service.isSinhalaSession(dto)).toBe(true);
    });

    it('should recognize "sinhala_support" as a Sinhala session', () => {
      const dto = new CreateSessionTokenDto();
      dto.languageMode = 'sinhala_support';
      expect(service.isSinhalaSession(dto)).toBe(true);
    });

    it('should recognize "deep_guidance" as a Sinhala session', () => {
      const dto = new CreateSessionTokenDto();
      dto.languageMode = 'deep_guidance';
      expect(service.isSinhalaSession(dto)).toBe(true);
    });

    it('should recognize sinhalaStyle = "deep_guidance" even if languageMode is unset', () => {
      const dto = new CreateSessionTokenDto();
      dto.sinhalaStyle = 'deep_guidance';
      expect(service.isSinhalaSession(dto)).toBe(true);
    });

    it('should recognize "english" and "english_only" as non-Sinhala', () => {
      const dtoEng = new CreateSessionTokenDto();
      dtoEng.languageMode = 'english';
      expect(service.isSinhalaSession(dtoEng)).toBe(false);

      const dtoEngOnly = new CreateSessionTokenDto();
      dtoEngOnly.languageMode = 'english_only';
      expect(service.isSinhalaSession(dtoEngOnly)).toBe(false);
    });
  });

  describe('Prompt Acoustic Guardrails & Vocal Identity', () => {
    it('should include vocal stability and anti-mirroring directives in intro prompt', () => {
      const dto = new CreateSessionTokenDto();
      dto.isIntroCall = true;
      dto.languageMode = 'sinhala';
      dto.sinhalaStyle = 'balanced';
      const prompt = service.getIntroCallSystemPrompt(dto, 'Student', true);

      expect(prompt).toContain('MANDATORY VOCAL IDENTITY & STABILITY (CRITICAL)');
      expect(prompt).toContain('Aoede');
      expect(prompt).toContain('NEVER alter, shift, or drop your speaking voice');
      expect(prompt).toContain('NEVER mimic, mirror, or adopt the student\'s gender, pitch, accent');
      expect(prompt).toContain('BILINGUAL CODE-SWITCHING & PRONUNCIATION (SINHALA + ENGLISH)');
    });

    it('should adapt intro call prompt for deep guidance mode', () => {
      const dto = new CreateSessionTokenDto();
      dto.isIntroCall = true;
      dto.languageMode = 'sinhala';
      dto.sinhalaStyle = 'deep_guidance';
      const prompt = service.getIntroCallSystemPrompt(dto, 'Student', true);

      expect(prompt).toContain('BILINGUAL DEEP GUIDANCE MODE');
    });

    it('should include vocal stability in recurring session prompts', () => {
      const dto = new CreateSessionTokenDto();
      dto.topic = 'Ordering Food';
      dto.languageMode = 'sinhala';
      dto.sinhalaStyle = 'balanced';
      dto.userName = 'W.M. Kaveesha Bandara';
      const prompt = service.getSystemPrompt(dto);

      expect(prompt).toContain('MANDATORY VOCAL IDENTITY & STABILITY (CRITICAL)');
      expect(prompt).toContain('BILINGUAL TEACHING (BALANCED MODE)');
      expect(prompt).not.toContain('SMART GUIDANCE MODE');
      expect(prompt).toContain('NEVER address, pronounce, or call the student by their name, username, or initials');
      expect(prompt).not.toContain('W.M. Kaveesha Bandara');
    });

    it('should configure dual-language directives for deep guidance recurring sessions', () => {
      const dto = new CreateSessionTokenDto();
      dto.topic = 'Daily Routine';
      dto.languageMode = 'sinhala';
      dto.sinhalaStyle = 'deep_guidance';
      const prompt = service.getSystemPrompt(dto);

      expect(prompt).toContain('BILINGUAL TEACHING (DEEP GUIDANCE MODE)');
      expect(prompt).toContain('DUAL-LANGUAGE TURN STRUCTURE: In EVERY single spoken turn');
      expect(prompt).toContain('SCAFFOLDING & TRANSLATION SUPPORT');

      const greeting = service.generateGreetingPrompt(dto);
      expect(greeting).toContain('ask your opening practice question aloud in both Sinhala and English');
    });

    it('should strip usernames from roleplay scenario prompts', () => {
      const dto = new CreateSessionTokenDto();
      dto.scenarioTitle = 'Job Interview';
      dto.scenarioPrompt = 'Greet {{userName}} and ask for their resume.';
      dto.userName = 'M.A.C. Perera';
      const prompt = service.buildScenarioSystemPrompt(dto, dto.userName, true);

      expect(prompt).toContain('CRITICAL NAME DIRECTIVE: NEVER pronounce, guess, or address the student by any name, username, or initials');
      expect(prompt).not.toContain('M.A.C. Perera');
    });
  });
});
