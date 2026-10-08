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

import {
  parseCanonicalLessonContent,
  formatCanonicalLessonContent,
  DEFAULT_CANONICAL_TEMPLATE,
} from '@/utils/roadmap-canonical';

export interface RoadmapLevel {
  id: string;
  levelNumber: number;
  title: string;
  description: string;
  topic: string;
  xpReward: number;
  iconType: 'robot' | 'chat' | 'family' | 'home' | 'wave' | 'directions';
  numberColor: string;
  haloColor: string;
  haloBorderColor: string;
  scenarioId?: string;
  customSvg?: string;
  practicePoints: string[];
  canonicalContent: string;
  passingScorePercent?: number;
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
  const [activeTab, setActiveTab] = useState<'basics' | 'objectives'>('basics');

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
  const [formXpReward, setFormXpReward] = useState<number>(100);
  const [formIcon, setFormIcon] = useState<'robot' | 'chat' | 'family' | 'home' | 'wave' | 'directions'>('chat');
  const [formColorIdx, setFormColorIdx] = useState(0);
  const [iconMode, setIconMode] = useState<'preset' | 'custom_svg'>('preset');
  const [formCustomSvg, setFormCustomSvg] = useState('');

  // Canonical Content & Practice Points Fields
  const [formCanonicalContent, setFormCanonicalContent] = useState<string>(DEFAULT_CANONICAL_TEMPLATE);
  const [formPracticePoints, setFormPracticePoints] = useState<string[]>([]);
  const [newPracticePointInput, setNewPracticePointInput] = useState<string>('');

  // Progression & Publication Fields
  const [formMinScore, setFormMinScore] = useState<number>(75);
  const [formIsPublished, setFormIsPublished] = useState<boolean>(true);

  const handleCanonicalTextChange = (text: string) => {
    setFormCanonicalContent(text);
    const parsed = parseCanonicalLessonContent(text);
    if (parsed.title) {
      setFormTitle(parsed.title);
    }
    if (parsed.practicePoints.length > 0) {
      setFormPracticePoints(parsed.practicePoints);
    }
  };

  const handleTitleChange = (newTitle: string) => {
    setFormTitle(newTitle);
    setFormCanonicalContent(formatCanonicalLessonContent(newTitle, formPracticePoints));
  };

  const handleAddPracticePoint = () => {
    const trimmed = newPracticePointInput.trim();
    if (!trimmed) return;
    const updated = [...formPracticePoints, trimmed];
    setFormPracticePoints(updated);
    setNewPracticePointInput('');
    setFormCanonicalContent(formatCanonicalLessonContent(formTitle, updated));
  };

  const handleRemovePracticePoint = (index: number) => {
    const updated = formPracticePoints.filter((_, i) => i !== index);
    setFormPracticePoints(updated);
    setFormCanonicalContent(formatCanonicalLessonContent(formTitle, updated));
  };

  const handleUpdatePracticePoint = (index: number, val: string) => {
    const updated = [...formPracticePoints];
    updated[index] = val;
    setFormPracticePoints(updated);
    setFormCanonicalContent(formatCanonicalLessonContent(formTitle, updated));
  };

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
    setFormTitle('');
    setFormTopic('');
    setFormDescription('');
    setFormXpReward(100);
    setFormIcon('chat');
    setIconMode('preset');
    setFormCustomSvg('');
    setFormColorIdx((nextNumber - 1) % COLOR_THEMES.length);

    setFormCanonicalContent('');
    setFormPracticePoints([]);
    setNewPracticePointInput('');

    setFormMinScore(75);
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

    const pts = (lvl.practicePoints && lvl.practicePoints.length > 0)
      ? lvl.practicePoints
      : (lvl.canonicalContent ? parseCanonicalLessonContent(lvl.canonicalContent).practicePoints : []);
    const content = lvl.canonicalContent || formatCanonicalLessonContent(lvl.title, pts);
    setFormCanonicalContent(content);
    setFormPracticePoints(pts);
    setNewPracticePointInput('');

    setFormMinScore(lvl.passingScorePercent ?? 75);
    setFormIsPublished(lvl.isPublished);
    setActiveTab('basics');
    setIsEditorOpen(true);
  };

  const handleSaveLevel = async () => {
    if (!formTitle.trim()) {
      alert('Please enter a Level Title.');
      return;
    }
    setIsSaving(true);
    const theme = COLOR_THEMES[formColorIdx];
    const points = formPracticePoints.filter((p) => p.trim().length > 0);
    
    // Ensure canonical lesson content matches the user's entered formTitle
    let canonical = formCanonicalContent.trim();
    if (!canonical) {
      canonical = formatCanonicalLessonContent(formTitle.trim(), points);
    } else {
      const parsed = parseCanonicalLessonContent(canonical);
      if (parsed.title && parsed.title !== formTitle.trim()) {
        canonical = formatCanonicalLessonContent(
          formTitle.trim(),
          points.length > 0 ? points : parsed.practicePoints
        );
      }
    }

    const payload = {
      levelNumber: Number(formLevelNumber),
      title: formTitle.trim(),
      description: formDescription.trim(),
      topic: formTopic.trim() || formTitle.trim(),
      xpReward: Number(formXpReward) || 100,
      iconType: formIcon,
      customSvg: iconMode === 'custom_svg' && formCustomSvg.trim() ? formCustomSvg.trim() : '',
      numberColor: theme.numberColor,
      haloColor: theme.haloColor,
      haloBorderColor: theme.haloBorderColor,
      practicePoints: points,
      canonicalContent: canonical,
      passingScorePercent: Number(formMinScore) || 75,
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
    const greeting = `Hello! Welcome to practice for "${lvl.title}". Let's get started!`;
    setSimMessages([
      {
        id: `initial-maya-${Date.now()}`,
        sender: 'maya',
        text: greeting,
        wordCount: greeting.trim().split(/\s+/).filter(Boolean).length,
      },
    ]);
    setSimInput('');
    setIsPlaygroundOpen(true);
  };

  const openPlaygroundWithDraft = () => {
    const points = formPracticePoints.filter((p) => p.trim().length > 0);
    const draftLevel: RoadmapLevel = {
      id: editingLevel?.id || 'draft-level',
      levelNumber: formLevelNumber,
      title: formTitle || `Level ${formLevelNumber}`,
      topic: formTopic || 'General Conversation',
      description: formDescription,
      xpReward: formXpReward,
      iconType: formIcon,
      customSvg: iconMode === 'custom_svg' ? formCustomSvg : undefined,
      numberColor: COLOR_THEMES[formColorIdx].numberColor,
      haloColor: COLOR_THEMES[formColorIdx].haloColor,
      haloBorderColor: COLOR_THEMES[formColorIdx].haloBorderColor,
      isPublished: formIsPublished,
      practicePoints: points,
      canonicalContent: formCanonicalContent,
      passingScorePercent: Number(formMinScore) || 75,
    };
    openPlayground(draftLevel);
  };

  const handleResetPlayground = () => {
    if (!playgroundLevel) return;
    const greeting = `Hello! Welcome to practice for "${playgroundLevel.title}". Let's get started!`;
    setSimMessages([
      {
        id: `reset-maya-${Date.now()}`,
        sender: 'maya',
        text: greeting,
        wordCount: greeting.trim().split(/\s+/).filter(Boolean).length,
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
          levelTitle: playgroundLevel.title,
          practicePoints: playgroundLevel.practicePoints,
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
        practicePoints: JSON.stringify(lvl.practicePoints || []),
        canonicalContent: lvl.canonicalContent || '',
        passingScorePercent: String(lvl.passingScorePercent || 75),
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
  const totalTasks = levels.reduce((acc, l) => acc + (l.practicePoints?.length || 0), 0);
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
            subtitle="Design roadmap curriculum, configure canonical lesson tasks, and test live simulator."
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
              <Text style={styles.metricLabel}>Total Practice Tasks</Text>
              <Text style={[styles.metricVal, { color: '#0284c7' }]}>{totalTasks}</Text>
              <Text style={styles.metricSub}>Deliberate focus points</Text>
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
                            <Feather name="check-circle" size={12} color="#0369a1" style={{ marginRight: 4 }} />
                            <Text style={styles.timeBadgeText}>Pass ≥ {lvl.passingScorePercent || 75}%</Text>
                          </View>
                          <View style={styles.xpBadge}>
                            <Feather name="award" size={12} color="#b45309" style={{ marginRight: 4 }} />
                            <Text style={styles.xpBadgeText}>+{lvl.xpReward || 100} XP</Text>
                          </View>
                          {lvl.practicePoints && lvl.practicePoints.length > 0 && (
                            <View style={styles.objectivesBadge}>
                              <Feather name="target" size={12} color="#059669" style={{ marginRight: 4 }} />
                              <Text style={styles.objectivesBadgeText}>
                                {lvl.practicePoints.length} Tasks
                              </Text>
                            </View>
                          )}
                          <View style={[styles.timeBadge, { backgroundColor: '#f5f3ff', borderColor: '#ddd6fe' }]}>
                            <Feather name="check-circle" size={12} color="#7c3aed" style={{ marginRight: 4 }} />
                            <Text style={[styles.timeBadgeText, { color: '#6d28d9' }]}>Pass: {lvl.passingScorePercent || 75}%</Text>
                          </View>
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

                        {/* Practice Points Preview Snippets */}
                        {lvl.practicePoints && lvl.practicePoints.length > 0 ? (
                          <View style={styles.guidedSnippetsRow}>
                            <View style={styles.snippetItem}>
                              <Text style={styles.snippetLabel}>Practice:</Text>
                              <Text style={styles.snippetValue} numberOfLines={1}>
                                {lvl.practicePoints.slice(0, 2).join(' • ')}
                                {lvl.practicePoints.length > 2 ? ` (+${lvl.practicePoints.length - 2} more)` : ''}
                              </Text>
                            </View>
                          </View>
                        ) : null}

                        {/* Unlock Condition Info */}
                        <View style={styles.unlockRuleRow}>
                          <Feather
                            name={lvl.levelNumber === 1 ? 'unlock' : 'lock'}
                            size={13}
                            color="#64748b"
                            style={{ marginRight: 5 }}
                          />
                          <Text style={styles.unlockRuleText}>
                            {lvl.levelNumber === 1
                              ? 'Level 01 · Open to all students'
                              : `Unlocks upon passing Level ${lvl.levelNumber - 1} (Score ≥ ${lvl.passingScorePercent || 75}%)`}
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
                  2. Lesson & Practice ({formPracticePoints.length})
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
                        onChangeText={handleTitleChange}
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
                      <Text style={styles.fieldLabel}>Passing Requirement</Text>
                      <View style={styles.durationBtnRow}>
                        {[60, 65, 70, 75, 80, 85].map((sc) => (
                          <Pressable
                            key={sc}
                            onPress={() => setFormMinScore(sc)}
                            style={[
                              styles.durPill,
                              formMinScore === sc && styles.durPillActive,
                            ]}
                          >
                            <Text
                              style={[
                                styles.durPillText,
                                formMinScore === sc && styles.durPillTextActive,
                              ]}
                            >
                              ≥ {sc}%
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

                  {/* Publish Status Toggle */}
                  <View style={[styles.publishToggleRow, { marginTop: 16 }]}>
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

              {/* TAB 2: LESSON CONTENT & PRACTICE TASKS */}
              {activeTab === 'objectives' && (
                <View style={styles.tabSection}>
                  {/* Canonical Plain Text Editor Card */}
                  <View style={styles.promptCard}>
                    <View style={styles.promptCardHeader}>
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <Feather name="file-text" size={16} color="#0d9488" style={{ marginRight: 6 }} />
                        <Text style={styles.fieldLabel}>Canonical Plain-Text Format</Text>
                      </View>
                      <View style={styles.hintBadge}>
                        <Text style={styles.hintBadgeText}>AI 3-Stage Learning Engine</Text>
                      </View>
                    </View>
                    <Text style={styles.fieldHelper}>
                      Paste or edit the lesson in this universal format. Maya uses these exact points for Stage 1 Guided Teaching and Stage 2 Roleplay Challenge.
                    </Text>

                    <TextInput
                      style={[styles.textInput, styles.canonicalEditorInput]}
                      value={formCanonicalContent}
                      onChangeText={handleCanonicalTextChange}
                      placeholder={DEFAULT_CANONICAL_TEMPLATE}
                      placeholderTextColor="#94a3b8"
                      multiline
                      numberOfLines={8}
                    />

                    <View style={styles.canonicalActionsRow}>
                      <Pressable
                        onPress={() => handleCanonicalTextChange(DEFAULT_CANONICAL_TEMPLATE)}
                        style={styles.quickFillObjectivesBtn}
                      >
                        <Feather name="book-open" size={13} color="#d97706" style={{ marginRight: 4 }} />
                        <Text style={styles.quickFillObjectivesBtnText}>Load Restaurant Template</Text>
                      </Pressable>
                      <Pressable
                        onPress={() => setFormCanonicalContent(formatCanonicalLessonContent(formTitle, formPracticePoints))}
                        style={styles.addObjectiveBtn}
                      >
                        <Feather name="refresh-cw" size={13} color="#0d9488" style={{ marginRight: 4 }} />
                        <Text style={styles.addObjectiveBtnText}>Re-format Text</Text>
                      </Pressable>
                    </View>
                  </View>

                  {/* Active Practice Points List */}
                  <View style={styles.objectivesSectionCard}>
                    <View style={styles.objectivesSectionHeader}>
                      <View>
                        <Text style={styles.fieldLabel}>
                          Active Practice Tasks ({formPracticePoints.length})
                        </Text>
                        <Text style={styles.fieldHelper}>
                          Each point is displayed on-screen during the call as an active mission task.
                        </Text>
                      </View>
                    </View>

                    {formPracticePoints.length === 0 ? (
                      <View style={styles.emptyObjectivesBox}>
                        <Feather name="target" size={26} color="#94a3b8" style={{ marginBottom: 6 }} />
                        <Text style={styles.emptyObjectivesTitle}>No practice points defined</Text>
                        <Text style={styles.emptyObjectivesDesc}>
                          Type bullet points in the box above or add them using the input below.
                        </Text>
                      </View>
                    ) : (
                      formPracticePoints.map((point, index) => (
                        <View key={`pt-${index}`} style={styles.objectiveEditorCard}>
                          <View style={styles.objectiveCardTop}>
                            <View style={styles.objectiveNumBadge}>
                              <Text style={styles.objectiveNumText}>#{index + 1}</Text>
                            </View>
                            <TextInput
                              style={[styles.textInput, { flex: 1, marginHorizontal: 8 }]}
                              value={point}
                              onChangeText={(val) => handleUpdatePracticePoint(index, val)}
                              placeholder="e.g. Asking for a table and looking at the menu"
                            />
                            <Pressable
                              onPress={() => handleRemovePracticePoint(index)}
                              style={styles.deleteObjectiveBtn}
                              hitSlop={8}
                            >
                              <Feather name="trash-2" size={16} color="#ef4444" />
                            </Pressable>
                          </View>
                        </View>
                      ))
                    )}

                    {/* Add New Practice Point Row */}
                    <View style={styles.addPointRow}>
                      <TextInput
                        style={[styles.textInput, { flex: 1, marginRight: 8 }]}
                        value={newPracticePointInput}
                        onChangeText={setNewPracticePointInput}
                        placeholder="Add another practice task (e.g. Asking for recommendations)..."
                        onSubmitEditing={handleAddPracticePoint}
                        returnKeyType="done"
                      />
                      <Pressable
                        onPress={handleAddPracticePoint}
                        style={[styles.addObjectiveBtn, !newPracticePointInput.trim() && { opacity: 0.6 }]}
                        disabled={!newPracticePointInput.trim()}
                      >
                        <Feather name="plus" size={14} color="#0d9488" style={{ marginRight: 4 }} />
                        <Text style={styles.addObjectiveBtnText}>Add Point</Text>
                      </Pressable>
                    </View>
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
                <Text style={styles.infoBarLabel}>LESSON</Text>
                <Text style={styles.infoBarValue} numberOfLines={1}>
                  {playgroundLevel?.title || 'Speaking Practice'}
                </Text>
              </View>
              <View style={styles.infoBarDivider} />
              <View style={styles.infoBarItem}>
                <Text style={styles.infoBarLabel}>TASKS</Text>
                <Text style={styles.infoBarValue} numberOfLines={1}>
                  {playgroundLevel?.practicePoints?.length || 0} Practice Points
                </Text>
              </View>
              <View style={styles.infoBarDivider} />
              <View style={styles.infoBarItem}>
                <Text style={styles.infoBarLabel}>PASS RULE</Text>
                <View style={styles.guardrailPill}>
                  <Feather name="award" size={12} color="#059669" style={{ marginRight: 4 }} />
                  <Text style={styles.guardrailPillText}>≥ {playgroundLevel?.passingScorePercent || 75}%</Text>
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
  canonicalEditorInput: {
    fontFamily: Platform.select({ web: 'monospace', default: 'Courier' }),
    fontSize: 12.5,
    lineHeight: 19,
    minHeight: 140,
    textAlignVertical: 'top',
    backgroundColor: '#fafafa',
  },
  canonicalActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
    flexWrap: 'wrap',
  },
  addPointRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
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
