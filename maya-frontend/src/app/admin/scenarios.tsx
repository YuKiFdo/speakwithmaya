import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  Modal,
  ActivityIndicator,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Feather, Ionicons } from '@expo/vector-icons';
import { fontStyle } from '@/theme/fonts';
import { useBreakpoint } from '@/hooks/useBreakpoint';
import { useUserStats } from '@/hooks/useUserStats';
import { CallSessionStore } from '@/services/store/call-session-store';
import { getBackendBaseUrl } from '@/hooks/useLiveCall';
import { AdminSidebar } from '@/components/admin/AdminSidebar';
import { AdminTopBar } from '@/components/admin/AdminTopBar';
import { AdminTableSkeleton } from '@/components/ui/skeleton';

export interface ScenarioItem {
  id: string;
  levelNumber: number;
  title: string;
  description: string;
  topic: string;
  xpReward: number;
  targetDurationMinutes?: number;
  iconType: 'robot' | 'chat' | 'family' | 'home' | 'wave' | 'directions';
  numberColor: string;
  haloColor: string;
  haloBorderColor: string;
  scenarioId?: string;
  customSvg?: string;
  practicePoints: string[];
  canonicalContent: string;
  passingScorePercent?: number;
  scenarioPrompt?: string;
  openingMode?: 'maya_explains_first' | 'maya_in_character' | 'user_starts';
  openingLine?: string;
  scenarioBriefing?: string;
  emotionTags?: string[];
  isScenarioMode?: boolean;
  userRole?: string;
  mayaRole?: string;
  goalTitle?: string;
  goalDescription?: string;
  ttsScriptEnglish?: string;
  ttsScriptSinhala?: string;
  audioUrlEnglish?: string;
  audioUrlSinhala?: string;
  isPublished: boolean;
  createdAt?: string;
  updatedAt?: string;
}

const COLOR_THEMES = [
  { name: 'Blue', numberColor: '#0057FF', haloColor: '#EFF6FF', haloBorderColor: '#BFDBFE' },
  { name: 'Rose', numberColor: '#E11D48', haloColor: '#FFF1F2', haloBorderColor: '#FECDD3' },
  { name: 'Amber', numberColor: '#D97706', haloColor: '#FFFBEB', haloBorderColor: '#FDE68A' },
  { name: 'Purple', numberColor: '#9333EA', haloColor: '#FAF5FF', haloBorderColor: '#E9D5FF' },
  { name: 'Green', numberColor: '#16A34A', haloColor: '#F0FDF4', haloBorderColor: '#BBF7D0' },
  { name: 'Indigo', numberColor: '#4F46E5', haloColor: '#EEF2FF', haloBorderColor: '#C7D2FE' },
];

const PLACEHOLDER_COLOR = 'rgba(148, 163, 184, 0.45)';

const EMOTION_BADGES: Record<string, { label: string; bg: string; text: string; icon: string }> = {
  angry: { label: 'Angry / Frustrated', bg: '#fef2f2', text: '#ef4444', icon: 'zap' },
  crying: { label: 'Crying / Emotional', bg: '#eff6ff', text: '#3b82f6', icon: 'cloud-rain' },
  cheerful: { label: 'Cheerful / Upbeat', bg: '#f0fdf4', text: '#16a34a', icon: 'sun' },
  strict: { label: 'Strict / Skeptical', bg: '#faf5ff', text: '#9333ea', icon: 'shield' },
  professional: { label: 'Professional / Formal', bg: '#f8fafc', text: '#475569', icon: 'briefcase' },
  neutral: { label: 'Balanced / Coaching', bg: '#f1f5f9', text: '#64748b', icon: 'message-circle' },
};

const OPENING_MODES = [
  {
    id: 'maya_explains_first' as const,
    title: '🎙️ Maya explains setup, then starts roleplay',
    desc: 'Maya welcomes user, states the scenario in 1 sentence, then speaks in character.',
  },
  {
    id: 'maya_in_character' as const,
    title: '⚡ Maya starts straight in character',
    desc: 'Maya immediately begins in role with zero introduction (immersive).',
  },
  {
    id: 'user_starts' as const,
    title: '👤 Student speaks first',
    desc: 'Maya waits for the student to start the conversation.',
  },
];

export default function AdminScenariosScreen() {
  const { isPhone } = useBreakpoint();
  const userStats = useUserStats();

  const [sidebarOpen, setSidebarOpen] = useState(!isPhone);
  const [scenarios, setScenarios] = useState<ScenarioItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isGeneratingPrompt, setIsGeneratingPrompt] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [filterEmotion, setFilterEmotion] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // 2-Step Wizard State
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingScenario, setEditingScenario] = useState<ScenarioItem | null>(null);
  const [wizardStep, setWizardStep] = useState<'details' | 'prompt'>('details');

  // Form Fields - Step 1: Details & Level Settings
  const [formLevelNumber, setFormLevelNumber] = useState<number>(1);
  const [formTitle, setFormTitle] = useState('');
  const [formTopic, setFormTopic] = useState('');
  const [formBriefing, setFormBriefing] = useState('');
  const [formUserRole, setFormUserRole] = useState('');
  const [formMayaRole, setFormMayaRole] = useState('');
  const [formGoalTitle, setFormGoalTitle] = useState('');
  const [formGoalDescription, setFormGoalDescription] = useState('');
  const [formTargetDurationMinutes, setFormTargetDurationMinutes] = useState<number>(6);
  const [formPassingScore, setFormPassingScore] = useState<number>(70);
  const [formXpReward, setFormXpReward] = useState<number>(100);
  const [formColorIdx, setFormColorIdx] = useState(0);
  const [formIcon, setFormIcon] = useState<'robot' | 'chat' | 'family' | 'home' | 'wave' | 'directions'>('chat');
  const [formCustomSvg, setFormCustomSvg] = useState('');
  const [formIsPublished, setFormIsPublished] = useState(true);

  // Form Fields - Step 2: AI Prompt & Persona Directive
  const [formEmotion, setFormEmotion] = useState<string>('neutral');
  const [formOpeningMode, setFormOpeningMode] = useState<'maya_explains_first' | 'maya_in_character' | 'user_starts'>('maya_explains_first');
  const [formOpeningLine, setFormOpeningLine] = useState('');
  const [formPrompt, setFormPrompt] = useState('');
  const [formTtsEnglish, setFormTtsEnglish] = useState('');
  const [formTtsSinhala, setFormTtsSinhala] = useState('');
  const [formAudioUrlEnglish, setFormAudioUrlEnglish] = useState('');
  const [formAudioUrlSinhala, setFormAudioUrlSinhala] = useState('');
  const [isUploadingAudio, setIsUploadingAudio] = useState<'en' | 'si' | null>(null);
  const [ttsAudioPlaying, setTtsAudioPlaying] = useState<'en' | 'si' | null>(null);
  const [isSynthesizingPreview, setIsSynthesizingPreview] = useState<'en' | 'si' | null>(null);
  const previewAudioRef = React.useRef<any>(null);

  // Stop audio preview when leaving or unmounting
  useEffect(() => {
    return () => {
      if (previewAudioRef.current) {
        previewAudioRef.current.pause();
        previewAudioRef.current = null;
      }
    };
  }, []);

  // Fetch scenarios from backend
  const fetchScenarios = async () => {
    setIsLoading(true);
    setErrorMsg('');
    try {
      const baseUrl = getBackendBaseUrl();
      const res = await fetch(`${baseUrl}/v1/admin/roadmap`);
      if (res.ok) {
        const json = await res.json();
        setScenarios(json.levels || []);
      } else {
        setErrorMsg('Could not fetch scenarios. Ensure maya-backend is running.');
      }
    } catch (e: any) {
      setErrorMsg(`Connection error: ${e?.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchScenarios();
  }, []);

  const openNewScenarioModal = () => {
    const nextNumber = scenarios.length > 0 ? Math.max(...scenarios.map((s) => s.levelNumber)) + 1 : 1;
    // Session duration cap randomly assigned between 5-8 minutes
    const randomDuration = Math.floor(Math.random() * 4) + 5;

    if (previewAudioRef.current) {
      previewAudioRef.current.pause();
      previewAudioRef.current = null;
    }
    setTtsAudioPlaying(null);

    setEditingScenario(null);
    setWizardStep('details');
    setFormLevelNumber(nextNumber);
    setFormTitle('');
    setFormTopic('Role Play Practice');
    setFormBriefing('');
    setFormUserRole('');
    setFormMayaRole('');
    setFormGoalTitle('');
    setFormGoalDescription('');
    setFormTargetDurationMinutes(randomDuration);
    setFormPassingScore(70);
    setFormXpReward(100);
    setFormColorIdx((nextNumber - 1) % COLOR_THEMES.length);
    setFormIcon('chat');
    setFormCustomSvg('');
    setFormIsPublished(true);

    // Prompt & Voice fields
    setFormEmotion('neutral');
    setFormOpeningMode('maya_explains_first');
    setFormOpeningLine('');
    setFormPrompt('');
    setFormTtsEnglish('');
    setFormTtsSinhala('');
    setFormAudioUrlEnglish('');
    setFormAudioUrlSinhala('');

    setIsEditorOpen(true);
  };

  const openEditModal = (item: ScenarioItem) => {
    if (previewAudioRef.current) {
      previewAudioRef.current.pause();
      previewAudioRef.current = null;
    }
    setTtsAudioPlaying(null);

    setEditingScenario(item);
    setWizardStep('details');
    setFormLevelNumber(item.levelNumber);
    setFormTitle(item.title);
    setFormTopic(item.topic || 'Role Play Practice');
    setFormBriefing(item.scenarioBriefing || item.description || '');
    setFormUserRole(item.userRole || '');
    setFormMayaRole(item.mayaRole || '');
    setFormGoalTitle(item.goalTitle || '');
    setFormGoalDescription(item.goalDescription || '');
    setFormTargetDurationMinutes(item.targetDurationMinutes || 6);
    setFormPassingScore(item.passingScorePercent ?? 70);
    setFormXpReward(item.xpReward || 100);
    setFormIcon(item.iconType || 'chat');
    setFormCustomSvg(item.customSvg || '');
    const colorIdx = COLOR_THEMES.findIndex((c) => c.numberColor === item.numberColor);
    setFormColorIdx(colorIdx !== -1 ? colorIdx : 0);
    setFormIsPublished(item.isPublished);

    // Prompt & Voice fields
    setFormEmotion(item.emotionTags && item.emotionTags[0] ? item.emotionTags[0] : 'neutral');
    setFormOpeningMode(item.openingMode || 'maya_explains_first');
    setFormOpeningLine(item.openingLine || '');
    setFormPrompt(item.scenarioPrompt || '');
    setFormTtsEnglish(item.ttsScriptEnglish || '');
    setFormTtsSinhala(item.ttsScriptSinhala || '');
    setFormAudioUrlEnglish(item.audioUrlEnglish || '');
    setFormAudioUrlSinhala(item.audioUrlSinhala || '');

    setIsEditorOpen(true);
  };

  const handleGeneratePromptWithAI = async () => {
    if (!formTitle.trim()) {
      alert('Please enter a Scenario Title before generating the prompt.');
      return;
    }
    if (!formBriefing.trim()) {
      alert('Please enter the Mission Briefing / Situation premise.');
      return;
    }
    if (!formUserRole.trim() || !formMayaRole.trim()) {
      alert("Please specify both Student's Role and Maya's Role.");
      return;
    }
    if (!formGoalTitle.trim()) {
      alert("Please specify the Student's Goal Title.");
      return;
    }

    setIsGeneratingPrompt(true);
    try {
      const baseUrl = getBackendBaseUrl();
      const res = await fetch(`${baseUrl}/v1/admin/roadmap/generate-prompt`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: formTitle.trim(),
          topic: formTopic.trim() || 'Role Play Practice',
          briefing: formBriefing.trim(),
          userRole: formUserRole.trim(),
          mayaRole: formMayaRole.trim(),
          goalTitle: formGoalTitle.trim(),
          goalDescription: formGoalDescription.trim(),
        }),
      });

      if (!res.ok) {
        throw new Error(await res.text());
      }

      const data = await res.json();
      if (data.emotion) setFormEmotion(data.emotion);
      if (data.openingMode) setFormOpeningMode(data.openingMode);
      if (data.openingLine !== undefined) setFormOpeningLine(data.openingLine);
      if (data.scenarioPrompt) setFormPrompt(data.scenarioPrompt);
      if (data.ttsScriptEnglish) setFormTtsEnglish(data.ttsScriptEnglish);
      if (data.ttsScriptSinhala) setFormTtsSinhala(data.ttsScriptSinhala);

      setWizardStep('prompt');
    } catch (err: any) {
      alert(`Could not generate prompt with AI: ${err?.message || 'Server error'}`);
    } finally {
      setIsGeneratingPrompt(false);
    }
  };

  const handlePlayCustomAudio = async (url: string, lang: 'en' | 'si') => {
    if (ttsAudioPlaying === lang) {
      if (previewAudioRef.current) {
        previewAudioRef.current.pause();
        previewAudioRef.current = null;
      }
      setTtsAudioPlaying(null);
      return;
    }
    if (previewAudioRef.current) {
      previewAudioRef.current.pause();
      previewAudioRef.current = null;
    }
    if (typeof Audio !== 'undefined') {
      const audio = new Audio(url);
      previewAudioRef.current = audio;
      setTtsAudioPlaying(lang);
      const cleanup = () => {
        setTtsAudioPlaying(null);
        previewAudioRef.current = null;
      };
      audio.onended = cleanup;
      audio.onerror = cleanup;
      await audio.play();
    }
  };

  const triggerUploadWav = (lang: 'en' | 'si') => {
    if (typeof document === 'undefined') {
      alert('Audio file upload is supported on web browsers.');
      return;
    }
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.wav,audio/wav,audio/x-wav';
    input.onchange = async (e: any) => {
      const file = e.target?.files?.[0];
      if (!file) return;
      if (!file.name.toLowerCase().endsWith('.wav') && !file.type.includes('wav')) {
        alert('Please select a valid .wav audio file.');
        return;
      }
      await uploadWavFile(file, lang);
    };
    input.click();
  };

  const uploadWavFile = async (file: File, lang: 'en' | 'si') => {
    setIsUploadingAudio(lang);
    try {
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const base64Data = (reader.result as string) || '';
          const baseUrl = getBackendBaseUrl();
          const res = await fetch(`${baseUrl}/v1/admin/roadmap/upload-audio`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              levelId: editingScenario?.id,
              language: lang,
              audioBase64: base64Data,
              fileName: file.name,
            }),
          });
          if (!res.ok) {
            let errText = 'Upload failed';
            try {
              const errJson = await res.json();
              errText = errJson.message || errJson.error || errText;
            } catch {
              errText = await res.text();
            }
            throw new Error(errText);
          }
          const data = await res.json();
          if (lang === 'en') {
            setFormAudioUrlEnglish(data.publicUrl);
          } else {
            setFormAudioUrlSinhala(data.publicUrl);
          }
          alert(`Successfully uploaded custom .wav file for ${lang === 'en' ? 'English' : 'Sinhala'}!`);
        } catch (err: any) {
          alert(`Upload error: ${err?.message || 'Failed to upload audio'}`);
        } finally {
          setIsUploadingAudio(null);
        }
      };
      reader.onerror = () => {
        alert('Failed to read the selected file.');
        setIsUploadingAudio(null);
      };
      reader.readAsDataURL(file);
    } catch (err: any) {
      alert(`File selection error: ${err?.message}`);
      setIsUploadingAudio(null);
    }
  };

  const handleRemoveCustomAudio = (lang: 'en' | 'si') => {
    if (
      confirm(
        `Remove custom uploaded audio for ${lang === 'en' ? 'English' : 'Sinhala'} and revert back to auto-generated TTS?`
      )
    ) {
      if (lang === 'en') {
        setFormAudioUrlEnglish('');
      } else {
        setFormAudioUrlSinhala('');
      }
    }
  };

  const handlePreviewTts = async (lang: 'en' | 'si') => {
    if (ttsAudioPlaying === lang) {
      if (previewAudioRef.current) {
        previewAudioRef.current.pause();
        previewAudioRef.current = null;
      }
      setTtsAudioPlaying(null);
      return;
    }

    // 1. If custom uploaded audio exists, play it directly
    const customUrl = lang === 'si' ? formAudioUrlSinhala : formAudioUrlEnglish;
    if (customUrl && customUrl.startsWith('http')) {
      await handlePlayCustomAudio(customUrl, lang);
      return;
    }

    const text = lang === 'en' ? formTtsEnglish.trim() : formTtsSinhala.trim();
    if (!text) {
      alert(`Please enter or generate the ${lang === 'en' ? 'English' : 'Sinhala'} speech script first.`);
      return;
    }
    // If editing existing scenario with unchanged script, play direct from Supabase Edge CDN instantly (0ms)
    const existingCdnUrl = lang === 'si' ? editingScenario?.audioUrlSinhala : editingScenario?.audioUrlEnglish;
    const existingScript = (lang === 'si' ? editingScenario?.ttsScriptSinhala : editingScenario?.ttsScriptEnglish)?.trim();
    if (existingCdnUrl && existingCdnUrl.startsWith('http') && existingScript === text) {
      if (previewAudioRef.current) {
        previewAudioRef.current.pause();
        previewAudioRef.current = null;
      }
      if (typeof Audio !== 'undefined') {
        const audio = new Audio(existingCdnUrl);
        previewAudioRef.current = audio;
        setTtsAudioPlaying(lang);
        const cleanup = () => {
          setTtsAudioPlaying(null);
          previewAudioRef.current = null;
        };
        audio.onended = cleanup;
        audio.onerror = cleanup;
        await audio.play();
        return;
      }
    }

    setIsSynthesizingPreview(lang);
    try {
      const baseUrl = getBackendBaseUrl();
      const res = await fetch(`${baseUrl}/v1/admin/roadmap/synthesize-tts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'audio/wav, application/json;q=0.9',
        },
        body: JSON.stringify({ text, language: lang }),
      });
      if (!res.ok) {
        let errMessage = 'Failed to synthesize TTS';
        try {
          const errJson = await res.json();
          errMessage = errJson.error || errJson.message || errMessage;
        } catch {
          errMessage = await res.text();
        }
        throw new Error(errMessage);
      }

      const contentType = res.headers.get('content-type') || '';
      let audioUrl = '';
      if (contentType.includes('application/json')) {
        const json = await res.json();
        if (!json.audioBase64) throw new Error('No audio returned in response');
        audioUrl = `data:${json.mimeType || 'audio/wav'};base64,${json.audioBase64}`;
      } else {
        const blob = await res.blob();
        audioUrl = URL.createObjectURL(blob);
      }

      if (previewAudioRef.current) {
        previewAudioRef.current.pause();
        previewAudioRef.current = null;
      }
      if (typeof Audio !== 'undefined') {
        const audio = new Audio(audioUrl);
        previewAudioRef.current = audio;
        setTtsAudioPlaying(lang);
        const cleanup = () => {
          setTtsAudioPlaying(null);
          previewAudioRef.current = null;
          if (audioUrl.startsWith('blob:')) {
            URL.revokeObjectURL(audioUrl);
          }
        };
        audio.onended = cleanup;
        audio.onerror = cleanup;
        await audio.play();
      }
    } catch (err: any) {
      alert(`Speech synthesis error: ${err?.message || 'Failed'}`);
    } finally {
      setIsSynthesizingPreview(null);
    }
  };

  const handleSaveScenario = async () => {
    if (!formTitle.trim()) {
      alert('Please enter a Scenario Title.');
      return;
    }
    setIsSaving(true);
    const theme = COLOR_THEMES[formColorIdx];

    const payload = {
      levelNumber: Number(formLevelNumber),
      title: formTitle.trim(),
      description: formBriefing.trim(),
      scenarioBriefing: formBriefing.trim(),
      userRole: formUserRole.trim(),
      mayaRole: formMayaRole.trim(),
      goalTitle: formGoalTitle.trim(),
      goalDescription: formGoalDescription.trim(),
      topic: formTopic.trim() || 'Roleplay Scenario',
      targetDurationMinutes: Number(formTargetDurationMinutes) || 6,
      scenarioPrompt: formPrompt.trim(),
      openingMode: formOpeningMode,
      openingLine: formOpeningLine.trim(),
      ttsScriptEnglish: formTtsEnglish.trim(),
      ttsScriptSinhala: formTtsSinhala.trim(),
      audioUrlEnglish: formAudioUrlEnglish.trim(),
      audioUrlSinhala: formAudioUrlSinhala.trim(),
      emotionTags: [formEmotion],
      isScenarioMode: true,
      passingScorePercent: Number(formPassingScore) || 70,
      xpReward: Number(formXpReward) || 100,
      iconType: formIcon,
      customSvg: formCustomSvg.trim(),
      numberColor: theme.numberColor,
      haloColor: theme.haloColor,
      haloBorderColor: theme.haloBorderColor,
      isPublished: formIsPublished,
    };

    try {
      const baseUrl = getBackendBaseUrl();
      if (editingScenario) {
        const res = await fetch(`${baseUrl}/v1/admin/roadmap/${editingScenario.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error(await res.text());
      } else {
        const res = await fetch(`${baseUrl}/v1/admin/roadmap`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error(await res.text());
      }
      if (previewAudioRef.current) {
        previewAudioRef.current.pause();
        previewAudioRef.current = null;
      }
      setTtsAudioPlaying(null);
      setIsEditorOpen(false);
      await fetchScenarios();
    } catch (e: any) {
      alert(`Save error: ${e?.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteScenario = async (id: string, title: string) => {
    if (!confirm(`Are you sure you want to delete "${title}"?`)) return;
    try {
      const baseUrl = getBackendBaseUrl();
      const res = await fetch(`${baseUrl}/v1/admin/roadmap/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setScenarios((prev) => prev.filter((s) => s.id !== id));
      } else {
        alert('Could not delete scenario.');
      }
    } catch (e: any) {
      alert(`Delete error: ${e?.message}`);
    }
  };

  const handleLaunchVoiceCall = (lvl: ScenarioItem) => {
    const studentName = (userStats.displayName || 'Learner').trim();
    CallSessionStore.startCall({
      roadmapLevelId: lvl.id,
      levelNumber: lvl.levelNumber,
      topic: lvl.topic || lvl.title,
      scenarioTitle: lvl.title,
      scenarioId: lvl.scenarioId || 'roleplay-scenario',
      scenarioPrompt: lvl.scenarioPrompt,
      openingMode: lvl.openingMode,
      openingLine: lvl.openingLine,
      scenarioBriefing: lvl.scenarioBriefing,
      emotionTags: lvl.emotionTags,
      practicePoints: lvl.practicePoints || [],
      canonicalContent: lvl.canonicalContent || '',
      passingScorePercent: lvl.passingScorePercent || 70,
      userRole: lvl.userRole,
      mayaRole: lvl.mayaRole,
      goalTitle: lvl.goalTitle,
      goalDescription: lvl.goalDescription,
      userName: studentName,
    });

    router.push({
      pathname: '/call' as any,
      params: {
        roadmapLevelId: lvl.id,
        levelNumber: String(lvl.levelNumber || 1),
        topic: lvl.topic || lvl.title,
        scenarioTitle: lvl.title,
        scenarioPrompt: lvl.scenarioPrompt || '',
        openingMode: lvl.openingMode || 'maya_explains_first',
        openingLine: lvl.openingLine || '',
        duration: String((lvl.targetDurationMinutes || 6) * 60),
        languageMode: 'english',
        sinhalaStyle: 'balanced',
        aiSuggestions: 'true',
        userName: studentName,
      },
    });
  };

  const filteredScenarios = scenarios.filter((s) => {
    const matchesSearch =
      s.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (s.scenarioBriefing || s.description || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (s.topic || '').toLowerCase().includes(searchQuery.toLowerCase());
    const emotion = s.emotionTags && s.emotionTags[0] ? s.emotionTags[0] : 'neutral';
    const matchesEmotion = filterEmotion === 'all' || emotion === filterEmotion;
    return matchesSearch && matchesEmotion;
  });

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <View style={styles.container}>
        <AdminSidebar
          activeRoute="/admin/scenarios"
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
        />

        <View style={styles.mainContent}>
          <AdminTopBar
            title="Scenario Studio"
            subtitle="Design real-world roleplay scenarios with AI-generated character personas, emotions, and automated unlocking."
            badgeText="Direct Prompt Mode"
            sidebarOpen={sidebarOpen}
            onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
            rightElement={
              <Pressable onPress={openNewScenarioModal} style={styles.newBtn}>
                <Feather name="plus-circle" size={16} color="#ffffff" style={{ marginRight: 6 }} />
                <Text style={styles.newBtnText}>Create Scenario</Text>
              </Pressable>
            }
          />

          <ScrollView style={styles.scrollArea} showsVerticalScrollIndicator={false}>
            {/* Quick Metrics Bar */}
            <View style={styles.metricsRow}>
              <View style={styles.metricCard}>
                <Text style={styles.metricLabel}>Total Scenarios</Text>
                <Text style={styles.metricVal}>{scenarios.length}</Text>
                <Text style={styles.metricSub}>Roadmap milestones</Text>
              </View>
              <View style={styles.metricCard}>
                <Text style={styles.metricLabel}>Published & Live</Text>
                <Text style={[styles.metricVal, { color: '#16a34a' }]}>
                  {scenarios.filter((s) => s.isPublished).length}
                </Text>
                <Text style={styles.metricSub}>Visible to students</Text>
              </View>
              <View style={styles.metricCard}>
                <Text style={styles.metricLabel}>Session Duration</Text>
                <Text style={[styles.metricVal, { color: '#0057FF' }]}>5–8 Min</Text>
                <Text style={styles.metricSub}>Adaptive time cap per level</Text>
              </View>
            </View>

            {/* Filter & Search Bar */}
            <View style={styles.filterBar}>
              <View style={styles.searchBox}>
                <Feather name="search" size={16} color="#94a3b8" style={{ marginRight: 8 }} />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Search scenarios by title, setting, or role..."
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  placeholderTextColor={PLACEHOLDER_COLOR}
                />
              </View>

              <View style={styles.emotionFilterRow}>
                {['all', 'angry', 'crying', 'strict', 'cheerful', 'professional'].map((em) => (
                  <Pressable
                    key={em}
                    onPress={() => setFilterEmotion(em)}
                    style={[styles.filterChip, filterEmotion === em && styles.filterChipActive]}
                  >
                    <Text
                      style={[
                        styles.filterChipText,
                        filterEmotion === em && styles.filterChipTextActive,
                      ]}
                    >
                      {em.toUpperCase()}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            {/* Scenario Grid */}
            {isLoading ? (
              <AdminTableSkeleton />
            ) : filteredScenarios.length === 0 ? (
              <View style={styles.emptyState}>
                <Feather name="message-square" size={36} color="#94a3b8" />
                <Text style={styles.emptyTitle}>No Scenarios Found</Text>
                <Text style={styles.emptySub}>Create your first roleplay scenario to connect it to the student roadmap.</Text>
                <Pressable onPress={openNewScenarioModal} style={[styles.newBtn, { marginTop: 12 }]}>
                  <Text style={styles.newBtnText}>Create Scenario Now</Text>
                </Pressable>
              </View>
            ) : (
              <View style={styles.scenarioGrid}>
                {filteredScenarios.map((item) => {
                  const emotionKey = item.emotionTags && item.emotionTags[0] ? item.emotionTags[0] : 'neutral';
                  const badge = EMOTION_BADGES[emotionKey] || EMOTION_BADGES.neutral;

                  return (
                    <View key={item.id} style={styles.scenarioCard}>
                      <View style={styles.cardHeader}>
                        <View style={styles.cardHeaderLeft}>
                          <View style={[styles.levelBadge, { backgroundColor: item.numberColor || '#0057FF' }]}>
                            <Text style={styles.levelBadgeText}>#{String(item.levelNumber).padStart(2, '0')}</Text>
                          </View>
                          <View style={{ flex: 1, marginLeft: 10 }}>
                            <Text style={styles.cardTitle} numberOfLines={1}>{item.title}</Text>
                            <Text style={styles.cardTopic}>{item.topic || 'Roleplay Scenario'}</Text>
                          </View>
                        </View>
                        <View style={[styles.emotionPill, { backgroundColor: badge.bg }]}>
                          <Text style={[styles.emotionPillText, { color: badge.text }]}>● {badge.label}</Text>
                        </View>
                      </View>

                      <Text style={styles.cardBriefing} numberOfLines={2}>
                        {item.scenarioBriefing || item.description || 'No mission briefing configured for this level.'}
                      </Text>

                      <View style={styles.cardFooter}>
                        <View style={styles.footerTags}>
                          <View style={styles.tagBadge}>
                            <Feather name="award" size={12} color="#0057FF" style={{ marginRight: 4 }} />
                            <Text style={styles.tagText}>+{item.xpReward || 100} XP</Text>
                          </View>
                          <View style={styles.tagBadge}>
                            <Feather name="clock" size={12} color="#f59e0b" style={{ marginRight: 4 }} />
                            <Text style={styles.tagText}>{item.targetDurationMinutes || 6}m cap</Text>
                          </View>
                          <View style={styles.tagBadge}>
                            <Feather name="check-circle" size={12} color="#16a34a" style={{ marginRight: 4 }} />
                            <Text style={styles.tagText}>Pass: ≥{item.passingScorePercent || 70}%</Text>
                          </View>
                          {(item.audioUrlEnglish || item.audioUrlSinhala) && (
                            <View style={[styles.tagBadge, { backgroundColor: '#f0fdf4', borderColor: '#bbf7d0' }]}>
                              <Feather name="volume-2" size={12} color="#16a34a" style={{ marginRight: 4 }} />
                              <Text style={[styles.tagText, { color: '#16a34a' }]}>
                                {item.audioUrlEnglish && item.audioUrlSinhala
                                  ? 'Custom WAV (EN+SI)'
                                  : item.audioUrlEnglish
                                  ? 'Custom WAV (EN)'
                                  : 'Custom WAV (SI)'}
                              </Text>
                            </View>
                          )}
                        </View>

                        <View style={styles.cardActions}>
                          <Pressable onPress={() => handleLaunchVoiceCall(item)} style={styles.actionBtn}>
                            <Feather name="mic" size={14} color="#0057FF" />
                          </Pressable>
                          <Pressable onPress={() => openEditModal(item)} style={styles.actionBtn}>
                            <Feather name="edit-2" size={14} color="#0d9488" />
                          </Pressable>
                          <Pressable onPress={() => handleDeleteScenario(item.id, item.title)} style={styles.actionBtn}>
                            <Feather name="trash-2" size={14} color="#ef4444" />
                          </Pressable>
                        </View>
                      </View>
                    </View>
                  );
                })}
              </View>
            )}
          </ScrollView>
        </View>
      </View>

      {/* ============================================================ */}
      {/* 2-STEP SCENARIO CREATION / EDITING WIZARD MODAL              */}
      {/* ============================================================ */}
      <Modal visible={isEditorOpen} animationType="fade" transparent onRequestClose={() => setIsEditorOpen(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, isPhone && styles.modalCardMobile]}>
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <View style={styles.modalHeaderTitleRow}>
                <View style={styles.modalBadge}>
                  <Text style={styles.modalBadgeText}>#{String(formLevelNumber).padStart(2, '0')}</Text>
                </View>
                <View>
                  <Text style={styles.modalTitle}>
                    {editingScenario ? `Edit: ${formTitle || 'Scenario'}` : 'Create New Scenario'}
                  </Text>
                  <Text style={styles.modalSubtitle}>
                    {wizardStep === 'details'
                      ? 'Step 1 of 2: Details, Roles & Level Unlocking'
                      : 'Step 2 of 2: AI Directive, Emotion & Opening Protocol'}
                  </Text>
                </View>
              </View>
              <Pressable onPress={() => setIsEditorOpen(false)} style={styles.modalCloseBtn}>
                <Feather name="x" size={20} color="#64748b" />
              </Pressable>
            </View>

            {/* Stepper Bar */}
            <View style={styles.stepperBar}>
              <Pressable
                onPress={() => setWizardStep('details')}
                style={[styles.stepItem, wizardStep === 'details' && styles.stepItemActive]}
              >
                <View style={[styles.stepNumberBadge, wizardStep === 'details' && styles.stepNumberBadgeActive]}>
                  <Text style={[styles.stepNumberText, wizardStep === 'details' && styles.stepNumberTextActive]}>1</Text>
                </View>
                <Text style={[styles.stepLabel, wizardStep === 'details' && styles.stepLabelActive]}>
                  Details & Goal Setup
                </Text>
              </Pressable>

              <View style={styles.stepperDivider} />

              <Pressable
                onPress={() => {
                  if (formPrompt.trim()) setWizardStep('prompt');
                  else handleGeneratePromptWithAI();
                }}
                style={[styles.stepItem, wizardStep === 'prompt' && styles.stepItemActive]}
              >
                <View style={[styles.stepNumberBadge, wizardStep === 'prompt' && styles.stepNumberBadgeActive]}>
                  <Text style={[styles.stepNumberText, wizardStep === 'prompt' && styles.stepNumberTextActive]}>2</Text>
                </View>
                <Text style={[styles.stepLabel, wizardStep === 'prompt' && styles.stepLabelActive]}>
                  AI Prompt & Emotion
                </Text>
              </Pressable>
            </View>

            <ScrollView style={styles.modalBodyScroll} showsVerticalScrollIndicator={false}>
              {/* STEP 1: DETAILS & LEVEL UNLOCKING */}
              {wizardStep === 'details' ? (
                <View style={styles.tabSection}>
                  <View style={styles.infoBanner}>
                    <Feather name="info" size={16} color="#0d9488" style={{ marginRight: 8, marginTop: 2 }} />
                    <Text style={styles.infoBannerText}>
                      Fill in the scenario situation and roles below. When you click <Text style={{ ...fontStyle('inter', 'bold') }}>"Next: Generate Prompt with AI"</Text>, Gemini will automatically craft Maya's personality, emotion, opening line, and prompt directive.
                    </Text>
                  </View>

                  {/* Level & Title */}
                  <View style={styles.twoColRow}>
                    <View style={[styles.formCol, { flex: 1 }]}>
                      <Text style={styles.fieldLabel}>Level / Milestone # *</Text>
                      <TextInput
                        style={styles.textInput}
                        value={String(formLevelNumber)}
                        onChangeText={(txt) => setFormLevelNumber(parseInt(txt, 10) || 1)}
                        keyboardType="numeric"
                      />
                    </View>
                    <View style={[styles.formCol, { flex: 3 }]}>
                      <Text style={styles.fieldLabel}>Scenario Title *</Text>
                      <TextInput
                        style={styles.textInput}
                        value={formTitle}
                        onChangeText={setFormTitle}
                        placeholder="e.g. Angry Hotel Guest"
                        placeholderTextColor={PLACEHOLDER_COLOR}
                      />
                    </View>
                  </View>

                  <View style={styles.formGroup}>
                    <Text style={styles.fieldLabel}>Topic / Category</Text>
                    <TextInput
                      style={styles.textInput}
                      value={formTopic}
                      onChangeText={setFormTopic}
                      placeholder="e.g. Hospitality & Conflict Resolution"
                      placeholderTextColor={PLACEHOLDER_COLOR}
                    />
                  </View>

                  {/* Mission Briefing */}
                  <View style={styles.formGroup}>
                    <Text style={styles.fieldLabel}>Situation Premise / Briefing *</Text>
                    <Text style={styles.fieldHelper}>The background story shown to the student before starting the call.</Text>
                    <TextInput
                      style={[styles.textInput, styles.textArea]}
                      value={formBriefing}
                      onChangeText={setFormBriefing}
                      placeholder="e.g. You booked an ocean-view suite, but the hotel gave your room to another guest. Negotiate a satisfactory solution."
                      placeholderTextColor={PLACEHOLDER_COLOR}
                      multiline
                      numberOfLines={3}
                    />
                  </View>

                  {/* Character Roles */}
                  <View style={styles.twoColRow}>
                    <View style={styles.formCol}>
                      <Text style={styles.fieldLabel}>Student's Role *</Text>
                      <TextInput
                        style={styles.textInput}
                        value={formUserRole}
                        onChangeText={setFormUserRole}
                        placeholder="e.g. Hotel guest"
                        placeholderTextColor={PLACEHOLDER_COLOR}
                      />
                    </View>
                    <View style={styles.formCol}>
                      <Text style={styles.fieldLabel}>Maya's Role (AI Actor) *</Text>
                      <TextInput
                        style={styles.textInput}
                        value={formMayaRole}
                        onChangeText={setFormMayaRole}
                        placeholder="e.g. Hotel receptionist"
                        placeholderTextColor={PLACEHOLDER_COLOR}
                      />
                    </View>
                  </View>

                  {/* Goal Cards */}
                  <View style={styles.formGroup}>
                    <Text style={styles.fieldLabel}>Student's Goal Title *</Text>
                    <TextInput
                      style={styles.textInput}
                      value={formGoalTitle}
                      onChangeText={setFormGoalTitle}
                      placeholder="e.g. Stay calm and find a solution"
                      placeholderTextColor={PLACEHOLDER_COLOR}
                    />
                  </View>

                  <View style={styles.formGroup}>
                    <Text style={styles.fieldLabel}>Student's Goal Description *</Text>
                    <Text style={styles.fieldHelper}>Maya tracks this goal and will conclude the roleplay once the student achieves it.</Text>
                    <TextInput
                      style={[styles.textInput, styles.textArea]}
                      value={formGoalDescription}
                      onChangeText={setFormGoalDescription}
                      placeholder="e.g. Express your disappointment politely, explain your concern clearly, and negotiate a good solution (such as another room or compensation)."
                      placeholderTextColor={PLACEHOLDER_COLOR}
                      multiline
                      numberOfLines={3}
                    />
                  </View>

                  {/* Unlocking & Duration Controls */}
                  <View style={styles.twoColRow}>
                    <View style={styles.formCol}>
                      <Text style={styles.fieldLabel}>Session Duration Cap (5–8 Min)</Text>
                      <View style={styles.durationBtnRow}>
                        {[5, 6, 7, 8].map((min) => (
                          <Pressable
                            key={min}
                            onPress={() => setFormTargetDurationMinutes(min)}
                            style={[
                              styles.durPill,
                              formTargetDurationMinutes === min && styles.durPillActive,
                            ]}
                          >
                            <Text
                              style={[
                                styles.durPillText,
                                formTargetDurationMinutes === min && styles.durPillTextActive,
                              ]}
                            >
                              {min} min
                            </Text>
                          </Pressable>
                        ))}
                      </View>
                      <Text style={styles.fieldHelper}>Auto-assigned randomly to maintain dynamic call lengths.</Text>
                    </View>

                    <View style={styles.formCol}>
                      <Text style={styles.fieldLabel}>Passing Score to Unlock Level</Text>
                      <View style={styles.durationBtnRow}>
                        {[60, 65, 70, 75, 80].map((sc) => (
                          <Pressable
                            key={sc}
                            onPress={() => setFormPassingScore(sc)}
                            style={[
                              styles.durPill,
                              formPassingScore === sc && styles.durPillActive,
                            ]}
                          >
                            <Text
                              style={[
                                styles.durPillText,
                                formPassingScore === sc && styles.durPillTextActive,
                              ]}
                            >
                              ≥ {sc}%
                            </Text>
                          </Pressable>
                        ))}
                      </View>
                      <Text style={styles.fieldHelper}>Calculated from fluency, grammar & hint usage.</Text>
                    </View>
                  </View>

                  {/* Accent Color Theme */}
                  <View style={styles.twoColRow}>
                    <View style={styles.formCol}>
                      <Text style={styles.fieldLabel}>Accent Color Theme</Text>
                      <View style={styles.colorPaletteRow}>
                        {COLOR_THEMES.map((th, idx) => (
                          <Pressable
                            key={th.name}
                            onPress={() => setFormColorIdx(idx)}
                            style={[
                              styles.colorDotBtn,
                              { backgroundColor: th.numberColor },
                              formColorIdx === idx && styles.colorDotBtnSelected,
                            ]}
                          />
                        ))}
                      </View>
                    </View>

                    <View style={styles.formCol}>
                      <Text style={styles.fieldLabel}>XP Points Awarded</Text>
                      <View style={styles.durationBtnRow}>
                        {[50, 75, 100, 150].map((xp) => (
                          <Pressable
                            key={xp}
                            onPress={() => setFormXpReward(xp)}
                            style={[
                              styles.durPill,
                              formXpReward === xp && styles.xpPillActive,
                            ]}
                          >
                            <Text
                              style={[
                                styles.durPillText,
                                formXpReward === xp && styles.xpPillTextActive,
                              ]}
                            >
                              +{xp}
                            </Text>
                          </Pressable>
                        ))}
                      </View>
                    </View>
                  </View>

                  {/* Publishing Toggle */}
                  <View style={styles.publishToggleRow}>
                    <View>
                      <Text style={styles.fieldLabel}>Publish Live on Student Roadmap</Text>
                      <Text style={styles.fieldHelper}>When enabled, this scenario appears in student roadmaps.</Text>
                    </View>
                    <Pressable
                      onPress={() => setFormIsPublished(!formIsPublished)}
                      style={[
                        styles.toggleSwitch,
                        formIsPublished ? styles.toggleSwitchOn : styles.toggleSwitchOff,
                      ]}
                    >
                      <View
                        style={[
                          styles.toggleDot,
                          formIsPublished ? styles.toggleDotOn : styles.toggleDotOff,
                        ]}
                      />
                    </Pressable>
                  </View>
                </View>
              ) : (
                /* STEP 2: AI PROMPT DIRECTIVE & EMOTION */
                <View style={styles.tabSection}>
                  <View style={styles.aiSuccessBanner}>
                    <Feather name="check-circle" size={16} color="#059669" style={{ marginRight: 8, marginTop: 2 }} />
                    <Text style={styles.aiSuccessBannerText}>
                      Gemini API auto-generated the emotional state, opening protocol, and conversation directive tailored to your scenario. You can review or tweak any setting below!
                    </Text>
                  </View>

                  {/* Emotion Tag Picker */}
                  <View style={styles.formGroup}>
                    <Text style={styles.fieldLabel}>Maya’s Primary Emotional State *</Text>
                    <View style={styles.emotionPickerRow}>
                      {Object.keys(EMOTION_BADGES).map((k) => {
                        const b = EMOTION_BADGES[k];
                        const isSelected = formEmotion === k;
                        return (
                          <Pressable
                            key={k}
                            onPress={() => setFormEmotion(k)}
                            style={[
                              styles.emotionChoiceBtn,
                              isSelected && { borderColor: b.text, backgroundColor: b.bg },
                            ]}
                          >
                            <Text style={[styles.emotionChoiceText, isSelected && { color: b.text, ...fontStyle('inter', 'bold') }]}>
                              {b.label}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  </View>

                  {/* Opening Protocol */}
                  <View style={styles.formGroup}>
                    <Text style={styles.fieldLabel}>How The Conversation Starts (Opening Protocol) *</Text>
                    <View style={styles.openingModeRow}>
                      {OPENING_MODES.map((m) => (
                        <Pressable
                          key={m.id}
                          onPress={() => setFormOpeningMode(m.id)}
                          style={[
                            styles.openingModeCard,
                            formOpeningMode === m.id && styles.openingModeCardActive,
                          ]}
                        >
                          <Text style={[styles.openingModeTitle, formOpeningMode === m.id && styles.openingModeTitleActive]}>
                            {m.title}
                          </Text>
                          <Text style={styles.openingModeDesc}>{m.desc}</Text>
                        </Pressable>
                      ))}
                    </View>
                  </View>

                  {/* Optional Pre-scripted First Line */}
                  <View style={styles.formGroup}>
                    <Text style={styles.fieldLabel}>Maya’s First Spoken Line (Optional)</Text>
                    <Text style={styles.fieldHelper}>Leave blank to let Gemini improvise the opening, or specify an exact sentence.</Text>
                    <TextInput
                      style={styles.textInput}
                      value={formOpeningLine}
                      onChangeText={setFormOpeningLine}
                      placeholder='Good evening! Welcome to our hotel. How may I assist you today?'
                      placeholderTextColor={PLACEHOLDER_COLOR}
                    />
                  </View>

                  {/* Full Prompt Configuration Area */}
                  <View style={styles.formGroup}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Text style={styles.fieldLabel}>Full Scenario Prompt Directive *</Text>
                      <Text style={styles.charCount}>{(formPrompt || '').length} characters</Text>
                    </View>
                    <Text style={styles.fieldHelper}>
                      Write Maya's persona, context, backstory, and conversation behavior. The backend obeys this prompt directly!
                    </Text>
                    <TextInput
                      style={[styles.textInput, styles.promptEditor]}
                      value={formPrompt}
                      onChangeText={setFormPrompt}
                      placeholder="You are Maya playing the role of..."
                      placeholderTextColor={PLACEHOLDER_COLOR}
                      multiline
                      numberOfLines={10}
                    />
                  </View>

                  {/* English Voice Briefing (TTS with Expressive Tags) */}
                  <View style={styles.ttsSection}>
                    <View style={styles.ttsHeaderRow}>
                      <View style={{ flex: 1, marginRight: 8 }}>
                        <Text style={styles.fieldLabel}>🎙️ English Voice Briefing Script *</Text>
                        <Text style={styles.ttsTagHint}>
                          Supports natural tags: <Text style={{ ...fontStyle('inter', 'bold'), color: '#0057FF' }}>&lt;short pause&gt;</Text>, <Text style={{ ...fontStyle('inter', 'bold'), color: '#0057FF' }}>&lt;sighs&gt;</Text>, <Text style={{ ...fontStyle('inter', 'bold'), color: '#0057FF' }}>&lt;chuckle&gt;</Text>, <Text style={{ ...fontStyle('inter', 'bold'), color: '#0057FF' }}>&lt;cheer&gt;</Text>
                        </Text>
                      </View>
                      <Pressable
                        onPress={() => handlePreviewTts('en')}
                        disabled={isSynthesizingPreview === 'en'}
                        style={[
                          styles.ttsPreviewBtn,
                          ttsAudioPlaying === 'en' && styles.ttsPreviewBtnPlaying,
                        ]}
                      >
                        {isSynthesizingPreview === 'en' ? (
                          <ActivityIndicator size="small" color="#0057FF" />
                        ) : (
                          <Feather
                            name={ttsAudioPlaying === 'en' ? 'square' : 'play'}
                            size={14}
                            color={ttsAudioPlaying === 'en' ? '#ef4444' : '#0057FF'}
                          />
                        )}
                        <Text
                          style={[
                            styles.ttsPreviewBtnText,
                            ttsAudioPlaying === 'en' && styles.ttsPreviewBtnTextPlaying,
                          ]}
                        >
                          {isSynthesizingPreview === 'en'
                            ? 'Synthesizing...'
                            : ttsAudioPlaying === 'en'
                            ? 'Stop Playback'
                            : '🎧 Listen to English Preview'}
                        </Text>
                      </Pressable>
                    </View>
                    <TextInput
                      style={[styles.textInput, styles.ttsScriptEditor]}
                      value={formTtsEnglish}
                      onChangeText={setFormTtsEnglish}
                      placeholder="Welcome to your next scenario... <short pause> Picture this... <sighs>"
                      placeholderTextColor={PLACEHOLDER_COLOR}
                      multiline
                      numberOfLines={4}
                    />

                    {/* Custom WAV Audio Option (if not using auto-generated TTS) */}
                    {formAudioUrlEnglish ? (
                      <View style={styles.customAudioCard}>
                        <View style={styles.customAudioBadgeRow}>
                          <View style={styles.customAudioBadge}>
                            <Feather name="check-circle" size={13} color="#16a34a" />
                            <Text style={styles.customAudioBadgeText}>Custom WAV Active</Text>
                          </View>
                          <Text style={styles.customAudioUrlText} numberOfLines={1}>
                            {formAudioUrlEnglish.split('/').pop() || formAudioUrlEnglish}
                          </Text>
                        </View>
                        <View style={styles.customAudioActionRow}>
                          <Pressable
                            onPress={() => handlePlayCustomAudio(formAudioUrlEnglish, 'en')}
                            style={[
                              styles.customAudioPlayBtn,
                              ttsAudioPlaying === 'en' && styles.customAudioPlayBtnActive,
                            ]}
                          >
                            <Feather
                              name={ttsAudioPlaying === 'en' ? 'square' : 'play'}
                              size={13}
                              color={ttsAudioPlaying === 'en' ? '#ef4444' : '#0057FF'}
                            />
                            <Text
                              style={[
                                styles.customAudioPlayBtnText,
                                ttsAudioPlaying === 'en' && { color: '#ef4444' },
                              ]}
                            >
                              {ttsAudioPlaying === 'en' ? 'Stop' : 'Play Custom WAV'}
                            </Text>
                          </Pressable>
                          <Pressable
                            onPress={() => triggerUploadWav('en')}
                            disabled={isUploadingAudio === 'en'}
                            style={styles.customAudioReplaceBtn}
                          >
                            {isUploadingAudio === 'en' ? (
                              <ActivityIndicator size="small" color="#475569" />
                            ) : (
                              <Feather name="upload" size={13} color="#475569" />
                            )}
                            <Text style={styles.customAudioReplaceBtnText}>
                              {isUploadingAudio === 'en' ? 'Uploading...' : 'Replace WAV'}
                            </Text>
                          </Pressable>
                          <Pressable
                            onPress={() => handleRemoveCustomAudio('en')}
                            style={styles.customAudioRemoveBtn}
                          >
                            <Feather name="trash-2" size={13} color="#ef4444" />
                            <Text style={styles.customAudioRemoveBtnText}>Revert to Auto TTS</Text>
                          </Pressable>
                        </View>
                      </View>
                    ) : (
                      <View style={styles.uploadWavPromptRow}>
                        <View style={{ flex: 1, minWidth: 200 }}>
                          <Text style={styles.uploadWavTitle}>Prefer human pre-recorded voice?</Text>
                          <Text style={styles.uploadWavHint}>
                            Upload a custom English .wav audio file if you don't want auto-generated TTS.
                          </Text>
                        </View>
                        <Pressable
                          onPress={() => triggerUploadWav('en')}
                          disabled={isUploadingAudio === 'en'}
                          style={styles.uploadWavBtn}
                        >
                          {isUploadingAudio === 'en' ? (
                            <ActivityIndicator size="small" color="#0057FF" />
                          ) : (
                            <Feather name="upload-cloud" size={14} color="#0057FF" />
                          )}
                          <Text style={styles.uploadWavBtnText}>
                            {isUploadingAudio === 'en' ? 'Uploading...' : 'Upload English .WAV'}
                          </Text>
                        </Pressable>
                      </View>
                    )}
                  </View>

                  {/* Sinhala Voice Briefing (සිංහල හඬ විස්තරය) */}
                  <View style={styles.ttsSection}>
                    <View style={styles.ttsHeaderRow}>
                      <View style={{ flex: 1, marginRight: 8 }}>
                        <Text style={styles.fieldLabel}>🎙️ Sinhala Voice Briefing Script (සිංහල හඬ) *</Text>
                        <Text style={styles.ttsTagHint}>
                          Supports tags: <Text style={{ ...fontStyle('inter', 'bold'), color: '#0057FF' }}>&lt;short pause&gt;</Text>, <Text style={{ ...fontStyle('inter', 'bold'), color: '#0057FF' }}>&lt;sighs&gt;</Text>, <Text style={{ ...fontStyle('inter', 'bold'), color: '#0057FF' }}>&lt;chuckle&gt;</Text>
                        </Text>
                      </View>
                      <Pressable
                        onPress={() => handlePreviewTts('si')}
                        disabled={isSynthesizingPreview === 'si'}
                        style={[
                          styles.ttsPreviewBtn,
                          ttsAudioPlaying === 'si' && styles.ttsPreviewBtnPlaying,
                        ]}
                      >
                        {isSynthesizingPreview === 'si' ? (
                          <ActivityIndicator size="small" color="#0057FF" />
                        ) : (
                          <Feather
                            name={ttsAudioPlaying === 'si' ? 'square' : 'play'}
                            size={14}
                            color={ttsAudioPlaying === 'si' ? '#ef4444' : '#0057FF'}
                          />
                        )}
                        <Text
                          style={[
                            styles.ttsPreviewBtnText,
                            ttsAudioPlaying === 'si' && styles.ttsPreviewBtnTextPlaying,
                          ]}
                        >
                          {isSynthesizingPreview === 'si'
                            ? 'Synthesizing...'
                            : ttsAudioPlaying === 'si'
                            ? 'Stop Playback'
                            : '🎧 සිංහල හඬට සවන් දෙන්න (Preview)'}
                        </Text>
                      </Pressable>
                    </View>
                    <TextInput
                      style={[styles.textInput, styles.ttsScriptEditor]}
                      value={formTtsSinhala}
                      onChangeText={setFormTtsSinhala}
                      placeholder="හිතන්නකෝ ඔයා hotel එකට check-in වෙන්න ආවා කියලා... <short pause> මම receptionist... <sighs>"
                      placeholderTextColor={PLACEHOLDER_COLOR}
                      multiline
                      numberOfLines={4}
                    />

                    {/* Custom WAV Audio Option (if not using auto-generated TTS) */}
                    {formAudioUrlSinhala ? (
                      <View style={styles.customAudioCard}>
                        <View style={styles.customAudioBadgeRow}>
                          <View style={styles.customAudioBadge}>
                            <Feather name="check-circle" size={13} color="#16a34a" />
                            <Text style={styles.customAudioBadgeText}>Custom Sinhala WAV Active</Text>
                          </View>
                          <Text style={styles.customAudioUrlText} numberOfLines={1}>
                            {formAudioUrlSinhala.split('/').pop() || formAudioUrlSinhala}
                          </Text>
                        </View>
                        <View style={styles.customAudioActionRow}>
                          <Pressable
                            onPress={() => handlePlayCustomAudio(formAudioUrlSinhala, 'si')}
                            style={[
                              styles.customAudioPlayBtn,
                              ttsAudioPlaying === 'si' && styles.customAudioPlayBtnActive,
                            ]}
                          >
                            <Feather
                              name={ttsAudioPlaying === 'si' ? 'square' : 'play'}
                              size={13}
                              color={ttsAudioPlaying === 'si' ? '#ef4444' : '#0057FF'}
                            />
                            <Text
                              style={[
                                styles.customAudioPlayBtnText,
                                ttsAudioPlaying === 'si' && { color: '#ef4444' },
                              ]}
                            >
                              {ttsAudioPlaying === 'si' ? 'Stop' : 'Play Sinhala WAV'}
                            </Text>
                          </Pressable>
                          <Pressable
                            onPress={() => triggerUploadWav('si')}
                            disabled={isUploadingAudio === 'si'}
                            style={styles.customAudioReplaceBtn}
                          >
                            {isUploadingAudio === 'si' ? (
                              <ActivityIndicator size="small" color="#475569" />
                            ) : (
                              <Feather name="upload" size={13} color="#475569" />
                            )}
                            <Text style={styles.customAudioReplaceBtnText}>
                              {isUploadingAudio === 'si' ? 'Uploading...' : 'Replace WAV'}
                            </Text>
                          </Pressable>
                          <Pressable
                            onPress={() => handleRemoveCustomAudio('si')}
                            style={styles.customAudioRemoveBtn}
                          >
                            <Feather name="trash-2" size={13} color="#ef4444" />
                            <Text style={styles.customAudioRemoveBtnText}>Revert to Auto TTS</Text>
                          </Pressable>
                        </View>
                      </View>
                    ) : (
                      <View style={styles.uploadWavPromptRow}>
                        <View style={{ flex: 1, minWidth: 200 }}>
                          <Text style={styles.uploadWavTitle}>කලින් record කළ සිංහල හඬක් තිබේද?</Text>
                          <Text style={styles.uploadWavHint}>
                            Auto TTS වෙනුවට pre-recorded Sinhala .wav audio file එකක් upload කරන්න.
                          </Text>
                        </View>
                        <Pressable
                          onPress={() => triggerUploadWav('si')}
                          disabled={isUploadingAudio === 'si'}
                          style={styles.uploadWavBtn}
                        >
                          {isUploadingAudio === 'si' ? (
                            <ActivityIndicator size="small" color="#0057FF" />
                          ) : (
                            <Feather name="upload-cloud" size={14} color="#0057FF" />
                          )}
                          <Text style={styles.uploadWavBtnText}>
                            {isUploadingAudio === 'si' ? 'Uploading...' : 'Upload Sinhala .WAV'}
                          </Text>
                        </Pressable>
                      </View>
                    )}
                  </View>
                </View>
              )}
            </ScrollView>

            {/* Modal Actions Footer */}
            <View style={styles.modalFooter}>
              {wizardStep === 'details' ? (
                <>
                  <Pressable onPress={() => setIsEditorOpen(false)} style={styles.cancelBtn}>
                    <Text style={styles.cancelBtnText}>Cancel</Text>
                  </Pressable>

                  {formPrompt ? (
                    <Pressable
                      onPress={() => setWizardStep('prompt')}
                      style={styles.reviewStepBtn}
                    >
                      <Text style={styles.reviewStepBtnText}>Review Existing Prompt →</Text>
                    </Pressable>
                  ) : null}

                  <Pressable
                    onPress={handleGeneratePromptWithAI}
                    style={[styles.saveBtn, isGeneratingPrompt && { opacity: 0.7 }]}
                    disabled={isGeneratingPrompt}
                  >
                    {isGeneratingPrompt ? (
                      <ActivityIndicator size="small" color="#ffffff" style={{ marginRight: 8 }} />
                    ) : (
                      <Feather name="zap" size={16} color="#ffffff" style={{ marginRight: 6 }} />
                    )}
                    <Text style={styles.saveBtnText}>
                      {isGeneratingPrompt ? 'Generating Prompt...' : 'Next: Generate Prompt with AI ✨'}
                    </Text>
                  </Pressable>
                </>
              ) : (
                <>
                  <Pressable
                    onPress={() => setWizardStep('details')}
                    style={styles.cancelBtn}
                  >
                    <Text style={styles.cancelBtnText}>← Back to Details</Text>
                  </Pressable>

                  <Pressable
                    onPress={handleGeneratePromptWithAI}
                    style={[styles.regenerateBtn, isGeneratingPrompt && { opacity: 0.7 }]}
                    disabled={isGeneratingPrompt}
                  >
                    {isGeneratingPrompt ? (
                      <ActivityIndicator size="small" color="#0d9488" style={{ marginRight: 6 }} />
                    ) : (
                      <Feather name="refresh-cw" size={14} color="#0d9488" style={{ marginRight: 6 }} />
                    )}
                    <Text style={styles.regenerateBtnText}>
                      {isGeneratingPrompt ? 'Re-generating...' : 'Re-generate with AI'}
                    </Text>
                  </Pressable>

                  <Pressable
                    onPress={handleSaveScenario}
                    style={[styles.saveBtn, isSaving && { opacity: 0.7 }]}
                    disabled={isSaving}
                  >
                    {isSaving ? (
                      <ActivityIndicator size="small" color="#ffffff" style={{ marginRight: 6 }} />
                    ) : (
                      <Feather name="check" size={16} color="#ffffff" style={{ marginRight: 6 }} />
                    )}
                    <Text style={styles.saveBtnText}>{isSaving ? 'Saving...' : 'Save Scenario'}</Text>
                  </Pressable>
                </>
              )}
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  container: {
    flex: 1,
    flexDirection: 'row',
  },
  mainContent: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  scrollArea: {
    flex: 1,
    padding: 20,
  },
  newBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0d9488',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  newBtnText: {
    ...fontStyle('outfit', 'semiBold'),
    color: '#ffffff',
    fontSize: 14,
  },
  metricsRow: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 20,
  },
  metricCard: {
    flex: 1,
    backgroundColor: '#ffffff',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  metricLabel: {
    ...fontStyle('inter', 'medium'),
    fontSize: 12,
    color: '#64748b',
    textTransform: 'uppercase',
  },
  metricVal: {
    ...fontStyle('outfit', 'bold'),
    fontSize: 24,
    color: '#0f172a',
    marginTop: 4,
  },
  metricSub: {
    ...fontStyle('inter', 'regular'),
    fontSize: 11,
    color: '#94a3b8',
    marginTop: 2,
  },
  filterBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
    gap: 12,
    flexWrap: 'wrap',
  },
  searchBox: {
    flex: 1,
    minWidth: 260,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingHorizontal: 12,
    height: 42,
  },
  searchInput: {
    flex: 1,
    ...fontStyle('inter', 'regular'),
    fontSize: 14,
    color: '#0f172a',
  },
  emotionFilterRow: {
    flexDirection: 'row',
    gap: 6,
    flexWrap: 'wrap',
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  filterChipActive: {
    backgroundColor: '#0d9488',
    borderColor: '#0d9488',
  },
  filterChipText: {
    ...fontStyle('inter', 'semiBold'),
    fontSize: 11,
    color: '#64748b',
  },
  filterChipTextActive: {
    color: '#ffffff',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  emptyTitle: {
    ...fontStyle('outfit', 'bold'),
    fontSize: 18,
    color: '#0f172a',
    marginTop: 12,
  },
  emptySub: {
    ...fontStyle('inter', 'regular'),
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
    marginTop: 4,
    maxWidth: 400,
  },
  scenarioGrid: {
    gap: 16,
  },
  scenarioCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 18,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  cardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  levelBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  levelBadgeText: {
    ...fontStyle('outfit', 'bold'),
    color: '#ffffff',
    fontSize: 12,
  },
  cardTitle: {
    ...fontStyle('outfit', 'bold'),
    fontSize: 16,
    color: '#0f172a',
  },
  cardTopic: {
    ...fontStyle('inter', 'medium'),
    fontSize: 12,
    color: '#64748b',
    marginTop: 1,
  },
  emotionPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  emotionPillText: {
    ...fontStyle('inter', 'semiBold'),
    fontSize: 11,
  },
  cardBriefing: {
    ...fontStyle('inter', 'regular'),
    fontSize: 13,
    color: '#475569',
    lineHeight: 19,
    marginVertical: 8,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    paddingTop: 12,
    marginTop: 6,
  },
  footerTags: {
    flexDirection: 'row',
    gap: 8,
  },
  tagBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  tagText: {
    ...fontStyle('inter', 'medium'),
    fontSize: 11,
    color: '#334155',
  },
  cardActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionBtn: {
    padding: 8,
    borderRadius: 6,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    maxWidth: 760,
    maxHeight: '92%',
    backgroundColor: '#ffffff',
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
  },
  modalCardMobile: {
    maxWidth: '100%',
    height: '98%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  modalHeaderTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  modalBadge: {
    backgroundColor: '#0d9488',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginRight: 10,
  },
  modalBadgeText: {
    ...fontStyle('outfit', 'bold'),
    color: '#ffffff',
    fontSize: 12,
  },
  modalTitle: {
    ...fontStyle('outfit', 'bold'),
    fontSize: 18,
    color: '#0f172a',
  },
  modalSubtitle: {
    ...fontStyle('inter', 'regular'),
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  modalCloseBtn: {
    padding: 6,
  },
  stepperBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: '#f8fafc',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  stepItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  stepItemActive: {
    opacity: 1,
  },
  stepNumberBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNumberBadgeActive: {
    backgroundColor: '#0d9488',
  },
  stepNumberText: {
    ...fontStyle('inter', 'bold'),
    fontSize: 12,
    color: '#64748b',
  },
  stepNumberTextActive: {
    color: '#ffffff',
  },
  stepLabel: {
    ...fontStyle('inter', 'medium'),
    fontSize: 13,
    color: '#64748b',
  },
  stepLabelActive: {
    color: '#0f172a',
    ...fontStyle('inter', 'semiBold'),
  },
  stepperDivider: {
    flex: 1,
    height: 1,
    backgroundColor: '#cbd5e1',
    marginHorizontal: 16,
  },
  modalBodyScroll: {
    padding: 20,
  },
  tabSection: {
    gap: 16,
  },
  infoBanner: {
    flexDirection: 'row',
    backgroundColor: '#f0fdfa',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ccfbf1',
    alignItems: 'flex-start',
  },
  infoBannerText: {
    flex: 1,
    ...fontStyle('inter', 'regular'),
    fontSize: 12,
    color: '#115e59',
    lineHeight: 18,
  },
  aiSuccessBanner: {
    flexDirection: 'row',
    backgroundColor: '#ecfdf5',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#a7f3d0',
    alignItems: 'flex-start',
  },
  aiSuccessBannerText: {
    flex: 1,
    ...fontStyle('inter', 'regular'),
    fontSize: 12,
    color: '#065f46',
    lineHeight: 18,
  },
  formGroup: {
    marginBottom: 4,
  },
  twoColRow: {
    flexDirection: 'row',
    gap: 12,
  },
  formCol: {
    flex: 1,
  },
  fieldLabel: {
    ...fontStyle('inter', 'semiBold'),
    fontSize: 13,
    color: '#1e293b',
    marginBottom: 4,
  },
  fieldHelper: {
    ...fontStyle('inter', 'regular'),
    fontSize: 11,
    color: '#64748b',
    marginBottom: 6,
  },
  textInput: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    paddingHorizontal: 12,
    paddingVertical: 9,
    ...fontStyle('inter', 'regular'),
    fontSize: 14,
    color: '#0f172a',
  },
  textArea: {
    minHeight: 68,
    textAlignVertical: 'top',
  },
  promptEditor: {
    minHeight: 180,
    textAlignVertical: 'top',
    ...fontStyle('inter', 'regular'),
    fontSize: 13,
    lineHeight: 20,
    backgroundColor: '#fafafa',
  },
  charCount: {
    ...fontStyle('inter', 'regular'),
    fontSize: 11,
    color: '#94a3b8',
  },
  emotionPickerRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  emotionChoiceBtn: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    backgroundColor: '#ffffff',
  },
  emotionChoiceText: {
    ...fontStyle('inter', 'medium'),
    fontSize: 12,
    color: '#475569',
  },
  openingModeRow: {
    gap: 8,
    marginTop: 4,
  },
  openingModeCard: {
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#ffffff',
  },
  openingModeCardActive: {
    borderColor: '#0d9488',
    backgroundColor: '#f0fdfa',
  },
  openingModeTitle: {
    ...fontStyle('outfit', 'semiBold'),
    fontSize: 13,
    color: '#1e293b',
  },
  openingModeTitleActive: {
    color: '#0f766e',
  },
  openingModeDesc: {
    ...fontStyle('inter', 'regular'),
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
  },
  durationBtnRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 4,
  },
  durPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    backgroundColor: '#ffffff',
  },
  durPillActive: {
    backgroundColor: '#0d9488',
    borderColor: '#0d9488',
  },
  durPillText: {
    ...fontStyle('inter', 'semiBold'),
    fontSize: 12,
    color: '#475569',
  },
  durPillTextActive: {
    color: '#ffffff',
  },
  xpPillActive: {
    backgroundColor: '#0057FF',
    borderColor: '#0057FF',
  },
  xpPillTextActive: {
    color: '#ffffff',
  },
  colorPaletteRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 6,
  },
  colorDotBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
  },
  colorDotBtnSelected: {
    borderWidth: 3,
    borderColor: '#0f172a',
  },
  publishToggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 14,
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginTop: 4,
  },
  toggleSwitch: {
    width: 48,
    height: 26,
    borderRadius: 13,
    padding: 2,
  },
  toggleSwitchOn: {
    backgroundColor: '#16a34a',
  },
  toggleSwitchOff: {
    backgroundColor: '#cbd5e1',
  },
  toggleDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#ffffff',
  },
  toggleDotOn: {
    alignSelf: 'flex-end',
  },
  toggleDotOff: {
    alignSelf: 'flex-start',
  },
  modalFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    backgroundColor: '#f8fafc',
    gap: 10,
  },
  cancelBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  cancelBtnText: {
    ...fontStyle('inter', 'medium'),
    fontSize: 14,
    color: '#64748b',
  },
  reviewStepBtn: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#cbd5e1',
  },
  reviewStepBtnText: {
    ...fontStyle('inter', 'semiBold'),
    fontSize: 13,
    color: '#334155',
  },
  regenerateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#f0fdfa',
    borderWidth: 1,
    borderColor: '#ccfbf1',
  },
  regenerateBtnText: {
    ...fontStyle('inter', 'semiBold'),
    fontSize: 13,
    color: '#0d9488',
  },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0d9488',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 8,
  },
  saveBtnText: {
    ...fontStyle('outfit', 'semiBold'),
    fontSize: 14,
    color: '#ffffff',
  },
  ttsSection: {
    marginTop: 16,
    padding: 14,
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  ttsHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
    flexWrap: 'wrap',
    gap: 8,
  },
  ttsPreviewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#bfdbfe',
    gap: 6,
  },
  ttsPreviewBtnPlaying: {
    backgroundColor: '#fef2f2',
    borderColor: '#fecaca',
  },
  ttsPreviewBtnText: {
    ...fontStyle('inter', 'semiBold'),
    fontSize: 12,
    color: '#0057FF',
  },
  ttsPreviewBtnTextPlaying: {
    color: '#ef4444',
  },
  ttsTagHint: {
    ...fontStyle('inter', 'regular'),
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
  },
  ttsScriptEditor: {
    minHeight: 90,
    textAlignVertical: 'top',
    lineHeight: 20,
    fontSize: 13,
    ...fontStyle('inter', 'regular'),
    backgroundColor: '#ffffff',
  },
  uploadWavPromptRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderStyle: 'dashed',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: 8,
    gap: 10,
    flexWrap: 'wrap',
  },
  uploadWavTitle: {
    ...fontStyle('inter', 'semiBold'),
    fontSize: 12,
    color: '#334155',
  },
  uploadWavHint: {
    ...fontStyle('inter', 'regular'),
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
  },
  uploadWavBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#bfdbfe',
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    gap: 6,
  },
  uploadWavBtnText: {
    ...fontStyle('inter', 'semiBold'),
    fontSize: 12,
    color: '#0057FF',
  },
  customAudioCard: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#bbf7d0',
    borderRadius: 8,
    padding: 12,
    marginTop: 8,
    gap: 8,
  },
  customAudioBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    flexWrap: 'wrap',
  },
  customAudioBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0fdf4',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    gap: 4,
  },
  customAudioBadgeText: {
    ...fontStyle('inter', 'semiBold'),
    fontSize: 11,
    color: '#16a34a',
  },
  customAudioUrlText: {
    ...fontStyle('inter', 'regular'),
    fontSize: 11,
    color: '#64748b',
    flex: 1,
    minWidth: 150,
  },
  customAudioActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  customAudioPlayBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#bfdbfe',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    gap: 6,
  },
  customAudioPlayBtnActive: {
    backgroundColor: '#fef2f2',
    borderColor: '#fecaca',
  },
  customAudioPlayBtnText: {
    ...fontStyle('inter', 'semiBold'),
    fontSize: 11,
    color: '#0057FF',
  },
  customAudioReplaceBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    gap: 4,
  },
  customAudioReplaceBtnText: {
    ...fontStyle('inter', 'medium'),
    fontSize: 11,
    color: '#475569',
  },
  customAudioRemoveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff1f2',
    borderWidth: 1,
    borderColor: '#fecdd3',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    gap: 4,
  },
  customAudioRemoveBtnText: {
    ...fontStyle('inter', 'medium'),
    fontSize: 11,
    color: '#e11d48',
  },
});
