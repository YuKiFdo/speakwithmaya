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
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons, Feather } from '@expo/vector-icons';
import { SvgXml } from 'react-native-svg';
import { fontStyle } from '@/theme/fonts';
import { useBreakpoint } from '@/hooks/useBreakpoint';
import { getBackendBaseUrl } from '@/hooks/useLiveCall';
import { AdminSidebar } from '@/components/admin/AdminSidebar';
import { AdminTopBar } from '@/components/admin/AdminTopBar';
import {
  RoadmapRobotIcon,
  RoadmapChatIcon,
  RoadmapCheckIcon,
  RoadmapFamilyIcon,
  RoadmapHomeIcon,
  RoadmapWaveIcon,
  RoadmapDirectionsIcon,
} from '@/components/icons/roadmap-icons';

/**
 * Adapt custom SVG colors dynamically:
 * Replaces currentColor, stroke and fill colors with the level's selected accent color.
 */
export function adaptSvgColor(rawSvg: string, color: string): string {
  if (!rawSvg || !rawSvg.trim()) return '';
  let svg = rawSvg.trim();

  // If only a <path ...> was pasted without an <svg> wrapper, wrap it
  if (!svg.startsWith('<svg')) {
    return `<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${svg}</svg>`;
  }

  // Replace currentColor
  svg = svg.replace(/currentColor/gi, color);

  // Check if stroke or fill is used
  const hasStroke = /stroke=["'](?!none|transparent)[^"']+["']/i.test(svg);
  const hasFill = /fill=["'](?!none|transparent)[^"']+["']/i.test(svg);

  if (hasStroke) {
    svg = svg.replace(/stroke=["'](?!none|transparent)[^"']+["']/gi, `stroke="${color}"`);
  }
  if (hasFill) {
    svg = svg.replace(/fill=["'](?!none|transparent)[^"']+["']/gi, `fill="${color}"`);
  }
  if (!hasFill && !hasStroke) {
    svg = svg.replace('<svg', `<svg stroke="${color}" fill="none"`);
  }

  return svg;
}

const SAMPLE_SVGS = [
  {
    name: 'Trophy',
    svg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/></svg>',
  },
  {
    name: 'Star',
    svg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>',
  },
  {
    name: 'Graduation',
    svg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/></svg>',
  },
  {
    name: 'Headphones',
    svg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 18v-6a9 9 0 0 1 18 0v6"/><path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z"/></svg>',
  },
];

export interface LearningObjective {
  id: string;
  title: string;
  description?: string;
  isMandatory?: boolean;
  targetTurns?: number;
}

export interface GuidedPrompt {
  scenarioRole?: string;
  coachingFocus?: string;
  openingQuestion?: string;
  customPromptAddon?: string;
}

export interface UnlockRule {
  type: 'free' | 'completion' | 'score' | 'time';
  minScore?: number;
  minDurationSeconds?: number;
  requiresLevelNumber?: number;
}

export interface RoadmapLevel {
  id: string;
  levelNumber: number;
  title: string;
  description: string;
  topic: string;
  targetDurationMinutes: number;
  xpReward: number;
  iconType: 'robot' | 'chat' | 'family' | 'home' | 'wave' | 'directions';
  numberColor: string;
  haloColor: string;
  haloBorderColor: string;
  scenarioId?: string;
  customSvg?: string;
  guidedPrompt: GuidedPrompt;
  unlockRule: UnlockRule;
  learningObjectives?: LearningObjective[];
  targetSpeakingShare?: number;
  isPublished: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface SimulatorMessage {
  id: string;
  sender: 'maya' | 'user';
  text: string;
  wordCount?: number;
  correction?: {
    original?: string;
    studentSaid?: string;
    corrected?: string;
    moreNatural?: string;
    explanation?: string;
  };
}

interface PromptPreset {
  id: string;
  name: string;
  topic: string;
  scenarioRole: string;
  coachingFocus: string;
  openingQuestion: string;
  iconType: 'robot' | 'chat' | 'family' | 'home' | 'wave' | 'directions';
  sampleObjectives?: Array<{
    title: string;
    description: string;
    isMandatory: boolean;
  }>;
}

const PROMPT_PRESETS: PromptPreset[] = [
  {
    id: 'cafe-ordering',
    name: 'Ordering at a Cafe',
    topic: 'Food & Dining Out',
    scenarioRole: 'Maya is a cheerful, polite barista at a busy coffee shop in Colombo.',
    coachingFocus: 'Polite requests using "Could I please have...", "I would like...", and asking for modifications.',
    openingQuestion: 'Hi there! Welcome to the cafe. What can I get started for you today?',
    iconType: 'chat',
    sampleObjectives: [
      { title: 'Order food or drinks clearly', description: 'State desired coffee or snack items using polite expressions', isMandatory: true },
      { title: 'Specify customization or size', description: 'Request milk type, sugar level, or cup size', isMandatory: true },
      { title: 'Ask about price or payment', description: 'Inquire how much it costs or offer payment', isMandatory: false },
    ],
  },
  {
    id: 'job-interview-strengths',
    name: 'Job Interview: Introducing Yourself',
    topic: 'Career & Workplace',
    scenarioRole: 'Maya is a warm and professional hiring manager conducting a friendly first-round interview.',
    coachingFocus: 'Professional self-introductions, career background, and articulating personal strengths confidently.',
    openingQuestion: 'Welcome to your interview! To start off, could you tell me a little bit about yourself and your background?',
    iconType: 'robot',
    sampleObjectives: [
      { title: 'Professional Introduction', description: 'Briefly summarize education or work background', isMandatory: true },
      { title: 'State Core Strengths', description: 'Share 2-3 key personal qualities or skills with examples', isMandatory: true },
      { title: 'Ask interviewer a question', description: 'Ask an insightful question about role or company culture', isMandatory: false },
    ],
  },
  {
    id: 'past-vacation',
    name: 'Describing a Memorable Vacation',
    topic: 'Travel & Experiences',
    scenarioRole: 'Maya is a close, curious friend who loves traveling and wants to hear all about your latest trip.',
    coachingFocus: 'Past tense verbs ("went", "visited", "tasted", "saw") and evocative sensory descriptions.',
    openingQuestion: 'Hey! I heard you went on a trip recently. Where did you go, and what was the highlight of the trip?',
    iconType: 'home',
    sampleObjectives: [
      { title: 'Share trip destination & timing', description: 'Explain where and when trip took place using past tense', isMandatory: true },
      { title: 'Describe memorable activities or food', description: 'Use sensory details to narrate highlights', isMandatory: true },
      { title: 'Reflect on the experience', description: 'State whether you would visit again and why', isMandatory: false },
    ],
  },
  {
    id: 'asking-directions',
    name: 'Asking & Following Directions',
    topic: 'Public Navigation',
    scenarioRole: 'Maya is a helpful local resident on the street helping a visitor find their way.',
    coachingFocus: 'Directional prepositions ("opposite to", "next to", "turn left at the traffic light", "keep walking straight").',
    openingQuestion: 'Excuse me! You seem to be searching for a street or building. Can I help you find where you are going?',
    iconType: 'directions',
    sampleObjectives: [
      { title: 'Ask for directions politely', description: 'Use polite opener like "Excuse me, how can I get to..."', isMandatory: true },
      { title: 'Clarify landmarks or distance', description: 'Ask how far it is or reference visible landmarks', isMandatory: true },
      { title: 'Confirm understanding & thank Maya', description: 'Rephrase directions and express gratitude', isMandatory: false },
    ],
  },
  {
    id: 'colleague-small-talk',
    name: 'Casual Colleague Small Talk',
    topic: 'Social Small Talk',
    scenarioRole: 'Maya is an enthusiastic colleague bumping into you at the office coffee pantry on Monday morning.',
    coachingFocus: 'Casual weekend conversation, showing interest with follow-up questions, and active listening.',
    openingQuestion: 'Good morning! How was your weekend? Did you do anything fun or relaxing?',
    iconType: 'wave',
    sampleObjectives: [
      { title: 'Weekend recap', description: 'Share 2-3 things done over the weekend with enthusiasm', isMandatory: true },
      { title: 'Ask Maya about her weekend', description: 'Reciprocate interest by asking about her activities', isMandatory: true },
      { title: 'Discuss the week ahead', description: 'Mention an upcoming work project or event', isMandatory: false },
    ],
  },
  {
    id: 'family-traditions',
    name: 'Family Celebrations & Food',
    topic: 'Family & Culture',
    scenarioRole: 'Maya is an empathetic friend curious about holiday traditions and family gatherings.',
    coachingFocus: 'Expressing feelings, descriptive food vocabulary, and cultural celebrations.',
    openingQuestion: 'When your family gets together for special occasions, what is your favorite traditional dish everyone loves?',
    iconType: 'family',
    sampleObjectives: [
      { title: 'Describe family holiday or event', description: 'Introduce occasion and who gathers together', isMandatory: true },
      { title: 'Highlight special dish or activity', description: 'Explain a specific custom or favorite family meal', isMandatory: true },
      { title: 'Express why it matters to you', description: 'Reflect on family bonding and memories', isMandatory: false },
    ],
  },
];

const COLOR_THEMES = [
  { name: 'Blue', numberColor: '#0057FF', haloColor: '#EFF6FF', haloBorderColor: '#BFDBFE' },
  { name: 'Purple', numberColor: '#9333EA', haloColor: '#FAF5FF', haloBorderColor: '#E9D5FF' },
  { name: 'Rose', numberColor: '#E11D48', haloColor: '#FFF1F2', haloBorderColor: '#FECDD3' },
  { name: 'Green', numberColor: '#16A34A', haloColor: '#F0FDF4', haloBorderColor: '#BBF7D0' },
  { name: 'Amber', numberColor: '#D97706', haloColor: '#FFFBEB', haloBorderColor: '#FDE68A' },
  { name: 'Indigo', numberColor: '#4F46E5', haloColor: '#EEF2FF', haloBorderColor: '#C7D2FE' },
];

const QUICK_TEST_PROMPTS = [
  { label: '⚡ Grammar Error', prompt: 'Yesterday I go to market and buyed some vegetables.' },
  { label: '⚡ Natural English', prompt: 'I had a really busy week at the office preparing reports.' },
  { label: '⚡ Short / Hesitant', prompt: 'Uh... yes, maybe coffee please.' },
  { label: '⚡ Off-Topic Test', prompt: 'Can you solve this algebra problem for me?' },
];

export default function AdminRoadmapScreen() {
  const { isPhone } = useBreakpoint();
  const { width: windowWidth } = useWindowDimensions();

  const [sidebarOpen, setSidebarOpen] = useState(!isPhone);
  const [levels, setLevels] = useState<RoadmapLevel[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Editor Modal State
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingLevel, setEditingLevel] = useState<RoadmapLevel | null>(null);
  const [activeTab, setActiveTab] = useState<'basics' | 'objectives' | 'unlock'>('basics');

  // Playground Modal State
  const [isPlaygroundOpen, setIsPlaygroundOpen] = useState(false);
  const [playgroundLevel, setPlaygroundLevel] = useState<RoadmapLevel | null>(null);
  const [simMessages, setSimMessages] = useState<SimulatorMessage[]>([]);
  const [simInput, setSimInput] = useState('');
  const [isSimulating, setIsSimulating] = useState(false);

  // Form Fields
  const [formLevelNumber, setFormLevelNumber] = useState<number>(1);
  const [formTitle, setFormTitle] = useState('');
  const [formTopic, setFormTopic] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formDuration, setFormDuration] = useState<number>(5);
  const [formXpReward, setFormXpReward] = useState<number>(100);
  const [formIcon, setFormIcon] = useState<'robot' | 'chat' | 'family' | 'home' | 'wave' | 'directions'>('chat');
  const [formColorIdx, setFormColorIdx] = useState(0);
  const [iconMode, setIconMode] = useState<'preset' | 'custom_svg'>('preset');
  const [formCustomSvg, setFormCustomSvg] = useState('');

  // Guided Prompt Fields
  const [formScenarioRole, setFormScenarioRole] = useState('');
  const [formCoachingFocus, setFormCoachingFocus] = useState('');
  const [formOpeningQuestion, setFormOpeningQuestion] = useState('');
  const [formCustomPromptAddon, setFormCustomPromptAddon] = useState('');

  // Objectives & Speaking Share Fields
  const [formTargetSpeakingShare, setFormTargetSpeakingShare] = useState<number>(40);
  const [formObjectives, setFormObjectives] = useState<LearningObjective[]>([]);

  // Unlock Rule Fields
  const [formUnlockType, setFormUnlockType] = useState<'free' | 'completion' | 'score' | 'time'>('score');
  const [formMinScore, setFormMinScore] = useState<number>(75);
  const [formMinSeconds, setFormMinSeconds] = useState<number>(240);
  const [formIsPublished, setFormIsPublished] = useState<boolean>(true);

  // Fetch all levels
  const fetchLevels = async () => {
    setIsLoading(true);
    setErrorMsg('');
    try {
      const baseUrl = getBackendBaseUrl();
      const res = await fetch(`${baseUrl}/v1/admin/roadmap`);
      if (res.ok) {
        const json = await res.json();
        setLevels(json.levels || []);
      } else {
        setErrorMsg('Could not fetch roadmap levels. Ensure maya-backend is running.');
      }
    } catch (e: any) {
      setErrorMsg(`Connection error: ${e?.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLevels();
  }, []);

  const openNewLevelModal = () => {
    const nextNumber = levels.length > 0 ? Math.max(...levels.map((l) => l.levelNumber)) + 1 : 1;
    setEditingLevel(null);
    setFormLevelNumber(nextNumber);
    setFormTitle(`Level ${nextNumber}`);
    setFormTopic('General Practice');
    setFormDescription('Practice conversational English with Maya.');
    setFormDuration(5);
    setFormXpReward(100);
    setFormIcon('chat');
    setIconMode('preset');
    setFormCustomSvg('');
    setFormColorIdx((nextNumber - 1) % COLOR_THEMES.length);
    setFormScenarioRole('Maya is a friendly conversational AI English coach.');
    setFormCoachingFocus('Fluency, conversational flow, and natural phrasing.');
    setFormOpeningQuestion('Hello! What would you like to talk about today?');
    setFormCustomPromptAddon('');
    setFormTargetSpeakingShare(40);
    setFormObjectives([
      { id: `obj_${Date.now()}_1`, title: 'Clear Self Introduction', description: 'Student introduces themselves with name and background', isMandatory: true },
      { id: `obj_${Date.now()}_2`, title: 'Answer Open Questions', description: 'Student responds with complete sentences rather than one-word answers', isMandatory: true },
    ]);
    setFormUnlockType(nextNumber === 1 ? 'free' : 'score');
    setFormMinScore(75);
    setFormMinSeconds(240);
    setFormIsPublished(true);
    setActiveTab('basics');
    setIsEditorOpen(true);
  };

  const openEditModal = (lvl: RoadmapLevel) => {
    setEditingLevel(lvl);
    setFormLevelNumber(lvl.levelNumber);
    setFormTitle(lvl.title);
    setFormTopic(lvl.topic || '');
    setFormDescription(lvl.description || '');
    setFormDuration(lvl.targetDurationMinutes || 5);
    setFormXpReward(lvl.xpReward || 100);
    setFormIcon(lvl.iconType || 'chat');
    if (lvl.customSvg && lvl.customSvg.trim()) {
      setIconMode('custom_svg');
      setFormCustomSvg(lvl.customSvg);
    } else {
      setIconMode('preset');
      setFormCustomSvg('');
    }
    const colorIdx = COLOR_THEMES.findIndex((c) => c.numberColor === lvl.numberColor);
    setFormColorIdx(colorIdx !== -1 ? colorIdx : 0);
    setFormScenarioRole(lvl.guidedPrompt?.scenarioRole || '');
    setFormCoachingFocus(lvl.guidedPrompt?.coachingFocus || '');
    setFormOpeningQuestion(lvl.guidedPrompt?.openingQuestion || '');
    setFormCustomPromptAddon(lvl.guidedPrompt?.customPromptAddon || '');
    setFormTargetSpeakingShare(lvl.targetSpeakingShare ?? 40);
    setFormObjectives(
      lvl.learningObjectives && lvl.learningObjectives.length > 0
        ? lvl.learningObjectives.map((o) => ({ ...o }))
        : [
            { id: `obj_${Date.now()}_1`, title: 'Active Speaking & Clarity', description: 'Express ideas clearly and naturally', isMandatory: true },
          ],
    );
    setFormUnlockType(lvl.unlockRule?.type || 'score');
    setFormMinScore(lvl.unlockRule?.minScore ?? 75);
    setFormMinSeconds(lvl.unlockRule?.minDurationSeconds ?? 240);
    setFormIsPublished(lvl.isPublished);
    setActiveTab('basics');
    setIsEditorOpen(true);
  };

  const handleApplyPreset = (preset: PromptPreset) => {
    setFormTitle(preset.name);
    setFormTopic(preset.topic);
    setFormScenarioRole(preset.scenarioRole);
    setFormCoachingFocus(preset.coachingFocus);
    setFormOpeningQuestion(preset.openingQuestion);
    setFormIcon(preset.iconType);
    if (preset.sampleObjectives && preset.sampleObjectives.length > 0) {
      setFormObjectives(
        preset.sampleObjectives.map((o, idx) => ({
          id: `obj_${Date.now()}_${idx + 1}`,
          title: o.title,
          description: o.description,
          isMandatory: o.isMandatory,
        })),
      );
    }
  };

  const handleSaveLevel = async () => {
    if (!formTitle.trim()) {
      alert('Please enter a Level Title.');
      return;
    }
    setIsSaving(true);
    const theme = COLOR_THEMES[formColorIdx];
    const payload = {
      levelNumber: Number(formLevelNumber),
      title: formTitle.trim(),
      description: formDescription.trim(),
      topic: formTopic.trim() || formTitle.trim(),
      targetDurationMinutes: Number(formDuration),
      xpReward: Number(formXpReward) || 100,
      iconType: formIcon,
      customSvg: iconMode === 'custom_svg' && formCustomSvg.trim() ? formCustomSvg.trim() : '',
      numberColor: theme.numberColor,
      haloColor: theme.haloColor,
      haloBorderColor: theme.haloBorderColor,
      guidedPrompt: {
        scenarioRole: formScenarioRole.trim(),
        coachingFocus: formCoachingFocus.trim(),
        openingQuestion: formOpeningQuestion.trim(),
        customPromptAddon: formCustomPromptAddon.trim(),
      },
      targetSpeakingShare: Number(formTargetSpeakingShare) || 40,
      learningObjectives: formObjectives.filter((o) => o.title.trim().length > 0),
      unlockRule: {
        type: formUnlockType,
        minScore: formUnlockType === 'score' ? Number(formMinScore) : undefined,
        minDurationSeconds: formUnlockType === 'time' ? Number(formMinSeconds) : undefined,
        requiresLevelNumber: formLevelNumber > 1 ? formLevelNumber - 1 : undefined,
      },
      isPublished: formIsPublished,
    };

    try {
      const baseUrl = getBackendBaseUrl();
      if (editingLevel) {
        // Update
        const res = await fetch(`${baseUrl}/v1/admin/roadmap/${editingLevel.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (res.ok) {
          setIsEditorOpen(false);
          await fetchLevels();
        } else {
          alert('Failed to update level.');
        }
      } else {
        // Create
        const res = await fetch(`${baseUrl}/v1/admin/roadmap`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (res.ok) {
          setIsEditorOpen(false);
          await fetchLevels();
        } else {
          alert('Failed to create level.');
        }
      }
    } catch (e: any) {
      alert(`Error saving level: ${e?.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteLevel = async (id: string, title: string) => {
    if (!confirm(`Are you sure you want to delete "${title}"?`)) return;
    try {
      const baseUrl = getBackendBaseUrl();
      const res = await fetch(`${baseUrl}/v1/admin/roadmap/${id}`, { method: 'DELETE' });
      if (res.ok) {
        fetchLevels();
      } else {
        alert('Failed to delete level.');
      }
    } catch (e: any) {
      alert(`Delete error: ${e?.message}`);
    }
  };

  const handleTogglePublish = async (lvl: RoadmapLevel) => {
    try {
      const baseUrl = getBackendBaseUrl();
      await fetch(`${baseUrl}/v1/admin/roadmap/${lvl.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isPublished: !lvl.isPublished }),
      });
      fetchLevels();
    } catch (e) {
      // ignore
    }
  };

  const handleMoveOrder = async (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= levels.length) return;

    const copy = [...levels];
    const current = copy[index];
    const target = copy[targetIndex];

    const currentNum = current.levelNumber;
    current.levelNumber = target.levelNumber;
    target.levelNumber = currentNum;

    copy[index] = target;
    copy[targetIndex] = current;
    setLevels(copy);

    try {
      const baseUrl = getBackendBaseUrl();
      await fetch(`${baseUrl}/v1/admin/roadmap/reorder`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          levels: copy.map((l) => ({ id: l.id, levelNumber: l.levelNumber })),
        }),
      });
    } catch (e) {
      fetchLevels();
    }
  };

  const openPlayground = (lvl: RoadmapLevel) => {
    setPlaygroundLevel(lvl);
    const icebreaker =
      lvl.guidedPrompt?.openingQuestion?.trim() ||
      'Hello! What would you like to talk about today?';
    setSimMessages([
      {
        id: `initial-maya-${Date.now()}`,
        sender: 'maya',
        text: icebreaker,
        wordCount: icebreaker.trim().split(/\s+/).filter(Boolean).length,
      },
    ]);
    setSimInput('');
    setIsPlaygroundOpen(true);
  };

  const openPlaygroundWithDraft = () => {
    const draftLevel: RoadmapLevel = {
      id: editingLevel?.id || 'draft-level',
      levelNumber: formLevelNumber,
      title: formTitle || `Level ${formLevelNumber}`,
      topic: formTopic || 'General Conversation',
      description: formDescription,
      targetDurationMinutes: formDuration,
      xpReward: formXpReward,
      iconType: formIcon,
      customSvg: iconMode === 'custom_svg' ? formCustomSvg : undefined,
      numberColor: COLOR_THEMES[formColorIdx].numberColor,
      haloColor: COLOR_THEMES[formColorIdx].haloColor,
      haloBorderColor: COLOR_THEMES[formColorIdx].haloBorderColor,
      isPublished: formIsPublished,
      guidedPrompt: {
        scenarioRole: formScenarioRole,
        coachingFocus: formCoachingFocus,
        openingQuestion: formOpeningQuestion,
        customPromptAddon: formCustomPromptAddon,
      },
      targetSpeakingShare: formTargetSpeakingShare,
      learningObjectives: formObjectives,
      unlockRule: {
        type: formUnlockType,
        minScore: formMinScore,
        minDurationSeconds: formMinSeconds,
      },
    };
    openPlayground(draftLevel);
  };

  const handleResetPlayground = () => {
    if (!playgroundLevel) return;
    const icebreaker =
      playgroundLevel.guidedPrompt?.openingQuestion?.trim() ||
      'Hello! What would you like to talk about today?';
    setSimMessages([
      {
        id: `reset-maya-${Date.now()}`,
        sender: 'maya',
        text: icebreaker,
        wordCount: icebreaker.trim().split(/\s+/).filter(Boolean).length,
      },
    ]);
    setSimInput('');
  };

  const handleSendSimulation = async (customText?: string) => {
    const text = (customText ?? simInput).trim();
    if (!text || !playgroundLevel || isSimulating) return;

    const userMsgId = `user-${Date.now()}`;
    const userMsg: SimulatorMessage = {
      id: userMsgId,
      sender: 'user',
      text,
    };

    setSimMessages((prev) => [...prev, userMsg]);
    if (!customText) setSimInput('');
    setIsSimulating(true);

    try {
      const baseUrl = getBackendBaseUrl();
      const res = await fetch(`${baseUrl}/v1/admin/roadmap/simulate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userMessage: text,
          guidedPrompt: playgroundLevel.guidedPrompt,
          topic: playgroundLevel.topic,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const replyText = data.mayaSpoken || data.reply || "That's great! Tell me more.";
        const mayaReply: SimulatorMessage = {
          id: `maya-${Date.now()}`,
          sender: 'maya',
          text: replyText,
          wordCount: data.wordCount ?? replyText.trim().split(/\s+/).filter(Boolean).length,
          correction: data.correction
            ? {
                original: data.correction.studentSaid || data.correction.original,
                corrected: data.correction.moreNatural || data.correction.corrected,
                explanation: data.correction.explanation || data.focusEvaluation,
              }
            : undefined,
        };
        setSimMessages((prev) => [...prev, mayaReply]);
      } else {
        setSimMessages((prev) => [
          ...prev,
          {
            id: `maya-${Date.now()}`,
            sender: 'maya',
            text: "I'm having trouble connecting to the simulation engine right now. Please try again.",
          },
        ]);
      }
    } catch (err: any) {
      setSimMessages((prev) => [
        ...prev,
        {
          id: `maya-${Date.now()}`,
          sender: 'maya',
          text: `Simulation error: ${err?.message || 'Unknown error'}`,
        },
      ]);
    } finally {
      setIsSimulating(false);
    }
  };

  const handleLaunchVoiceTest = (lvl: RoadmapLevel) => {
    setIsPlaygroundOpen(false);
    setIsEditorOpen(false);
    router.push({
      pathname: '/onboarding/call',
      params: {
        roadmapLevelId: lvl.id,
        levelNumber: String(lvl.levelNumber || 1),
        topic: lvl.topic || lvl.title,
        scenarioTitle: `[TEST] ${lvl.title}`,
        scenarioId: lvl.scenarioId || 'general-practice',
        duration: '300',
        durationMinutes: '5',
        languageMode: 'english',
        sinhalaStyle: 'smart',
        aiSuggestions: 'true',
        scenarioRole: lvl.guidedPrompt?.scenarioRole || '',
        coachingFocus: lvl.guidedPrompt?.coachingFocus || '',
        openingQuestion: lvl.guidedPrompt?.openingQuestion || '',
        customPromptAddon: lvl.guidedPrompt?.customPromptAddon || '',
        targetSpeakingShare: String(lvl.targetSpeakingShare || 40),
        learningObjectives: lvl.learningObjectives && lvl.learningObjectives.length > 0 ? JSON.stringify(lvl.learningObjectives) : '',
      },
    });
  };

  const renderMilestoneIcon = (type: string, color: string, customSvg?: string) => {
    if (customSvg && customSvg.trim()) {
      try {
        const adapted = adaptSvgColor(customSvg, color);
        if (adapted) {
          return <SvgXml xml={adapted} width={22} height={22} />;
        }
      } catch (e) {
        // fallback
      }
    }
    switch (type) {
      case 'robot':
        return <RoadmapRobotIcon size={22} />;
      case 'family':
        return <RoadmapFamilyIcon size={22} />;
      case 'home':
        return <RoadmapHomeIcon size={22} />;
      case 'wave':
        return <RoadmapWaveIcon size={22} />;
      case 'directions':
        return <RoadmapDirectionsIcon size={22} />;
      default:
        return <RoadmapChatIcon size={22} />;
    }
  };

  // Metrics
  const totalLevels = levels.length;
  const publishedCount = levels.filter((l) => l.isPublished).length;
  const totalMinutes = levels.reduce((acc, l) => acc + (l.targetDurationMinutes || 5), 0);
  const totalXp = levels.reduce((acc, l) => acc + (l.xpReward || 100), 0);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <View style={styles.container}>
        {/* Modular Reusable Admin Sidebar */}
        <AdminSidebar
          activeRoute="/admin/roadmap"
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
        />

        {/* Main Content Area */}
        <View style={styles.mainContent}>
          {/* Modular Reusable Admin Top Bar */}
          <AdminTopBar
            title="Maya Curriculum Studio"
            subtitle="Design roadmap levels, configure guided Maya personas, and define progression unlock rules."
            badgeText="Guided Mode"
            sidebarOpen={sidebarOpen}
            onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
            rightElement={
              <Pressable onPress={openNewLevelModal} style={styles.newLevelBtn}>
                <Feather name="plus-circle" size={16} color="#ffffff" style={{ marginRight: 6 }} />
                <Text style={styles.newLevelBtnText}>Add New Level</Text>
              </Pressable>
            }
          />

          {/* Metrics Bar */}
          <View style={styles.metricsRow}>
            <View style={styles.metricCard}>
              <Text style={styles.metricLabel}>Total Levels</Text>
              <Text style={styles.metricVal}>{totalLevels}</Text>
              <Text style={styles.metricSub}>In curriculum track</Text>
            </View>
            <View style={styles.metricCard}>
              <Text style={styles.metricLabel}>Published & Live</Text>
              <Text style={[styles.metricVal, { color: '#16a34a' }]}>{publishedCount}</Text>
              <Text style={styles.metricSub}>{totalLevels - publishedCount} in draft mode</Text>
            </View>
            <View style={styles.metricCard}>
              <Text style={styles.metricLabel}>Total Learning Time</Text>
              <Text style={[styles.metricVal, { color: '#0284c7' }]}>{totalMinutes}m</Text>
              <Text style={styles.metricSub}>Speaking practice</Text>
            </View>
            <View style={styles.metricCard}>
              <Text style={styles.metricLabel}>Curriculum XP</Text>
              <Text style={[styles.metricVal, { color: '#d97706' }]}>+{totalXp} XP</Text>
              <Text style={styles.metricSub}>Total student reward</Text>
            </View>
          </View>

          {/* Level List */}
          <ScrollView style={styles.levelsScroll} showsVerticalScrollIndicator={false}>
            {isLoading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#0d9488" />
                <Text style={styles.loadingText}>Loading Roadmap levels...</Text>
              </View>
            ) : errorMsg ? (
              <View style={styles.errorContainer}>
                <Feather name="alert-triangle" size={24} color="#dc2626" />
                <Text style={styles.errorText}>{errorMsg}</Text>
                <Pressable onPress={fetchLevels} style={styles.retryBtn}>
                  <Text style={styles.retryBtnText}>Retry Fetching</Text>
                </Pressable>
              </View>
            ) : levels.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Feather name="map" size={36} color="#94a3b8" />
                <Text style={styles.emptyTitle}>No Roadmap Levels Yet</Text>
                <Text style={styles.emptySubtitle}>Click "Add New Level" to start building your student curriculum.</Text>
                <Pressable onPress={openNewLevelModal} style={styles.emptyAddBtn}>
                  <Text style={styles.emptyAddBtnText}>Create Level 01</Text>
                </Pressable>
              </View>
            ) : (
              <View style={styles.levelCardsList}>
                {levels.map((lvl, index) => {
                  const numberFormatted = String(lvl.levelNumber).padStart(2, '0');
                  const isFirst = index === 0;
                  const isLast = index === levels.length - 1;

                  return (
                    <View key={lvl.id} style={styles.levelCard}>
                      {/* Left: Reorder & Number */}
                      <View style={styles.levelCardLeft}>
                        <View style={styles.reorderCol}>
                          <Pressable
                            disabled={isFirst}
                            onPress={() => handleMoveOrder(index, 'up')}
                            style={[styles.reorderBtn, isFirst && { opacity: 0.3 }]}
                          >
                            <Feather name="chevron-up" size={16} color="#475569" />
                          </Pressable>
                          <Pressable
                            disabled={isLast}
                            onPress={() => handleMoveOrder(index, 'down')}
                            style={[styles.reorderBtn, isLast && { opacity: 0.3 }]}
                          >
                            <Feather name="chevron-down" size={16} color="#475569" />
                          </Pressable>
                        </View>

                        {/* Milestone Circle Preview */}
                        <View
                          style={[
                            styles.haloPreview,
                            {
                              backgroundColor: lvl.haloColor || '#EFF6FF',
                              borderColor: lvl.haloBorderColor || '#BFDBFE',
                            },
                          ]}
                        >
                          <View style={styles.iconCircle}>
                            {renderMilestoneIcon(lvl.iconType, lvl.numberColor || '#0057FF', lvl.customSvg)}
                          </View>
                          <View
                            style={[
                              styles.numberBadge,
                              { backgroundColor: lvl.numberColor || '#0057FF' },
                            ]}
                          >
                            <Text style={styles.numberBadgeText}>{numberFormatted}</Text>
                          </View>
                        </View>
                      </View>

                      {/* Middle: Details & Prompt summary */}
                      <View style={styles.levelCardCenter}>
                        <View style={styles.titleRow}>
                          <Text style={styles.levelTitle}>{lvl.title}</Text>
                          <View style={styles.timeBadge}>
                            <Feather name="clock" size={12} color="#0369a1" style={{ marginRight: 4 }} />
                            <Text style={styles.timeBadgeText}>{lvl.targetDurationMinutes} min</Text>
                          </View>
                          <View style={styles.xpBadge}>
                            <Feather name="award" size={12} color="#b45309" style={{ marginRight: 4 }} />
                            <Text style={styles.xpBadgeText}>+{lvl.xpReward || 100} XP</Text>
                          </View>
                          {lvl.learningObjectives && lvl.learningObjectives.length > 0 && (
                            <View style={styles.objectivesBadge}>
                              <Feather name="target" size={12} color="#059669" style={{ marginRight: 4 }} />
                              <Text style={styles.objectivesBadgeText}>
                                {lvl.learningObjectives.length} Obj
                              </Text>
                            </View>
                          )}
                          <View
                            style={[
                              styles.statusBadge,
                              lvl.isPublished ? styles.statusBadgePub : styles.statusBadgeDraft,
                            ]}
                          >
                            <Text
                              style={[
                                styles.statusBadgeText,
                                lvl.isPublished ? styles.statusBadgeTextPub : styles.statusBadgeTextDraft,
                              ]}
                            >
                              {lvl.isPublished ? 'Published' : 'Draft'}
                            </Text>
                          </View>
                        </View>

                        <Text style={styles.levelDesc} numberOfLines={2}>
                          {lvl.description || 'No description provided.'}
                        </Text>

                        {/* Guided Prompt Preview Snippets */}
                        <View style={styles.guidedSnippetsRow}>
                          {lvl.guidedPrompt?.scenarioRole ? (
                            <View style={styles.snippetItem}>
                              <Text style={styles.snippetLabel}>Role:</Text>
                              <Text style={styles.snippetValue} numberOfLines={1}>
                                {lvl.guidedPrompt.scenarioRole}
                              </Text>
                            </View>
                          ) : null}

                          {lvl.guidedPrompt?.openingQuestion ? (
                            <View style={styles.snippetItem}>
                              <Text style={styles.snippetLabel}>Icebreaker:</Text>
                              <Text style={styles.snippetValue} numberOfLines={1}>
                                "{lvl.guidedPrompt.openingQuestion}"
                              </Text>
                            </View>
                          ) : null}
                        </View>

                        {/* Unlock Rule Info */}
                        <View style={styles.unlockRuleRow}>
                          <Feather name="lock" size={13} color="#64748b" style={{ marginRight: 5 }} />
                          <Text style={styles.unlockRuleText}>
                            {lvl.unlockRule?.type === 'free'
                              ? 'Always Unlocked (Open to all)'
                              : lvl.unlockRule?.type === 'score'
                              ? `Unlocks when Level ${lvl.levelNumber - 1} score ≥ ${lvl.unlockRule.minScore ?? 75}%`
                              : lvl.unlockRule?.type === 'time'
                              ? `Unlocks after ${Math.round((lvl.unlockRule.minDurationSeconds ?? 240) / 60)}m speaking on Level ${lvl.levelNumber - 1}`
                              : `Unlocks upon completing Level ${lvl.levelNumber - 1}`}
                          </Text>
                        </View>
                      </View>

                      {/* Right Actions */}
                      <View style={styles.levelCardRight}>
                        <Pressable
                          onPress={() => openPlayground(lvl)}
                          style={[styles.actionBtn, styles.btnPlayground]}
                        >
                          <Feather name="play-circle" size={14} color="#7c3aed" />
                          <Text style={[styles.actionBtnText, { color: '#7c3aed' }]}>Playground</Text>
                        </Pressable>

                        <Pressable
                          onPress={() => handleTogglePublish(lvl)}
                          style={[
                            styles.actionBtn,
                            lvl.isPublished ? styles.btnUnpublish : styles.btnPublish,
                          ]}
                        >
                          <Feather
                            name={lvl.isPublished ? 'eye-off' : 'eye'}
                            size={14}
                            color={lvl.isPublished ? '#64748b' : '#0d9488'}
                          />
                          <Text
                            style={[
                              styles.actionBtnText,
                              { color: lvl.isPublished ? '#64748b' : '#0d9488' },
                            ]}
                          >
                            {lvl.isPublished ? 'Unpublish' : 'Publish'}
                          </Text>
                        </Pressable>

                        <Pressable
                          onPress={() => openEditModal(lvl)}
                          style={[styles.actionBtn, styles.btnEdit]}
                        >
                          <Feather name="edit-2" size={14} color="#0284c7" />
                          <Text style={[styles.actionBtnText, { color: '#0284c7' }]}>Edit</Text>
                        </Pressable>

                        <Pressable
                          onPress={() => handleDeleteLevel(lvl.id, lvl.title)}
                          style={[styles.actionBtn, styles.btnDelete]}
                        >
                          <Feather name="trash-2" size={14} color="#ef4444" />
                        </Pressable>
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
      {/* 3. GUIDED LEVEL EDITOR MODAL                                 */}
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
                    {editingLevel ? `Edit Level: ${formTitle}` : 'Create New Curriculum Level'}
                  </Text>
                  <Text style={styles.modalSubtitle}>
                    Structured prompt builder & progression rules — zero prompt engineering code required.
                  </Text>
                </View>
              </View>
              <Pressable onPress={() => setIsEditorOpen(false)} style={styles.modalCloseBtn}>
                <Feather name="x" size={20} color="#64748b" />
              </Pressable>
            </View>

            {/* Modal Tabs - Streamlined 3-Tab Architecture */}
            <View style={styles.modalTabsRow}>
              <Pressable
                onPress={() => setActiveTab('basics')}
                style={[styles.tabBtn, activeTab === 'basics' && styles.tabBtnActive]}
              >
                <Feather
                  name="layers"
                  size={15}
                  color={activeTab === 'basics' ? '#0d9488' : '#64748b'}
                  style={{ marginRight: 8 }}
                />
                <Text style={[styles.tabBtnText, activeTab === 'basics' && styles.tabBtnTextActive]}>
                  1. Basics & Scenario
                </Text>
              </Pressable>

              <Pressable
                onPress={() => setActiveTab('objectives')}
                style={[styles.tabBtn, activeTab === 'objectives' && styles.tabBtnActive]}
              >
                <Feather
                  name="target"
                  size={15}
                  color={activeTab === 'objectives' ? '#0d9488' : '#64748b'}
                  style={{ marginRight: 8 }}
                />
                <Text style={[styles.tabBtnText, activeTab === 'objectives' && styles.tabBtnTextActive]}>
                  2. Objectives & Speaking ({formObjectives.length})
                </Text>
              </Pressable>

              <Pressable
                onPress={() => setActiveTab('unlock')}
                style={[styles.tabBtn, activeTab === 'unlock' && styles.tabBtnActive]}
              >
                <Feather
                  name="lock"
                  size={15}
                  color={activeTab === 'unlock' ? '#0d9488' : '#64748b'}
                  style={{ marginRight: 8 }}
                />
                <Text style={[styles.tabBtnText, activeTab === 'unlock' && styles.tabBtnTextActive]}>
                  3. Unlock Rules
                </Text>
              </Pressable>
            </View>

            {/* Tab Body */}
            <ScrollView style={styles.modalBodyScroll} showsVerticalScrollIndicator={false}>
              {/* TAB 1: BASICS */}
              {activeTab === 'basics' && (
                <View style={styles.tabSection}>
                  <View style={styles.twoColRow}>
                    <View style={styles.formCol}>
                      <Text style={styles.fieldLabel}>Level Number</Text>
                      <TextInput
                        style={styles.textInput}
                        value={String(formLevelNumber)}
                        onChangeText={(txt) => setFormLevelNumber(parseInt(txt, 10) || 1)}
                        keyboardType="numeric"
                      />
                    </View>
                    <View style={[styles.formCol, { flex: 2 }]}>
                      <Text style={styles.fieldLabel}>Level Title *</Text>
                      <TextInput
                        style={styles.textInput}
                        value={formTitle}
                        onChangeText={setFormTitle}
                        placeholder="e.g. Talking about your day"
                      />
                    </View>
                  </View>

                  <View style={styles.formGroup}>
                    <Text style={styles.fieldLabel}>Topic / Scenario Category</Text>
                    <TextInput
                      style={styles.textInput}
                      value={formTopic}
                      onChangeText={setFormTopic}
                      placeholder="e.g. Daily Routine & Habits"
                    />
                  </View>

                  <View style={styles.formGroup}>
                    <Text style={styles.fieldLabel}>Student Description (Summary)</Text>
                    <TextInput
                      style={[styles.textInput, styles.textArea]}
                      value={formDescription}
                      onChangeText={setFormDescription}
                      placeholder="Explain what the student will learn in this speaking milestone..."
                      multiline
                      numberOfLines={3}
                    />
                  </View>

                  <View style={styles.twoColRow}>
                    <View style={styles.formCol}>
                      <Text style={styles.fieldLabel}>Target Duration</Text>
                      <View style={styles.durationBtnRow}>
                        {[5, 10, 15, 30].map((mins) => (
                          <Pressable
                            key={mins}
                            onPress={() => setFormDuration(mins)}
                            style={[
                              styles.durPill,
                              formDuration === mins && styles.durPillActive,
                            ]}
                          >
                            <Text
                              style={[
                                styles.durPillText,
                                formDuration === mins && styles.durPillTextActive,
                              ]}
                            >
                              {mins}m
                            </Text>
                          </Pressable>
                        ))}
                      </View>
                    </View>

                    <View style={styles.formCol}>
                      <Text style={styles.fieldLabel}>XP Reward (Milestone Points)</Text>
                      <View style={styles.durationBtnRow}>
                        {[50, 75, 100, 150, 200].map((xp) => (
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

                  <View style={styles.formGroup}>
                    <View style={styles.labelWithColorInfo}>
                      <Text style={styles.fieldLabel}>Accent Color Theme</Text>
                      <Text style={[styles.colorNameLabel, { color: COLOR_THEMES[formColorIdx].numberColor }]}>
                        ● {COLOR_THEMES[formColorIdx].name}
                      </Text>
                    </View>
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

                  {/* ICON SELECTION: PRESET vs CUSTOM SVG */}
                  <View style={styles.iconConfigCard}>
                    <View style={styles.iconSectionHeader}>
                      <View>
                        <Text style={styles.fieldLabel}>Milestone Icon</Text>
                        <Text style={styles.fieldHelper}>
                          Choose from standard icons or paste custom SVG vectors
                        </Text>
                      </View>

                      {/* Segmented Toggle: Standard vs Custom SVG */}
                      <View style={styles.iconModeToggle}>
                        <Pressable
                          onPress={() => setIconMode('preset')}
                          style={[
                            styles.iconModeBtn,
                            iconMode === 'preset' && styles.iconModeBtnActive,
                          ]}
                        >
                          <Feather
                            name="grid"
                            size={12}
                            color={iconMode === 'preset' ? '#0d9488' : '#64748b'}
                            style={{ marginRight: 4 }}
                          />
                          <Text
                            style={[
                              styles.iconModeBtnText,
                              iconMode === 'preset' && styles.iconModeBtnTextActive,
                            ]}
                          >
                            Standard Icons
                          </Text>
                        </Pressable>

                        <Pressable
                          onPress={() => setIconMode('custom_svg')}
                          style={[
                            styles.iconModeBtn,
                            iconMode === 'custom_svg' && styles.iconModeBtnActive,
                          ]}
                        >
                          <Feather
                            name="code"
                            size={12}
                            color={iconMode === 'custom_svg' ? '#0d9488' : '#64748b'}
                            style={{ marginRight: 4 }}
                          />
                          <Text
                            style={[
                              styles.iconModeBtnText,
                              iconMode === 'custom_svg' && styles.iconModeBtnTextActive,
                            ]}
                          >
                            Custom SVG
                          </Text>
                        </Pressable>
                      </View>
                    </View>

                    {iconMode === 'preset' ? (
                      <View style={styles.iconPickerRow}>
                        {(['robot', 'chat', 'family', 'home', 'wave', 'directions'] as const).map((ic) => (
                          <Pressable
                            key={ic}
                            onPress={() => setFormIcon(ic)}
                            style={[
                              styles.iconChoiceBtn,
                              formIcon === ic && styles.iconChoiceBtnActive,
                            ]}
                          >
                            {renderMilestoneIcon(ic, formIcon === ic ? COLOR_THEMES[formColorIdx].numberColor : '#64748b')}
                          </Pressable>
                        ))}
                      </View>
                    ) : (
                      <View style={styles.customSvgContainer}>
                        {/* Live Color-Reactive Preview Banner */}
                        <View style={styles.customSvgPreviewBanner}>
                          <View
                            style={[
                              styles.svgPreviewHalo,
                              {
                                backgroundColor: COLOR_THEMES[formColorIdx].haloColor,
                                borderColor: COLOR_THEMES[formColorIdx].haloBorderColor,
                              },
                            ]}
                          >
                            <View style={styles.svgPreviewCircle}>
                              {formCustomSvg.trim() ? (
                                <SvgXml
                                  xml={adaptSvgColor(formCustomSvg, COLOR_THEMES[formColorIdx].numberColor)}
                                  width={24}
                                  height={24}
                                />
                              ) : (
                                <Feather name="image" size={20} color="#94a3b8" />
                              )}
                            </View>
                            <View
                              style={[
                                styles.previewNumberBadge,
                                { backgroundColor: COLOR_THEMES[formColorIdx].numberColor },
                              ]}
                            >
                              <Text style={styles.previewNumberBadgeText}>
                                {String(formLevelNumber).padStart(2, '0')}
                              </Text>
                            </View>
                          </View>

                          <View style={styles.customSvgPreviewInfo}>
                            <View style={styles.liveBadgeRow}>
                              <View
                                style={[
                                  styles.liveDot,
                                  { backgroundColor: COLOR_THEMES[formColorIdx].numberColor },
                                ]}
                              />
                              <Text style={styles.liveColorLabel}>
                                Dynamic Color Sync:{' '}
                                <Text style={{ color: COLOR_THEMES[formColorIdx].numberColor, fontWeight: '700' }}>
                                  {COLOR_THEMES[formColorIdx].name} ({COLOR_THEMES[formColorIdx].numberColor})
                                </Text>
                              </Text>
                            </View>
                            <Text style={styles.customSvgHelpText}>
                              SVG colors adapt in real-time when you select any accent color above!
                            </Text>
                          </View>
                        </View>

                        {/* Quick Sample SVG Chips */}
                        <View style={styles.sampleSvgRow}>
                          <Text style={styles.sampleSvgLabel}>Quick Samples:</Text>
                          {SAMPLE_SVGS.map((sample) => (
                            <Pressable
                              key={sample.name}
                              onPress={() => setFormCustomSvg(sample.svg)}
                              style={styles.sampleSvgChip}
                            >
                              <Text style={styles.sampleSvgChipText}>{sample.name}</Text>
                            </Pressable>
                          ))}
                          {formCustomSvg ? (
                            <Pressable
                              onPress={() => setFormCustomSvg('')}
                              style={styles.clearSvgBtn}
                            >
                              <Feather name="x-circle" size={12} color="#ef4444" style={{ marginRight: 3 }} />
                              <Text style={styles.clearSvgBtnText}>Clear</Text>
                            </Pressable>
                          ) : null}
                        </View>

                        {/* Raw SVG TextInput */}
                        <TextInput
                          style={[styles.textInput, styles.svgCodeInput]}
                          value={formCustomSvg}
                          onChangeText={setFormCustomSvg}
                          placeholder={'Paste raw SVG code here:\n<svg viewBox="0 0 24 24" fill="none" stroke="currentColor">\n  <path d="..." />\n</svg>'}
                          placeholderTextColor="#94a3b8"
                          multiline
                          numberOfLines={4}
                          autoCapitalize="none"
                          autoCorrect={false}
                        />
                      </View>
                    )}
                  </View>

                  {/* Scenario Roleplay & Maya's Persona (Merged into Tab 1) */}
                  <View style={styles.scenarioCard}>
                    <View style={styles.scenarioHeader}>
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <Feather name="message-circle" size={16} color="#0d9488" style={{ marginRight: 6 }} />
                        <Text style={styles.fieldLabel}>Scenario Roleplay & Maya's Persona</Text>
                      </View>
                      <View style={styles.hintBadge}>
                        <Text style={styles.hintBadgeText}>Dynamic Voice AI</Text>
                      </View>
                    </View>
                    <Text style={styles.fieldHelper}>
                      Who is Maya acting as, and what is her opening question? Maya adapts the conversation naturally from this icebreaker.
                    </Text>

                    {/* Quick Lesson Templates */}
                    <View style={styles.presetsBarRow}>
                      <Text style={styles.presetsLabel}>Templates:</Text>
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.presetsScroll}>
                        {PROMPT_PRESETS.map((p) => (
                          <Pressable
                            key={p.id}
                            onPress={() => handleApplyPreset(p)}
                            style={styles.presetChip}
                          >
                            <Text style={styles.presetChipText}>{p.name}</Text>
                          </Pressable>
                        ))}
                      </ScrollView>
                    </View>

                    <View style={{ marginTop: 6 }}>
                      <Text style={styles.subFieldLabel}>1. Maya's Role & Character</Text>
                      <TextInput
                        style={styles.textInput}
                        value={formScenarioRole}
                        onChangeText={setFormScenarioRole}
                        placeholder="e.g. Maya is a cheerful barista at a busy coffee shop in Colombo."
                      />
                    </View>

                    <View style={{ marginTop: 8 }}>
                      <Text style={styles.subFieldLabel}>2. Opening Icebreaker Question</Text>
                      <TextInput
                        style={styles.textInput}
                        value={formOpeningQuestion}
                        onChangeText={setFormOpeningQuestion}
                        placeholder="e.g. Hi there! Welcome to the cafe. What can I get started for you today?"
                      />
                      <Text style={styles.fieldHelper}>
                        💡 Tip: Maya speaks this opening line to kick off the session and invites the student to respond.
                      </Text>
                    </View>

                    <View style={{ marginTop: 8 }}>
                      <Text style={styles.subFieldLabel}>3. Coaching Focus & Pedagogical Emphasis</Text>
                      <TextInput
                        style={styles.textInput}
                        value={formCoachingFocus}
                        onChangeText={setFormCoachingFocus}
                        placeholder="e.g. Descriptive adjectives for personality and appearance (kind, hardworking, energetic)."
                      />
                      <Text style={styles.fieldHelper}>
                        Directs Maya's feedback toward specific vocabulary, grammar patterns, or fluency goals.
                      </Text>
                    </View>

                    <View style={{ marginTop: 8 }}>
                      <Text style={styles.subFieldLabel}>4. Custom System Prompt Add-on (Optional)</Text>
                      <TextInput
                        style={[styles.textInput, { minHeight: 60 }]}
                        value={formCustomPromptAddon}
                        onChangeText={setFormCustomPromptAddon}
                        placeholder="e.g. If the student hesitates, offer a gentle starter phrase. Praise their confidence."
                        multiline
                      />
                      <Text style={styles.fieldHelper}>
                        Custom behavioral nuances or rules injected into Maya's live coaching instructions.
                      </Text>
                    </View>
                  </View>
                </View>
              )}

              {/* TAB 3: OBJECTIVES & SPEAKING SHARE */}
              {activeTab === 'objectives' && (
                <View style={styles.tabSection}>
                  {/* Student Speaking Target Section */}
                  <View style={styles.promptCard}>
                    <View style={styles.promptCardHeader}>
                      <Text style={styles.fieldLabel}>Student Speaking Share Target</Text>
                      <View style={styles.hintBadge}>
                        <Text style={styles.hintBadgeText}>Anti-Monologue Guardrail</Text>
                      </View>
                    </View>
                    <Text style={styles.fieldHelper}>
                      The minimum percentage of conversation time the student should be actively talking. Ensures Maya acts as a responsive coach rather than lecturing.
                    </Text>
                    <View style={styles.scoreRow}>
                      {[30, 40, 50, 60].map((share) => (
                        <Pressable
                          key={share}
                          onPress={() => setFormTargetSpeakingShare(share)}
                          style={[
                            styles.scorePill,
                            formTargetSpeakingShare === share && styles.scorePillActive,
                          ]}
                        >
                          <Text
                            style={[
                              styles.scorePillText,
                              formTargetSpeakingShare === share && styles.scorePillTextActive,
                            ]}
                          >
                            ≥ {share}% {share === 40 ? '(Standard)' : ''}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                  </View>

                  {/* Curriculum Objectives Section */}
                  <View style={styles.objectivesSectionCard}>
                    <View style={styles.objectivesSectionHeader}>
                      <View>
                        <Text style={styles.fieldLabel}>Curriculum Learning Objectives</Text>
                        <Text style={styles.fieldHelper}>
                          Maya guides the conversation toward these checkpoints and evaluates student responses in real time.
                        </Text>
                      </View>
                      <Pressable
                        onPress={() => {
                          const newObj: LearningObjective = {
                            id: `obj_${Date.now()}_${formObjectives.length + 1}`,
                            title: '',
                            description: '',
                            isMandatory: true,
                          };
                          setFormObjectives([...formObjectives, newObj]);
                        }}
                        style={styles.addObjectiveBtn}
                      >
                        <Feather name="plus" size={14} color="#0d9488" style={{ marginRight: 4 }} />
                        <Text style={styles.addObjectiveBtnText}>Add Objective</Text>
                      </Pressable>
                    </View>

                    {formObjectives.length === 0 ? (
                      <View style={styles.emptyObjectivesBox}>
                        <Feather name="target" size={26} color="#94a3b8" style={{ marginBottom: 6 }} />
                        <Text style={styles.emptyObjectivesTitle}>No specific checkpoints added yet</Text>
                        <Text style={styles.emptyObjectivesDesc}>
                          Add 2-3 learning checkpoints so Maya can guide and score the student's speaking goals.
                        </Text>
                        <View style={styles.emptyActionsRow}>
                          <Pressable
                            onPress={() => {
                              const newObj: LearningObjective = {
                                id: `obj_${Date.now()}_1`,
                                title: '',
                                description: '',
                                isMandatory: true,
                              };
                              setFormObjectives([newObj]);
                            }}
                            style={styles.addObjectiveBtn}
                          >
                            <Feather name="plus" size={14} color="#0d9488" style={{ marginRight: 4 }} />
                            <Text style={styles.addObjectiveBtnText}>Add Objective</Text>
                          </Pressable>
                          <Pressable
                            onPress={() => {
                              setFormObjectives([
                                { id: `obj_${Date.now()}_1`, title: 'Active Greeting & Introduction', description: 'Student introduces themselves clearly with relevant details', isMandatory: true },
                                { id: `obj_${Date.now()}_2`, title: 'Answer Open Questions', description: 'Student responds with full sentences rather than one-word answers', isMandatory: true },
                                { id: `obj_${Date.now()}_3`, title: 'Ask Maya a Follow-up Question', description: 'Student shows conversational engagement by reciprocating a question', isMandatory: false },
                              ]);
                            }}
                            style={styles.quickFillObjectivesBtn}
                          >
                            <Feather name="zap" size={14} color="#d97706" style={{ marginRight: 4 }} />
                            <Text style={styles.quickFillObjectivesBtnText}>Auto-Fill Common Checkpoints</Text>
                          </Pressable>
                        </View>
                      </View>
                    ) : (
                      formObjectives.map((obj, index) => (
                        <View key={obj.id || index} style={styles.objectiveEditorCard}>
                          <View style={styles.objectiveCardTop}>
                            <View style={styles.objectiveNumBadge}>
                              <Text style={styles.objectiveNumText}>#{index + 1}</Text>
                            </View>
                            <TextInput
                              style={[styles.textInput, { flex: 1, marginHorizontal: 8 }]}
                              value={obj.title}
                              onChangeText={(val) => {
                                const updated = [...formObjectives];
                                updated[index] = { ...updated[index], title: val };
                                setFormObjectives(updated);
                              }}
                              placeholder={`Objective title (e.g. Order coffee politely)`}
                            />
                            <Pressable
                              onPress={() => {
                                const updated = [...formObjectives];
                                updated[index] = { ...updated[index], isMandatory: !obj.isMandatory };
                                setFormObjectives(updated);
                              }}
                              style={[
                                styles.mandatoryToggle,
                                obj.isMandatory !== false && styles.mandatoryToggleActive,
                              ]}
                            >
                              <Text
                                style={[
                                  styles.mandatoryToggleText,
                                  obj.isMandatory !== false && styles.mandatoryToggleTextActive,
                                ]}
                              >
                                {obj.isMandatory !== false ? 'Required' : 'Optional'}
                              </Text>
                            </Pressable>
                            <Pressable
                              onPress={() => {
                                setFormObjectives(formObjectives.filter((_, i) => i !== index));
                              }}
                              style={styles.deleteObjectiveBtn}
                              hitSlop={8}
                            >
                              <Feather name="trash-2" size={16} color="#ef4444" />
                            </Pressable>
                          </View>
                          <TextInput
                            style={[styles.textInput, { marginTop: 8 }]}
                            value={obj.description || ''}
                            onChangeText={(val) => {
                              const updated = [...formObjectives];
                              updated[index] = { ...updated[index], description: val };
                              setFormObjectives(updated);
                            }}
                            placeholder="Criteria / hint (e.g. Student uses 'Could I please get...' and specifies size)"
                          />
                          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8, flexWrap: 'wrap', gap: 6 }}>
                            <Text style={[styles.fieldHelper, { marginRight: 4, marginTop: 0 }]}>
                              Target Budget:
                            </Text>
                            {[undefined, 3, 4, 5, 6].map((turns) => {
                              const isSelected = obj.targetTurns === turns;
                              return (
                                <Pressable
                                  key={turns === undefined ? 'auto' : turns}
                                  onPress={() => {
                                    const updated = [...formObjectives];
                                    updated[index] = { ...updated[index], targetTurns: turns };
                                    setFormObjectives(updated);
                                  }}
                                  style={[
                                    styles.turnBudgetPill,
                                    isSelected && styles.turnBudgetPillActive,
                                  ]}
                                >
                                  <Text
                                    style={[
                                      styles.turnBudgetPillText,
                                      isSelected && styles.turnBudgetPillTextActive,
                                    ]}
                                  >
                                    {turns === undefined ? 'Auto (~3-5)' : `${turns} turns`}
                                  </Text>
                                </Pressable>
                              );
                            })}
                          </View>
                        </View>
                      ))
                    )}
                  </View>
                </View>
              )}

              {/* TAB 3: UNLOCK RULES */}
              {activeTab === 'unlock' && (
                <View style={styles.tabSection}>
                  <Text style={styles.fieldLabel}>How Does This Milestone Unlock?</Text>
                  <Text style={styles.fieldHelper}>
                    Choose the requirement students must meet before this milestone unlocks on their roadmap track:
                  </Text>

                  <View style={styles.unlockOptionsGrid}>
                    <Pressable
                      onPress={() => setFormUnlockType('score')}
                      style={[
                        styles.unlockOptionCard,
                        formUnlockType === 'score' && styles.unlockOptionCardActive,
                      ]}
                    >
                      <Feather name="award" size={20} color={formUnlockType === 'score' ? '#0d9488' : '#64748b'} />
                      <Text style={styles.unlockOptionTitle}>Passing Score (Standard)</Text>
                      <Text style={styles.unlockOptionDesc}>Unlocks when previous session score reaches threshold (evaluating curriculum objectives, speech share ≥ 40%, and grammar).</Text>
                    </Pressable>

                    <Pressable
                      onPress={() => setFormUnlockType('time')}
                      style={[
                        styles.unlockOptionCard,
                        formUnlockType === 'time' && styles.unlockOptionCardActive,
                      ]}
                    >
                      <Feather name="clock" size={20} color={formUnlockType === 'time' ? '#0d9488' : '#64748b'} />
                      <Text style={styles.unlockOptionTitle}>Minimum Speaking Time</Text>
                      <Text style={styles.unlockOptionDesc}>Student must accumulate at least N minutes of total speaking time on previous level.</Text>
                    </Pressable>

                    <Pressable
                      onPress={() => setFormUnlockType('completion')}
                      style={[
                        styles.unlockOptionCard,
                        formUnlockType === 'completion' && styles.unlockOptionCardActive,
                      ]}
                    >
                      <Feather name="check-circle" size={20} color={formUnlockType === 'completion' ? '#0d9488' : '#64748b'} />
                      <Text style={styles.unlockOptionTitle}>Any Completion</Text>
                      <Text style={styles.unlockOptionDesc}>Unlocks as soon as previous level call finishes and all mandatory objectives are covered.</Text>
                    </Pressable>

                    <Pressable
                      onPress={() => setFormUnlockType('free')}
                      style={[
                        styles.unlockOptionCard,
                        formUnlockType === 'free' && styles.unlockOptionCardActive,
                      ]}
                    >
                      <Feather name="unlock" size={20} color={formUnlockType === 'free' ? '#0d9488' : '#64748b'} />
                      <Text style={styles.unlockOptionTitle}>Always Free</Text>
                      <Text style={styles.unlockOptionDesc}>Unlocked immediately for all students without prerequisites (e.g. Level 01).</Text>
                    </Pressable>
                  </View>

                  {formUnlockType === 'score' && (
                    <View style={styles.ruleDetailBox}>
                      <Text style={styles.ruleDetailTitle}>Minimum Overall Passing Score: {formMinScore}%</Text>
                      <View style={styles.scoreRow}>
                        {[60, 65, 70, 75, 80, 85].map((sc) => (
                          <Pressable
                            key={sc}
                            onPress={() => setFormMinScore(sc)}
                            style={[
                              styles.scorePill,
                              formMinScore === sc && styles.scorePillActive,
                            ]}
                          >
                            <Text
                              style={[
                                styles.scorePillText,
                                formMinScore === sc && styles.scorePillTextActive,
                              ]}
                            >
                              ≥ {sc}%
                            </Text>
                          </Pressable>
                        ))}
                      </View>
                    </View>
                  )}

                  {formUnlockType === 'time' && (
                    <View style={styles.ruleDetailBox}>
                      <Text style={styles.ruleDetailTitle}>
                        Minimum Required Speaking Time: {Math.round(formMinSeconds / 60)} minutes
                      </Text>
                      <View style={styles.scoreRow}>
                        {[120, 180, 240, 300, 600].map((sec) => (
                          <Pressable
                            key={sec}
                            onPress={() => setFormMinSeconds(sec)}
                            style={[
                              styles.scorePill,
                              formMinSeconds === sec && styles.scorePillActive,
                            ]}
                          >
                            <Text
                              style={[
                                styles.scorePillText,
                                formMinSeconds === sec && styles.scorePillTextActive,
                              ]}
                            >
                              {sec / 60}m
                            </Text>
                          </Pressable>
                        ))}
                      </View>
                    </View>
                  )}

                  <View style={styles.publishToggleRow}>
                    <View>
                      <Text style={styles.fieldLabel}>Publish Level Live to Students</Text>
                      <Text style={styles.fieldHelper}>Draft levels remain hidden on the student roadmap track.</Text>
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
              )}
            </ScrollView>

            {/* Modal Footer */}
            <View style={styles.modalFooter}>
              <Pressable
                onPress={openPlaygroundWithDraft}
                style={styles.modalTestBtn}
              >
                <Feather name="play-circle" size={15} color="#7c3aed" style={{ marginRight: 6 }} />
                <Text style={styles.modalTestText}>Test in Playground</Text>
              </Pressable>

              <View style={{ flex: 1 }} />

              <Pressable
                onPress={() => setIsEditorOpen(false)}
                style={styles.modalCancelBtn}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </Pressable>

              <Pressable
                disabled={isSaving}
                onPress={handleSaveLevel}
                style={styles.modalSaveBtn}
              >
                {isSaving ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <>
                    <Feather name="check" size={16} color="#ffffff" style={{ marginRight: 6 }} />
                    <Text style={styles.modalSaveText}>
                      {editingLevel ? 'Save Changes' : 'Create Level'}
                    </Text>
                  </>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* ============================================================ */}
      {/* 4. ADMIN LEVEL PLAYGROUND MODAL                             */}
      {/* ============================================================ */}
      <Modal
        visible={isPlaygroundOpen}
        animationType="fade"
        transparent
        onRequestClose={() => setIsPlaygroundOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.playgroundModalCard, isPhone && styles.modalCardMobile]}>
            {/* Header */}
            <View style={styles.playgroundHeader}>
              <View style={styles.modalHeaderTitleRow}>
                <View style={[styles.modalBadge, { backgroundColor: '#7c3aed' }]}>
                  <Feather name="play-circle" size={16} color="#ffffff" />
                </View>
                <View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <Text style={styles.modalTitle}>
                      Level Playground: {playgroundLevel?.title || 'Level'}
                    </Text>
                    <View style={styles.playgroundActivePill}>
                      <View style={styles.pulseDot} />
                      <Text style={styles.playgroundActiveText}>Gemini Live Simulator</Text>
                    </View>
                  </View>
                  <Text style={styles.modalSubtitle}>
                    Interactive coach prompt tester, brevity guardrail (≤ 15 words/turn), and grammar feedback simulator.
                  </Text>
                </View>
              </View>

              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                {playgroundLevel && (
                  <Pressable
                    onPress={() => handleLaunchVoiceTest(playgroundLevel)}
                    style={styles.liveVoiceBtn}
                  >
                    <Feather name="mic" size={14} color="#ffffff" style={{ marginRight: 6 }} />
                    <Text style={styles.liveVoiceBtnText}>Live Voice Call</Text>
                  </Pressable>
                )}
                <Pressable
                  onPress={() => setIsPlaygroundOpen(false)}
                  style={styles.modalCloseBtn}
                >
                  <Feather name="x" size={20} color="#64748b" />
                </Pressable>
              </View>
            </View>

            {/* Prompt Config Snapshot Bar */}
            <View style={styles.playgroundInfoBar}>
              <View style={styles.infoBarItem}>
                <Text style={styles.infoBarLabel}>ROLE</Text>
                <Text style={styles.infoBarValue} numberOfLines={1}>
                  {playgroundLevel?.guidedPrompt?.scenarioRole || 'Friendly English Coach'}
                </Text>
              </View>
              <View style={styles.infoBarDivider} />
              <View style={styles.infoBarItem}>
                <Text style={styles.infoBarLabel}>COACHING FOCUS</Text>
                <Text style={styles.infoBarValue} numberOfLines={1}>
                  {playgroundLevel?.guidedPrompt?.coachingFocus || 'Natural phrasing & fluency'}
                </Text>
              </View>
              <View style={styles.infoBarDivider} />
              <View style={styles.infoBarItem}>
                <Text style={styles.infoBarLabel}>BREVITY RULE</Text>
                <View style={styles.guardrailPill}>
                  <Feather name="shield" size={12} color="#059669" style={{ marginRight: 4 }} />
                  <Text style={styles.guardrailPillText}>≤ 15 words / turn</Text>
                </View>
              </View>
            </View>

            {/* Simulation Chat Log */}
            <ScrollView
              style={styles.playgroundChatArea}
              contentContainerStyle={{ padding: 18, paddingBottom: 24 }}
            >
              {simMessages.map((msg) => {
                const isMaya = msg.sender === 'maya';
                const words = msg.wordCount ?? msg.text.trim().split(/\s+/).filter(Boolean).length;
                return (
                  <View
                    key={msg.id}
                    style={[
                      styles.simMsgWrapper,
                      isMaya ? styles.simMsgMayaAlign : styles.simMsgUserAlign,
                    ]}
                  >
                    {isMaya && (
                      <View style={styles.simAvatar}>
                        <Text style={styles.simAvatarText}>M</Text>
                      </View>
                    )}

                    <View style={{ maxWidth: '82%' }}>
                      <View
                        style={[
                          styles.simBubble,
                          isMaya ? styles.simBubbleMaya : styles.simBubbleUser,
                        ]}
                      >
                        <Text
                          style={[
                            styles.simBubbleText,
                            isMaya ? styles.simBubbleTextMaya : styles.simBubbleTextUser,
                          ]}
                        >
                          {msg.text}
                        </Text>
                      </View>

                      {/* Maya turn metadata: word count & brevity check */}
                      {isMaya && (
                        <View style={styles.simMetaRow}>
                          <View
                            style={[
                              styles.simWordCountPill,
                              words <= 15
                                ? styles.wordCountCompliant
                                : styles.wordCountWarning,
                            ]}
                          >
                            <Feather
                              name={words <= 15 ? 'check-circle' : 'alert-circle'}
                              size={11}
                              color={words <= 15 ? '#059669' : '#d97706'}
                              style={{ marginRight: 4 }}
                            />
                            <Text
                              style={[
                                styles.simWordCountText,
                                {
                                  color: words <= 15 ? '#059669' : '#d97706',
                                },
                              ]}
                            >
                              {words} words {words <= 15 ? '• Compliant (< 15w)' : '• Long (> 15w)'}
                            </Text>
                          </View>
                        </View>
                      )}

                      {/* AI Coaching Correction Card */}
                      {isMaya && msg.correction && (
                        <View style={styles.simCorrectionCard}>
                          <View style={styles.correctionHeader}>
                            <Feather name="zap" size={13} color="#7c3aed" style={{ marginRight: 5 }} />
                            <Text style={styles.correctionTitle}>AI Coaching Correction Triggered</Text>
                          </View>
                          <View style={styles.correctionRow}>
                            <Text style={styles.correctionLabelError}>Student Error:</Text>
                            <Text style={styles.correctionTextError}>"{msg.correction.original}"</Text>
                          </View>
                          <View style={styles.correctionRow}>
                            <Text style={styles.correctionLabelGood}>Natural Form:</Text>
                            <Text style={styles.correctionTextGood}>"{msg.correction.corrected}"</Text>
                          </View>
                          {msg.correction.explanation ? (
                            <View style={styles.correctionNoteRow}>
                              <Feather name="info" size={12} color="#64748b" style={{ marginRight: 4, marginTop: 2 }} />
                              <Text style={styles.correctionNoteText}>
                                {msg.correction.explanation}
                              </Text>
                            </View>
                          ) : null}
                        </View>
                      )}
                    </View>
                  </View>
                );
              })}

              {isSimulating && (
                <View style={[styles.simMsgWrapper, styles.simMsgMayaAlign]}>
                  <View style={styles.simAvatar}>
                    <Text style={styles.simAvatarText}>M</Text>
                  </View>
                  <View style={[styles.simBubble, styles.simBubbleMaya, styles.simTypingBubble]}>
                    <ActivityIndicator size="small" color="#7c3aed" style={{ marginRight: 8 }} />
                    <Text style={styles.simTypingText}>Maya is formulating concise response...</Text>
                  </View>
                </View>
              )}
            </ScrollView>

            {/* Quick Test Personas */}
            <View style={styles.quickChipsSection}>
              <Text style={styles.quickChipsTitle}>TEST STUDENT PERSONAS:</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.quickChipsContainer}
              >
                {QUICK_TEST_PROMPTS.map((sample, idx) => (
                  <Pressable
                    key={idx}
                    disabled={isSimulating}
                    onPress={() => handleSendSimulation(sample.prompt)}
                    style={styles.quickChip}
                  >
                    <Text style={styles.quickChipText}>{sample.label}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>

            {/* Simulation Input Footer */}
            <View style={styles.playgroundFooter}>
              <Pressable
                onPress={handleResetPlayground}
                style={styles.simResetBtn}
              >
                <Feather name="refresh-cw" size={16} color="#64748b" />
              </Pressable>

              <TextInput
                style={styles.simInput}
                value={simInput}
                onChangeText={setSimInput}
                placeholder="Type a student reply to test Maya's reaction..."
                placeholderTextColor="#94a3b8"
                onSubmitEditing={() => handleSendSimulation()}
                returnKeyType="send"
                editable={!isSimulating}
              />

              <Pressable
                disabled={isSimulating || !simInput.trim()}
                onPress={() => handleSendSimulation()}
                style={[
                  styles.simSendBtn,
                  (!simInput.trim() || isSimulating) && styles.simSendBtnDisabled,
                ]}
              >
                {isSimulating ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <Feather name="send" size={16} color="#ffffff" />
                )}
              </Pressable>
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
    backgroundColor: '#0f172a',
  },
  container: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: '#f8fafc',
  },

  /* Sidebar */
  sidebar: {
    width: 240,
    backgroundColor: '#ffffff',
    borderRightWidth: 1,
    borderRightColor: '#e2e8f0',
    flexDirection: 'column',
  },
  sidebarMobile: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    zIndex: 100,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 10,
  },
  sidebarLogoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 18,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  logoBadge: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#0d9488',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  logoTextCol: {
    flex: 1,
  },
  brandTitle: {
    ...fontStyle('inter', 'bold'),
    fontSize: 15,
    color: '#0f172a',
  },
  brandSubtitle: {
    ...fontStyle('inter', 'regular'),
    fontSize: 11,
    color: '#64748b',
  },
  closeSidebarBtn: {
    padding: 4,
  },
  sidebarNavScroll: {
    flex: 1,
    paddingTop: 12,
  },
  navGroup: {
    marginBottom: 20,
    paddingHorizontal: 12,
  },
  navGroupTitle: {
    ...fontStyle('inter', 'semiBold'),
    fontSize: 10,
    color: '#94a3b8',
    letterSpacing: 0.8,
    marginBottom: 8,
    paddingHorizontal: 8,
  },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 6,
    marginBottom: 2,
  },
  navItemActive: {
    backgroundColor: '#f0fdfa',
  },
  navItemIcon: {
    marginRight: 10,
  },
  navItemText: {
    ...fontStyle('inter', 'medium'),
    fontSize: 13,
    color: '#475569',
  },
  navItemTextActive: {
    color: '#0d9488',
    ...fontStyle('inter', 'semiBold'),
  },
  sidebarFooter: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  userProfileRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  userAvatarCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#e0f2fe',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  userAvatarText: {
    ...fontStyle('inter', 'bold'),
    fontSize: 11,
    color: '#0284c7',
  },
  userProfileTextCol: {
    flex: 1,
  },
  userName: {
    ...fontStyle('inter', 'semiBold'),
    fontSize: 12.5,
    color: '#0f172a',
  },
  userEmail: {
    ...fontStyle('inter', 'regular'),
    fontSize: 11,
    color: '#64748b',
  },

  /* Main Content */
  mainContent: {
    flex: 1,
    flexDirection: 'column',
    backgroundColor: '#f8fafc',
  },
  topHeaderBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingVertical: 18,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  topHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sidebarToggleBtn: {
    padding: 6,
    marginRight: 12,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerTitle: {
    ...fontStyle('inter', 'bold'),
    fontSize: 19,
    color: '#0f172a',
  },
  activePill: {
    backgroundColor: '#ecfdf5',
    borderWidth: 1,
    borderColor: '#a7f3d0',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  activePillText: {
    ...fontStyle('inter', 'medium'),
    fontSize: 11,
    color: '#059669',
  },
  headerSubtitle: {
    ...fontStyle('inter', 'regular'),
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  topHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  newLevelBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0d9488',
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 8,
  },
  newLevelBtnText: {
    ...fontStyle('inter', 'semiBold'),
    fontSize: 13,
    color: '#ffffff',
  },

  /* Metrics */
  metricsRow: {
    flexDirection: 'row',
    paddingHorizontal: 24,
    paddingVertical: 16,
    gap: 14,
    flexWrap: 'wrap',
  },
  metricCard: {
    flex: 1,
    minWidth: 150,
    backgroundColor: '#ffffff',
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  metricLabel: {
    ...fontStyle('inter', 'medium'),
    fontSize: 12,
    color: '#64748b',
  },
  metricVal: {
    ...fontStyle('inter', 'bold'),
    fontSize: 22,
    color: '#0f172a',
    marginTop: 4,
  },
  metricSub: {
    ...fontStyle('inter', 'regular'),
    fontSize: 11,
    color: '#94a3b8',
    marginTop: 2,
  },

  /* Levels Scroll */
  levelsScroll: {
    flex: 1,
    paddingHorizontal: 24,
    paddingBottom: 24,
  },
  loadingContainer: {
    paddingVertical: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    ...fontStyle('inter', 'medium'),
    fontSize: 13,
    color: '#64748b',
    marginTop: 12,
  },
  errorContainer: {
    padding: 24,
    backgroundColor: '#fef2f2',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#fecaca',
    alignItems: 'center',
    marginTop: 20,
  },
  errorText: {
    ...fontStyle('inter', 'medium'),
    fontSize: 13,
    color: '#b91c1c',
    marginTop: 8,
    textAlign: 'center',
  },
  retryBtn: {
    marginTop: 12,
    backgroundColor: '#dc2626',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  retryBtnText: {
    ...fontStyle('inter', 'medium'),
    fontSize: 12,
    color: '#ffffff',
  },
  emptyContainer: {
    paddingVertical: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    ...fontStyle('inter', 'bold'),
    fontSize: 16,
    color: '#334155',
    marginTop: 12,
  },
  emptySubtitle: {
    ...fontStyle('inter', 'regular'),
    fontSize: 13,
    color: '#64748b',
    marginTop: 4,
    textAlign: 'center',
  },
  emptyAddBtn: {
    marginTop: 16,
    backgroundColor: '#0d9488',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  emptyAddBtnText: {
    ...fontStyle('inter', 'medium'),
    fontSize: 13,
    color: '#ffffff',
  },

  /* Level Card */
  levelCardsList: {
    gap: 12,
    paddingBottom: 30,
  },
  levelCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  levelCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 16,
  },
  reorderCol: {
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  reorderBtn: {
    padding: 4,
  },
  haloPreview: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  numberBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#ffffff',
  },
  numberBadgeText: {
    ...fontStyle('inter', 'bold'),
    fontSize: 9,
    color: '#ffffff',
  },
  levelCardCenter: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  levelTitle: {
    ...fontStyle('inter', 'bold'),
    fontSize: 15,
    color: '#0f172a',
  },
  timeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f9ff',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: '#bae6fd',
  },
  timeBadgeText: {
    ...fontStyle('inter', 'medium'),
    fontSize: 11,
    color: '#0369a1',
  },
  xpBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fffbeb',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: '#fde68a',
  },
  xpBadgeText: {
    ...fontStyle('inter', 'bold'),
    fontSize: 11,
    color: '#b45309',
  },
  statusBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 5,
    borderWidth: 1,
  },
  statusBadgePub: {
    backgroundColor: '#f0fdf4',
    borderColor: '#bbf7d0',
  },
  statusBadgeDraft: {
    backgroundColor: '#f1f5f9',
    borderColor: '#cbd5e1',
  },
  statusBadgeText: {
    ...fontStyle('inter', 'medium'),
    fontSize: 11,
  },
  statusBadgeTextPub: {
    color: '#15803d',
  },
  statusBadgeTextDraft: {
    color: '#64748b',
  },
  levelDesc: {
    ...fontStyle('inter', 'regular'),
    fontSize: 12.5,
    color: '#64748b',
    marginTop: 4,
  },
  guidedSnippetsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 6,
  },
  snippetItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 5,
    maxWidth: '48%',
  },
  snippetLabel: {
    ...fontStyle('inter', 'semiBold'),
    fontSize: 11,
    color: '#475569',
    marginRight: 4,
  },
  snippetValue: {
    ...fontStyle('inter', 'regular'),
    fontSize: 11,
    color: '#64748b',
    flexShrink: 1,
  },
  unlockRuleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
  },
  unlockRuleText: {
    ...fontStyle('inter', 'medium'),
    fontSize: 11.5,
    color: '#475569',
  },
  levelCardRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginLeft: 16,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 6,
    borderWidth: 1,
  },
  btnPublish: {
    backgroundColor: '#f0fdfa',
    borderColor: '#ccfbf1',
  },
  btnUnpublish: {
    backgroundColor: '#f8fafc',
    borderColor: '#e2e8f0',
  },
  btnEdit: {
    backgroundColor: '#f0f9ff',
    borderColor: '#bae6fd',
  },
  btnPlayground: {
    backgroundColor: '#faf5ff',
    borderColor: '#e9d5ff',
  },
  btnDelete: {
    backgroundColor: '#fef2f2',
    borderColor: '#fecaca',
    paddingHorizontal: 8,
  },
  actionBtnText: {
    ...fontStyle('inter', 'medium'),
    fontSize: 12,
    marginLeft: 4,
  },

  /* Modal */
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalCard: {
    width: '100%',
    maxWidth: 820,
    maxHeight: '92%',
    backgroundColor: '#ffffff',
    borderRadius: 16,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 15,
    elevation: 12,
    flexDirection: 'column',
    overflow: 'hidden',
  },
  modalCardMobile: {
    maxHeight: '96%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingVertical: 18,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  modalHeaderTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  modalBadge: {
    backgroundColor: '#0d9488',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 6,
    marginRight: 12,
  },
  modalBadgeText: {
    ...fontStyle('inter', 'bold'),
    fontSize: 13,
    color: '#ffffff',
  },
  modalTitle: {
    ...fontStyle('inter', 'bold'),
    fontSize: 16,
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
    borderRadius: 8,
  },
  modalTabsRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    backgroundColor: '#f8fafc',
  },
  tabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 13,
    paddingHorizontal: 12,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabBtnActive: {
    backgroundColor: '#ffffff',
    borderBottomColor: '#0d9488',
  },
  tabBtnText: {
    ...fontStyle('inter', 'medium'),
    fontSize: 13,
    color: '#64748b',
  },
  tabBtnTextActive: {
    color: '#0d9488',
    ...fontStyle('inter', 'semiBold'),
  },
  modalBodyScroll: {
    flex: 1,
    padding: 22,
  },
  tabSection: {
    gap: 16,
  },
  formGroup: {
    gap: 5,
  },
  twoColRow: {
    flexDirection: 'row',
    gap: 14,
  },
  formCol: {
    flex: 1,
    gap: 5,
  },
  fieldLabel: {
    ...fontStyle('inter', 'semiBold'),
    fontSize: 12.5,
    color: '#334155',
  },
  fieldHelper: {
    ...fontStyle('inter', 'regular'),
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
  },
  textInput: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 13,
    color: '#0f172a',
    ...Platform.select({ web: { outlineStyle: 'none' } as any }),
  },
  textArea: {
    minHeight: 64,
    textAlignVertical: 'top',
  },
  durationBtnRow: {
    flexDirection: 'row',
    gap: 6,
  },
  durPill: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
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
    ...fontStyle('inter', 'medium'),
    fontSize: 12,
    color: '#475569',
  },
  durPillTextActive: {
    color: '#ffffff',
  },
  xpPillActive: {
    backgroundColor: '#d97706',
    borderColor: '#d97706',
  },
  xpPillTextActive: {
    color: '#ffffff',
    ...fontStyle('inter', 'bold'),
  },
  iconPickerRow: {
    flexDirection: 'row',
    gap: 6,
  },
  iconChoiceBtn: {
    padding: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    backgroundColor: '#ffffff',
  },
  iconChoiceBtnActive: {
    borderColor: '#0d9488',
    backgroundColor: '#f0fdfa',
  },
  colorPaletteRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  colorDotBtn: {
    width: 26,
    height: 26,
    borderRadius: 13,
  },
  colorDotBtnSelected: {
    borderWidth: 3,
    borderColor: '#0f172a',
  },
  labelWithColorInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  colorNameLabel: {
    ...fontStyle('inter', 'bold'),
    fontSize: 11,
  },
  iconConfigCard: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    padding: 14,
    gap: 12,
  },
  iconSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 8,
  },
  iconModeToggle: {
    flexDirection: 'row',
    backgroundColor: '#f1f5f9',
    borderRadius: 8,
    padding: 3,
  },
  iconModeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  iconModeBtnActive: {
    backgroundColor: '#ffffff',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  iconModeBtnText: {
    ...fontStyle('inter', 'medium'),
    fontSize: 11.5,
    color: '#64748b',
  },
  iconModeBtnTextActive: {
    color: '#0d9488',
    ...fontStyle('inter', 'semiBold'),
  },
  customSvgContainer: {
    gap: 12,
  },
  customSvgPreviewBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: 14,
  },
  svgPreviewHalo: {
    width: 58,
    height: 58,
    borderRadius: 29,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  svgPreviewCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 2,
  },
  previewNumberBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#ffffff',
  },
  previewNumberBadgeText: {
    ...fontStyle('inter', 'bold'),
    fontSize: 8.5,
    color: '#ffffff',
  },
  customSvgPreviewInfo: {
    flex: 1,
    gap: 3,
  },
  liveBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  liveColorLabel: {
    ...fontStyle('inter', 'medium'),
    fontSize: 12,
    color: '#334155',
  },
  customSvgHelpText: {
    ...fontStyle('inter', 'regular'),
    fontSize: 11,
    color: '#64748b',
    lineHeight: 15,
  },
  sampleSvgRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  sampleSvgLabel: {
    ...fontStyle('inter', 'medium'),
    fontSize: 11.5,
    color: '#64748b',
    marginRight: 2,
  },
  sampleSvgChip: {
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  sampleSvgChipText: {
    ...fontStyle('inter', 'medium'),
    fontSize: 11,
    color: '#334155',
  },
  clearSvgBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  clearSvgBtnText: {
    ...fontStyle('inter', 'medium'),
    fontSize: 11,
    color: '#ef4444',
  },
  svgCodeInput: {
    fontFamily: Platform.select({ web: 'monospace', default: 'Courier' }),
    fontSize: 11.5,
    minHeight: 80,
    textAlignVertical: 'top',
    backgroundColor: '#fafafa',
  },

  /* Prompt Builder */
  presetsCard: {
    backgroundColor: '#fffbeb',
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: '#fde68a',
  },
  presetsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  presetsTitle: {
    ...fontStyle('inter', 'bold'),
    fontSize: 13,
    color: '#92400e',
  },
  presetsDesc: {
    ...fontStyle('inter', 'regular'),
    fontSize: 11.5,
    color: '#b45309',
    marginTop: 2,
    marginBottom: 8,
  },
  presetsScroll: {
    flexDirection: 'row',
  },
  presetChip: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#fcd34d',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 16,
    marginRight: 8,
  },
  presetChipText: {
    ...fontStyle('inter', 'medium'),
    fontSize: 11.5,
    color: '#78350f',
  },
  promptCard: {
    backgroundColor: '#f8fafc',
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: 6,
  },
  promptCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  hintBadge: {
    backgroundColor: '#eff6ff',
    paddingHorizontal: 10,
    paddingVertical: 3.5,
    borderRadius: 6,
    flexShrink: 0,
  },
  hintBadgeText: {
    ...fontStyle('inter', 'semiBold'),
    fontSize: 11.5,
    color: '#2563eb',
  },
  hintBadgeSuccess: {
    backgroundColor: '#ecfdf5',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  hintBadgeSuccessText: {
    ...fontStyle('inter', 'medium'),
    fontSize: 10,
    color: '#16a34a',
  },
  healthCheckBox: {
    backgroundColor: '#f0fdf4',
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: '#bbf7d0',
    gap: 6,
  },
  healthCheckTitle: {
    ...fontStyle('inter', 'bold'),
    fontSize: 12.5,
    color: '#166534',
    marginBottom: 2,
  },
  checkItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  checkText: {
    ...fontStyle('inter', 'regular'),
    fontSize: 11.5,
    color: '#15803d',
  },

  /* Unlock Tab */
  unlockOptionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 8,
  },
  unlockOptionCard: {
    width: '48%',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    padding: 12,
    gap: 4,
  },
  unlockOptionCardActive: {
    borderColor: '#0d9488',
    backgroundColor: '#f0fdfa',
  },
  unlockOptionTitle: {
    ...fontStyle('inter', 'semiBold'),
    fontSize: 13,
    color: '#0f172a',
    marginTop: 4,
  },
  unlockOptionDesc: {
    ...fontStyle('inter', 'regular'),
    fontSize: 11,
    color: '#64748b',
  },
  ruleDetailBox: {
    backgroundColor: '#f8fafc',
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginTop: 10,
  },
  ruleDetailTitle: {
    ...fontStyle('inter', 'semiBold'),
    fontSize: 12.5,
    color: '#334155',
    marginBottom: 8,
  },
  scoreRow: {
    flexDirection: 'row',
    gap: 8,
  },
  scorePill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    backgroundColor: '#ffffff',
  },
  scorePillActive: {
    backgroundColor: '#0d9488',
    borderColor: '#0d9488',
  },
  scorePillText: {
    ...fontStyle('inter', 'medium'),
    fontSize: 12,
    color: '#475569',
  },
  scorePillTextActive: {
    color: '#ffffff',
  },
  turnBudgetPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    backgroundColor: '#ffffff',
  },
  turnBudgetPillActive: {
    backgroundColor: '#0d9488',
    borderColor: '#0d9488',
  },
  turnBudgetPillText: {
    ...fontStyle('inter', 'medium'),
    fontSize: 11,
    color: '#475569',
  },
  turnBudgetPillTextActive: {
    color: '#ffffff',
    ...fontStyle('inter', 'bold'),
  },
  publishToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    marginTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
  },
  toggleSwitch: {
    width: 44,
    height: 24,
    borderRadius: 12,
    padding: 2,
    justifyContent: 'center',
  },
  toggleSwitchOn: {
    backgroundColor: '#0d9488',
  },
  toggleSwitchOff: {
    backgroundColor: '#cbd5e1',
  },
  toggleDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#ffffff',
  },
  toggleDotOn: {
    alignSelf: 'flex-end',
  },
  toggleDotOff: {
    alignSelf: 'flex-start',
  },

  /* Modal Footer */
  modalFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 10,
    paddingHorizontal: 22,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    backgroundColor: '#f8fafc',
  },
  modalCancelBtn: {
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    backgroundColor: '#ffffff',
  },
  modalCancelText: {
    ...fontStyle('inter', 'medium'),
    fontSize: 13,
    color: '#475569',
  },
  modalSaveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0d9488',
    paddingHorizontal: 18,
    paddingVertical: 9,
    borderRadius: 8,
  },
  modalSaveText: {
    ...fontStyle('inter', 'semiBold'),
    fontSize: 13,
    color: '#ffffff',
  },
  modalTestBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd6fe',
    backgroundColor: '#f5f3ff',
  },
  modalTestText: {
    ...fontStyle('inter', 'semiBold'),
    fontSize: 13,
    color: '#7c3aed',
  },

  /* Playground Modal Styles */
  playgroundModalCard: {
    width: '100%',
    maxWidth: 840,
    height: '88%',
    maxHeight: 820,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 24,
    elevation: 20,
    flexDirection: 'column',
  },
  playgroundHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    backgroundColor: '#ffffff',
  },
  playgroundActivePill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    backgroundColor: '#f5f3ff',
    borderWidth: 1,
    borderColor: '#ddd6fe',
  },
  pulseDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#7c3aed',
    marginRight: 5,
  },
  playgroundActiveText: {
    ...fontStyle('inter', 'semiBold'),
    fontSize: 11,
    color: '#7c3aed',
  },
  liveVoiceBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#7c3aed',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    shadowColor: '#7c3aed',
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 4,
  },
  liveVoiceBtnText: {
    ...fontStyle('inter', 'semiBold'),
    fontSize: 12.5,
    color: '#ffffff',
  },

  /* Playground Info Bar */
  playgroundInfoBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  infoBarItem: {
    flex: 1,
    flexDirection: 'column',
  },
  infoBarLabel: {
    ...fontStyle('inter', 'semiBold'),
    fontSize: 10,
    color: '#94a3b8',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  infoBarValue: {
    ...fontStyle('inter', 'medium'),
    fontSize: 12,
    color: '#334155',
  },
  infoBarDivider: {
    width: 1,
    height: 24,
    backgroundColor: '#e2e8f0',
    marginHorizontal: 14,
  },
  guardrailPill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: '#ecfdf5',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#a7f3d0',
  },
  guardrailPillText: {
    ...fontStyle('inter', 'semiBold'),
    fontSize: 11,
    color: '#059669',
  },

  /* Playground Chat Area */
  playgroundChatArea: {
    flex: 1,
    backgroundColor: '#fcfcfd',
  },
  simMsgWrapper: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  simMsgMayaAlign: {
    alignItems: 'flex-start',
  },
  simMsgUserAlign: {
    justifyContent: 'flex-end',
  },
  simAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#7c3aed',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
    marginTop: 2,
  },
  simAvatarText: {
    ...fontStyle('outfit', 'bold'),
    fontSize: 14,
    color: '#ffffff',
  },
  simBubble: {
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  simBubbleMaya: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  simBubbleUser: {
    backgroundColor: '#0f172a',
  },
  simBubbleText: {
    ...fontStyle('inter', 'regular'),
    fontSize: 13.5,
    lineHeight: 20,
  },
  simBubbleTextMaya: {
    color: '#1e293b',
  },
  simBubbleTextUser: {
    color: '#ffffff',
  },
  simMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 5,
    paddingLeft: 4,
  },
  simWordCountPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
  },
  wordCountCompliant: {
    backgroundColor: '#ecfdf5',
    borderColor: '#a7f3d0',
  },
  wordCountWarning: {
    backgroundColor: '#fffbeb',
    borderColor: '#fde68a',
  },
  simWordCountText: {
    ...fontStyle('inter', 'medium'),
    fontSize: 10.5,
  },
  simCorrectionCard: {
    backgroundColor: '#faf5ff',
    borderWidth: 1,
    borderColor: '#e9d5ff',
    borderRadius: 10,
    padding: 12,
    marginTop: 8,
    gap: 4,
  },
  correctionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  correctionTitle: {
    ...fontStyle('inter', 'semiBold'),
    fontSize: 11.5,
    color: '#7c3aed',
  },
  correctionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 4,
  },
  correctionLabelError: {
    ...fontStyle('inter', 'semiBold'),
    fontSize: 11,
    color: '#ef4444',
  },
  correctionTextError: {
    ...fontStyle('inter', 'regular'),
    fontSize: 11.5,
    color: '#b91c1c',
    textDecorationLine: 'line-through',
  },
  correctionLabelGood: {
    ...fontStyle('inter', 'semiBold'),
    fontSize: 11,
    color: '#16a34a',
  },
  correctionTextGood: {
    ...fontStyle('inter', 'semiBold'),
    fontSize: 11.5,
    color: '#15803d',
  },
  correctionNoteRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: 2,
  },
  correctionNoteText: {
    ...fontStyle('inter', 'regular'),
    fontSize: 11,
    color: '#64748b',
    flex: 1,
  },
  simTypingBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
  },
  simTypingText: {
    ...fontStyle('inter', 'medium'),
    fontSize: 12.5,
    color: '#7c3aed',
  },

  /* Quick Chips Section */
  quickChipsSection: {
    backgroundColor: '#f8fafc',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  quickChipsTitle: {
    ...fontStyle('inter', 'semiBold'),
    fontSize: 10,
    color: '#94a3b8',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  quickChipsContainer: {
    gap: 8,
  },
  quickChip: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  quickChipText: {
    ...fontStyle('inter', 'medium'),
    fontSize: 11.5,
    color: '#334155',
  },

  /* Playground Footer */
  playgroundFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    backgroundColor: '#ffffff',
    gap: 10,
  },
  simResetBtn: {
    width: 38,
    height: 38,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f8fafc',
  },
  simInput: {
    flex: 1,
    height: 40,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    backgroundColor: '#ffffff',
    paddingHorizontal: 12,
    ...fontStyle('inter', 'regular'),
    fontSize: 13,
    color: '#0f172a',
  },
  simSendBtn: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: '#7c3aed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  simSendBtnDisabled: {
    backgroundColor: '#cbd5e1',
  },
  objectivesBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ecfdf5',
    borderColor: '#a7f3d0',
    borderWidth: 1,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 12,
  },
  objectivesBadgeText: {
    ...fontStyle('inter', 'semiBold'),
    fontSize: 11,
    color: '#059669',
  },
  objectivesSectionCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 16,
    marginBottom: 16,
  },
  objectivesSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  addObjectiveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0fdfa',
    borderColor: '#99f6e4',
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
  },
  addObjectiveBtnText: {
    ...fontStyle('inter', 'semiBold'),
    fontSize: 12.5,
    color: '#0d9488',
  },
  emptyObjectivesBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 24,
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#cbd5e1',
  },
  emptyObjectivesTitle: {
    ...fontStyle('inter', 'semiBold'),
    fontSize: 13,
    color: '#475569',
  },
  emptyObjectivesDesc: {
    ...fontStyle('inter', 'regular'),
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 2,
  },
  objectiveEditorCard: {
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 12,
    marginBottom: 10,
  },
  objectiveCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  objectiveNumBadge: {
    backgroundColor: '#e2e8f0',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  objectiveNumText: {
    ...fontStyle('inter', 'bold'),
    fontSize: 11,
    color: '#475569',
  },
  mandatoryToggle: {
    backgroundColor: '#f1f5f9',
    borderColor: '#cbd5e1',
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 6,
  },
  mandatoryToggleActive: {
    backgroundColor: '#ecfdf5',
    borderColor: '#a7f3d0',
  },
  mandatoryToggleText: {
    ...fontStyle('inter', 'medium'),
    fontSize: 11,
    color: '#64748b',
  },
  mandatoryToggleTextActive: {
    ...fontStyle('inter', 'semiBold'),
    color: '#059669',
  },
  deleteObjectiveBtn: {
    marginLeft: 8,
    padding: 6,
  },
  quickFillObjectivesBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fffbeb',
    borderColor: '#fde68a',
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
  },
  quickFillObjectivesBtnText: {
    ...fontStyle('inter', 'semiBold'),
    fontSize: 12.5,
    color: '#b45309',
  },
  emptyActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 12,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  scenarioCard: {
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 14,
    gap: 8,
    marginTop: 6,
  },
  scenarioHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 8,
  },
  subFieldLabel: {
    ...fontStyle('inter', 'semiBold'),
    fontSize: 12.5,
    color: '#334155',
    marginBottom: 4,
  },
  presetsBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 4,
    gap: 8,
  },
  presetsLabel: {
    ...fontStyle('inter', 'bold'),
    fontSize: 11,
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
});
