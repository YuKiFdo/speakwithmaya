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
import { Feather, Ionicons } from '@expo/vector-icons';
import { SvgXml } from 'react-native-svg';
import { fontStyle } from '@/theme/fonts';
import { useBreakpoint } from '@/hooks/useBreakpoint';
import { getBackendBaseUrl } from '@/hooks/useLiveCall';
import { AdminSidebar } from '@/components/admin/AdminSidebar';
import { AdminTopBar } from '@/components/admin/AdminTopBar';
import { AdminTableSkeleton } from '@/components/ui/skeleton';
import { adaptSvgColor } from '@/app/admin/roadmap';
import {
  RoadmapRobotIcon,
  RoadmapChatIcon,
  RoadmapFamilyIcon,
  RoadmapHomeIcon,
  RoadmapWaveIcon,
  RoadmapDirectionsIcon,
} from '@/components/icons/roadmap-icons';

export interface ScenarioItem {
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
  scenarioPrompt?: string;
  openingMode?: 'maya_explains_first' | 'maya_in_character' | 'user_starts';
  openingLine?: string;
  scenarioBriefing?: string;
  emotionTags?: string[];
  isScenarioMode?: boolean;
  isPublished: boolean;
  createdAt?: string;
  updatedAt?: string;
}

interface SimulatorMessage {
  id: string;
  sender: 'maya' | 'user';
  text: string;
  wordCount?: number;
  correction?: {
    studentSaid?: string;
    moreNatural?: string;
    explanation?: string;
  };
}

const COLOR_THEMES = [
  { name: 'Blue', numberColor: '#0057FF', haloColor: '#EFF6FF', haloBorderColor: '#BFDBFE' },
  { name: 'Rose', numberColor: '#E11D48', haloColor: '#FFF1F2', haloBorderColor: '#FECDD3' },
  { name: 'Amber', numberColor: '#D97706', haloColor: '#FFFBEB', haloBorderColor: '#FDE68A' },
  { name: 'Purple', numberColor: '#9333EA', haloColor: '#FAF5FF', haloBorderColor: '#E9D5FF' },
  { name: 'Green', numberColor: '#16A34A', haloColor: '#F0FDF4', haloBorderColor: '#BBF7D0' },
  { name: 'Indigo', numberColor: '#4F46E5', haloColor: '#EEF2FF', haloBorderColor: '#C7D2FE' },
];

const EMOTION_BADGES: Record<string, { label: string; bg: string; text: string; icon: string }> = {
  angry: { label: 'Angry / Frustrated', bg: '#fef2f2', text: '#ef4444', icon: 'zap' },
  crying: { label: 'Crying / Emotional', bg: '#eff6ff', text: '#3b82f6', icon: 'cloud-rain' },
  cheerful: { label: 'Cheerful / Upbeat', bg: '#f0fdf4', text: '#16a34a', icon: 'sun' },
  strict: { label: 'Strict / Skeptical', bg: '#faf5ff', text: '#9333ea', icon: 'shield' },
  professional: { label: 'Professional / Formal', bg: '#f8fafc', text: '#475569', icon: 'briefcase' },
  neutral: { label: 'Balanced / Coaching', bg: '#f1f5f9', text: '#64748b', icon: 'message-circle' },
};

const SCENARIO_PRESETS = [
  {
    id: 'angry-customer',
    title: 'Angry Hotel Guest',
    emotion: 'angry',
    category: 'Hospitality & Conflict',
    briefing: 'A guest booked an ocean-view suite, but their room was given away. Calm them down without getting defensive.',
    openingMode: 'maya_explains_first' as const,
    openingLine: 'Excuse me! I have been standing at this reception desk for 30 minutes and no one is helping me!',
    prompt: `You are Maya playing the role of Mrs. Perera, an angry and impatient customer at a luxury hotel.
Scenario Setting: You reserved an ocean-view suite two months ago for your anniversary. The front desk just told you the room is occupied and offered a standard room without refund.
Emotional State: Highly irritated, sharp tone, speaking quickly, easily offended by excuses.
Conversation Rules:
1. Speak strictly in character in natural English.
2. If the student makes defensive excuses or blames "the system", get more frustrated and demand to speak to the general manager.
3. If the student listens with genuine empathy, apologizes sincerely, and offers a tangible solution (e.g. complimentary executive upgrade, dinner voucher, or partial refund), gradually soften your tone and accept.
4. Keep each spoken turn strictly under 15-20 words.`,
  },
  {
    id: 'crying-friend',
    title: 'Comforting a Crying Friend',
    emotion: 'crying',
    category: 'Empathy & Relationships',
    briefing: 'Your close friend Sarah had her dream scholarship cancelled. Listen actively, offer comfort, and reassure her.',
    openingMode: 'maya_explains_first' as const,
    openingLine: 'Tharindu... I just got the email. They cancelled my master scholarship... I don’t know what to do.',
    prompt: `You are Maya playing the role of Tharindu's close friend, Sarah.
Scenario Setting: You just received a rejection email stating your international scholarship funding was revoked. You called Tharindu in deep distress.
Emotional State: Heartbroken, voice shaking, sniffling between sentences, feeling like giving up.
Conversation Rules:
1. Speak softly, sounding tearful, vulnerable, and overwhelmed.
2. If the student gives cold or dismissive advice, sound hurt and close off.
3. If the student speaks with warm empathy, validates your feelings, and offers to help you explore alternative options, feel comforted and thank them.
4. Keep each spoken turn under 15-20 words.`,
  },
  {
    id: 'strict-interview',
    title: 'Tough Job Interview',
    emotion: 'strict',
    category: 'Career & Professional',
    briefing: 'A skeptical engineering director doubts your background. Defend your experience with concrete, structured examples.',
    openingMode: 'maya_in_character' as const,
    openingLine: 'Welcome. I reviewed your resume, but frankly, your leadership background seems quite thin for this role. Convince me otherwise.',
    prompt: `You are Maya playing the role of Mr. David, a demanding, skeptical Senior Engineering Director.
Scenario Setting: You are conducting a final-round behavioral interview. You want to see if the candidate handles pressure well.
Emotional State: Direct, no-nonsense, probing, skeptical, highly analytical.
Conversation Rules:
1. Ask tough, direct follow-up questions. Push back if their answers are vague or buzzword-heavy: say "Can you give me a specific real-world example of that?"
2. If the candidate answers with the STAR method (Situation, Task, Action, Result) confidently, acknowledge their competence.
3. Keep spoken replies crisp and under 15-20 words.`,
  },
  {
    id: 'flight-delay',
    title: 'Airport Flight Delay Dispute',
    emotion: 'angry',
    category: 'Travel & Emergency',
    briefing: 'Your connecting flight in Doha was cancelled without notice. Negotiate meal and hotel vouchers with a stressed airline agent.',
    openingMode: 'maya_explains_first' as const,
    openingLine: 'Excuse me agent, the departure board says my flight is cancelled, but no one made an announcement!',
    prompt: `You are Maya playing the role of a stressed international passenger whose connecting flight was cancelled.
Scenario Setting: Midnight at a crowded transit hub. You have an urgent business meeting in London tomorrow morning.
Emotional State: Stressed, worried, speaking with urgency, demanding quick solutions.
Conversation Rules:
1. Insist on clear answers: what happened to the aircraft and when is the next available flight?
2. Ask for accommodation and meal vouchers as required by international aviation policy.
3. Respond warmly if the airline representative communicates clearly and acts quickly to rebook you.
4. Keep each spoken turn under 15-20 words.`,
  },
  {
    id: 'cafe-chat',
    title: 'Friendly Neighborhood Cafe',
    emotion: 'cheerful',
    category: 'Casual & Daily Life',
    briefing: 'Order drinks and chat with a cheerful barista about local weekend events and your favorite hobbies.',
    openingMode: 'maya_in_character' as const,
    openingLine: 'Good morning! Welcome to Bean & Brew! What can I get started for you today?',
    prompt: `You are Maya playing the role of Maya, a warm, cheerful, and chatty barista at a cozy specialty coffee shop.
Scenario Setting: A sunny morning at a neighborhood cafe.
Emotional State: Upbeat, energetic, enthusiastic, welcoming.
Conversation Rules:
1. Greet the customer with a big smile and ask what they feel like drinking.
2. Ask friendly small-talk questions: how is their day going, any fun weekend plans?
3. Share enthusiastic remarks about their choices.
4. Keep each spoken response under 15-20 words.`,
  },
];

export default function AdminScenariosScreen() {
  const { isPhone } = useBreakpoint();
  const { width: windowWidth } = useWindowDimensions();

  const [sidebarOpen, setSidebarOpen] = useState(!isPhone);
  const [scenarios, setScenarios] = useState<ScenarioItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [filterEmotion, setFilterEmotion] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Editor Modal
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingScenario, setEditingScenario] = useState<ScenarioItem | null>(null);
  const [activeTab, setActiveTab] = useState<'prompt' | 'basics' | 'playground'>('prompt');

  // Form Fields
  const [formLevelNumber, setFormLevelNumber] = useState<number>(1);
  const [formTitle, setFormTitle] = useState('');
  const [formTopic, setFormTopic] = useState('');
  const [formBriefing, setFormBriefing] = useState('');
  const [formPrompt, setFormPrompt] = useState('');
  const [formOpeningMode, setFormOpeningMode] = useState<'maya_explains_first' | 'maya_in_character' | 'user_starts'>('maya_explains_first');
  const [formOpeningLine, setFormOpeningLine] = useState('');
  const [formEmotion, setFormEmotion] = useState<string>('neutral');
  const [formPassingScore, setFormPassingScore] = useState<number>(70);
  const [formXpReward, setFormXpReward] = useState<number>(100);
  const [formColorIdx, setFormColorIdx] = useState(0);
  const [formIcon, setFormIcon] = useState<'robot' | 'chat' | 'family' | 'home' | 'wave' | 'directions'>('chat');
  const [formCustomSvg, setFormCustomSvg] = useState('');
  const [formIsPublished, setFormIsPublished] = useState(true);

  // Playground / Simulator
  const [simMessages, setSimMessages] = useState<SimulatorMessage[]>([]);
  const [simInput, setSimInput] = useState('');
  const [isSimulating, setIsSimulating] = useState(false);

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
    setEditingScenario(null);
    setFormLevelNumber(nextNumber);
    setFormTitle('');
    setFormTopic('Roleplay Scenario');
    setFormBriefing('');
    setFormPrompt('');
    setFormOpeningMode('maya_explains_first');
    setFormOpeningLine('');
    setFormEmotion('neutral');
    setFormPassingScore(70);
    setFormXpReward(100);
    setFormColorIdx((nextNumber - 1) % COLOR_THEMES.length);
    setFormIcon('chat');
    setFormCustomSvg('');
    setFormIsPublished(true);
    setSimMessages([]);
    setActiveTab('prompt');
    setIsEditorOpen(true);
  };

  const openEditModal = (item: ScenarioItem) => {
    setEditingScenario(item);
    setFormLevelNumber(item.levelNumber);
    setFormTitle(item.title);
    setFormTopic(item.topic || 'Roleplay Scenario');
    setFormBriefing(item.scenarioBriefing || item.description || '');
    setFormPrompt(item.scenarioPrompt || '');
    setFormOpeningMode(item.openingMode || 'maya_explains_first');
    setFormOpeningLine(item.openingLine || '');
    setFormEmotion(item.emotionTags && item.emotionTags[0] ? item.emotionTags[0] : 'neutral');
    setFormPassingScore(item.passingScorePercent ?? 70);
    setFormXpReward(item.xpReward || 100);
    setFormIcon(item.iconType || 'chat');
    setFormCustomSvg(item.customSvg || '');
    const colorIdx = COLOR_THEMES.findIndex((c) => c.numberColor === item.numberColor);
    setFormColorIdx(colorIdx !== -1 ? colorIdx : 0);
    setFormIsPublished(item.isPublished);
    setSimMessages([]);
    setActiveTab('prompt');
    setIsEditorOpen(true);
  };

  const handleApplyPreset = (preset: (typeof SCENARIO_PRESETS)[0]) => {
    setFormTitle(preset.title);
    setFormTopic(preset.category);
    setFormBriefing(preset.briefing);
    setFormPrompt(preset.prompt);
    setFormOpeningMode(preset.openingMode);
    setFormOpeningLine(preset.openingLine);
    setFormEmotion(preset.emotion);
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
      topic: formTopic.trim() || 'Roleplay Scenario',
      scenarioPrompt: formPrompt.trim(),
      openingMode: formOpeningMode,
      openingLine: formOpeningLine.trim(),
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

  const handleRunSimulation = async (customMsg?: string) => {
    const text = (customMsg || simInput).trim();
    if (!text) return;
    if (!customMsg) setSimInput('');

    const userEntry: SimulatorMessage = {
      id: `u-${Date.now()}`,
      sender: 'user',
      text,
    };
    setSimMessages((prev) => [...prev, userEntry]);
    setIsSimulating(true);

    try {
      const baseUrl = getBackendBaseUrl();
      const res = await fetch(`${baseUrl}/v1/admin/roadmap/simulate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userMessage: text,
          levelTitle: formTitle || 'Roleplay Scenario',
          scenarioPrompt: formPrompt,
          emotionTags: [formEmotion],
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const replyText = data.mayaSpoken || data.reply || "That's a good response. Let's continue.";
        const mayaReply: SimulatorMessage = {
          id: `m-${Date.now()}`,
          sender: 'maya',
          text: replyText,
          wordCount: data.wordCount ?? replyText.split(/\s+/).filter(Boolean).length,
          correction: data.correction
            ? {
                studentSaid: data.correction.studentSaid,
                moreNatural: data.correction.moreNatural,
                explanation: data.correction.explanation,
              }
            : undefined,
        };
        setSimMessages((prev) => [...prev, mayaReply]);
      }
    } catch (err: any) {
      setSimMessages((prev) => [
        ...prev,
        { id: `err-${Date.now()}`, sender: 'maya', text: `Simulation error: ${err?.message}` },
      ]);
    } finally {
      setIsSimulating(false);
    }
  };

  const handleLaunchVoiceCall = (lvl: ScenarioItem) => {
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
        duration: '300',
        languageMode: 'english',
        sinhalaStyle: 'balanced',
        aiSuggestions: 'true',
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
            subtitle="Design roleplay scenarios with custom prompts, emotional states (angry, crying, happy), and automated unlocking."
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
                <Text style={styles.metricLabel}>Emotional Range</Text>
                <Text style={[styles.metricVal, { color: '#0057FF' }]}>6 Roles</Text>
                <Text style={styles.metricSub}>Angry, crying, strict, etc.</Text>
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
                  placeholderTextColor="#94a3b8"
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
                            <Feather name="check-circle" size={12} color="#16a34a" style={{ marginRight: 4 }} />
                            <Text style={styles.tagText}>Pass: ≥{item.passingScorePercent || 70}%</Text>
                          </View>
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
      {/* SCENARIO EDITOR & PROMPT CONFIGURATION MODAL                 */}
      {/* ============================================================ */}
      <Modal visible={isEditorOpen} animationType="fade" transparent onRequestClose={() => setIsEditorOpen(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, isPhone && styles.modalCardMobile]}>
            <View style={styles.modalHeader}>
              <View style={styles.modalHeaderTitleRow}>
                <View style={styles.modalBadge}>
                  <Text style={styles.modalBadgeText}>#{String(formLevelNumber).padStart(2, '0')}</Text>
                </View>
                <View>
                  <Text style={styles.modalTitle}>
                    {editingScenario ? `Edit Scenario: ${formTitle}` : 'Create New Scenario'}
                  </Text>
                  <Text style={styles.modalSubtitle}>
                    Configure Maya's exact character persona, emotions, opening mode, and prompt rules.
                  </Text>
                </View>
              </View>
              <Pressable onPress={() => setIsEditorOpen(false)} style={styles.modalCloseBtn}>
                <Feather name="x" size={20} color="#64748b" />
              </Pressable>
            </View>

            {/* Modal Tabs */}
            <View style={styles.modalTabsRow}>
              <Pressable
                onPress={() => setActiveTab('prompt')}
                style={[styles.tabBtn, activeTab === 'prompt' && styles.tabBtnActive]}
              >
                <Feather name="cpu" size={15} color={activeTab === 'prompt' ? '#0d9488' : '#64748b'} style={{ marginRight: 6 }} />
                <Text style={[styles.tabBtnText, activeTab === 'prompt' && styles.tabBtnTextActive]}>
                  1. Roleplay Prompt & Emotion
                </Text>
              </Pressable>

              <Pressable
                onPress={() => setActiveTab('basics')}
                style={[styles.tabBtn, activeTab === 'basics' && styles.tabBtnActive]}
              >
                <Feather name="layers" size={15} color={activeTab === 'basics' ? '#0d9488' : '#64748b'} style={{ marginRight: 6 }} />
                <Text style={[styles.tabBtnText, activeTab === 'basics' && styles.tabBtnTextActive]}>
                  2. Details & Level Unlocking
                </Text>
              </Pressable>

              <Pressable
                onPress={() => setActiveTab('playground')}
                style={[styles.tabBtn, activeTab === 'playground' && styles.tabBtnActive]}
              >
                <Feather name="play-circle" size={15} color={activeTab === 'playground' ? '#0d9488' : '#64748b'} style={{ marginRight: 6 }} />
                <Text style={[styles.tabBtnText, activeTab === 'playground' && styles.tabBtnTextActive]}>
                  3. Test Playground
                </Text>
              </Pressable>
            </View>

            <ScrollView style={styles.modalBodyScroll} showsVerticalScrollIndicator={false}>
              {/* TAB 1: PROMPT & EMOTION */}
              {activeTab === 'prompt' && (
                <View style={styles.tabSection}>
                  {/* Presets Library Banner */}
                  <View style={styles.presetSection}>
                    <Text style={styles.fieldLabel}>Load Pre-Built Roleplay Preset (1-Click)</Text>
                    <Text style={styles.fieldHelper}>Instantly pre-populate scenario setting, emotion, opening line, and prompt.</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 8 }}>
                      {SCENARIO_PRESETS.map((p) => (
                        <Pressable
                          key={p.id}
                          onPress={() => handleApplyPreset(p)}
                          style={styles.presetChip}
                        >
                          <Text style={styles.presetChipTitle}>{p.title}</Text>
                          <Text style={styles.presetChipCategory}>● {p.category}</Text>
                        </Pressable>
                      ))}
                    </ScrollView>
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
                            <Text style={[styles.emotionChoiceText, isSelected && { color: b.text, fontWeight: '700' }]}>
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
                      {[
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
                      ].map((m) => (
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
                      placeholder='e.g. "Excuse me! Are you the manager here? I have a serious complaint!"'
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
                      placeholderTextColor="#94a3b8"
                      multiline
                      numberOfLines={10}
                    />
                  </View>
                </View>
              )}

              {/* TAB 2: BASICS & UNLOCKING */}
              {activeTab === 'basics' && (
                <View style={styles.tabSection}>
                  <View style={styles.twoColRow}>
                    <View style={styles.formCol}>
                      <Text style={styles.fieldLabel}>Level / Milestone # *</Text>
                      <TextInput
                        style={styles.textInput}
                        value={String(formLevelNumber)}
                        onChangeText={(txt) => setFormLevelNumber(parseInt(txt, 10) || 1)}
                        keyboardType="numeric"
                      />
                    </View>
                    <View style={[styles.formCol, { flex: 2 }]}>
                      <Text style={styles.fieldLabel}>Scenario Title *</Text>
                      <TextInput
                        style={styles.textInput}
                        value={formTitle}
                        onChangeText={setFormTitle}
                        placeholder="e.g. Angry Hotel Guest"
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
                    />
                  </View>

                  <View style={styles.formGroup}>
                    <Text style={styles.fieldLabel}>Student Mission Briefing *</Text>
                    <Text style={styles.fieldHelper}>Shown on the student roadmap modal before starting the call.</Text>
                    <TextInput
                      style={[styles.textInput, styles.textArea]}
                      value={formBriefing}
                      onChangeText={setFormBriefing}
                      placeholder="Explain the communicative challenge for the student..."
                      multiline
                      numberOfLines={3}
                    />
                  </View>

                  {/* Automated Unlocking Threshold */}
                  <View style={styles.twoColRow}>
                    <View style={styles.formCol}>
                      <Text style={styles.fieldLabel}>Passing Score to Unlock Next Level</Text>
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
                    </View>

                    <View style={styles.formCol}>
                      <Text style={styles.fieldLabel}>XP Points Awarded</Text>
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

                  {/* Accent Color */}
                  <View style={styles.formGroup}>
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

                  {/* Publishing Toggle */}
                  <View style={styles.publishToggleRow}>
                    <View>
                      <Text style={styles.fieldLabel}>Publish Live on Student Roadmap</Text>
                      <Text style={styles.fieldHelper}>Draft scenarios remain hidden until enabled.</Text>
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

              {/* TAB 3: PLAYGROUND */}
              {activeTab === 'playground' && (
                <View style={styles.tabSection}>
                  <View style={styles.playgroundHeader}>
                    <Text style={styles.fieldLabel}>Interactive Simulator</Text>
                    <Text style={styles.fieldHelper}>
                      Test how Maya responds to your input under this scenario's prompt and emotional state.
                    </Text>
                  </View>

                  {/* Quick test prompt chips */}
                  <View style={styles.quickChipsRow}>
                    {[
                      'I want to speak with your manager immediately!',
                      'Please calm down, let me see how I can help you.',
                      'I am so sorry to hear that. Are you okay?',
                    ].map((chip) => (
                      <Pressable
                        key={chip}
                        onPress={() => handleRunSimulation(chip)}
                        style={styles.quickChip}
                      >
                        <Text style={styles.quickChipText}>{chip}</Text>
                      </Pressable>
                    ))}
                  </View>

                  {/* Simulator Messages List */}
                  <View style={styles.simConsole}>
                    {simMessages.length === 0 ? (
                      <View style={styles.emptySim}>
                        <Feather name="terminal" size={24} color="#94a3b8" />
                        <Text style={styles.emptySimText}>Type a message below or tap a quick chip to test Maya's response.</Text>
                      </View>
                    ) : (
                      simMessages.map((m) => (
                        <View
                          key={m.id}
                          style={[
                            styles.simMsgBubble,
                            m.sender === 'maya' ? styles.simMsgMaya : styles.simMsgUser,
                          ]}
                        >
                          <Text style={styles.simMsgSender}>{m.sender === 'maya' ? 'Maya (In Character)' : 'You (Student)'}</Text>
                          <Text style={styles.simMsgText}>{m.text}</Text>
                          {m.correction && (
                            <View style={styles.simCorrectionBox}>
                              <Text style={styles.simCorrectionLabel}>Correction:</Text>
                              <Text style={styles.simCorrectionText}>
                                "{m.correction.studentSaid}" → "{m.correction.moreNatural}"
                              </Text>
                            </View>
                          )}
                        </View>
                      ))
                    )}
                  </View>

                  <View style={styles.simInputRow}>
                    <TextInput
                      style={[styles.textInput, { flex: 1, marginRight: 8 }]}
                      placeholder="Type what you would say to Maya..."
                      value={simInput}
                      onChangeText={setSimInput}
                      onSubmitEditing={() => handleRunSimulation()}
                    />
                    <Pressable
                      onPress={() => handleRunSimulation()}
                      style={[styles.newBtn, isSimulating && { opacity: 0.6 }]}
                      disabled={isSimulating}
                    >
                      {isSimulating ? (
                        <ActivityIndicator size="small" color="#ffffff" />
                      ) : (
                        <Feather name="send" size={16} color="#ffffff" />
                      )}
                    </Pressable>
                  </View>
                </View>
              )}
            </ScrollView>

            {/* Modal Actions */}
            <View style={styles.modalFooter}>
              <Pressable onPress={() => setIsEditorOpen(false)} style={styles.cancelBtn}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
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
    maxWidth: 820,
    maxHeight: '90%',
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
    height: '96%',
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
  modalTabsRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    backgroundColor: '#f8fafc',
  },
  tabBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabBtnActive: {
    borderBottomColor: '#0d9488',
    backgroundColor: '#ffffff',
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
    padding: 20,
  },
  tabSection: {
    gap: 16,
  },
  presetSection: {
    backgroundColor: '#f8fafc',
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  presetChip: {
    backgroundColor: '#ffffff',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    marginRight: 10,
  },
  presetChipTitle: {
    ...fontStyle('outfit', 'semiBold'),
    fontSize: 13,
    color: '#0f172a',
  },
  presetChipCategory: {
    ...fontStyle('inter', 'medium'),
    fontSize: 11,
    color: '#0d9488',
    marginTop: 2,
  },
  formGroup: {
    marginBottom: 12,
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
  playgroundHeader: {
    marginBottom: 8,
  },
  quickChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 12,
  },
  quickChip: {
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
  },
  quickChipText: {
    ...fontStyle('inter', 'regular'),
    fontSize: 11,
    color: '#334155',
  },
  simConsole: {
    backgroundColor: '#0f172a',
    borderRadius: 10,
    padding: 14,
    minHeight: 180,
    maxHeight: 280,
    gap: 10,
  },
  emptySim: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 30,
  },
  emptySimText: {
    ...fontStyle('inter', 'regular'),
    fontSize: 12,
    color: '#64748b',
    textAlign: 'center',
    marginTop: 6,
  },
  simMsgBubble: {
    padding: 10,
    borderRadius: 8,
    maxWidth: '85%',
  },
  simMsgMaya: {
    backgroundColor: '#1e293b',
    alignSelf: 'flex-start',
  },
  simMsgUser: {
    backgroundColor: '#0d9488',
    alignSelf: 'flex-end',
  },
  simMsgSender: {
    ...fontStyle('inter', 'semiBold'),
    fontSize: 10,
    color: '#94a3b8',
    marginBottom: 2,
    textTransform: 'uppercase',
  },
  simMsgText: {
    ...fontStyle('inter', 'regular'),
    fontSize: 13,
    color: '#ffffff',
    lineHeight: 18,
  },
  simCorrectionBox: {
    marginTop: 6,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: '#334155',
  },
  simCorrectionLabel: {
    ...fontStyle('inter', 'bold'),
    fontSize: 10,
    color: '#f59e0b',
  },
  simCorrectionText: {
    ...fontStyle('inter', 'regular'),
    fontSize: 11,
    color: '#cbd5e1',
  },
  simInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
  },
});
