import type { TourCopy, TourDefinition, TourLang } from '@/components/tour/tour-types';
import { TOUR_UI } from './tour-ui-copy';

/**
 * History tours. Sinhala is everyday spoken style; Sinhala and Tamil await native-speaker review.
 *
 * - HISTORY_TOUR: first visit to History once the learner has at least one conversation.
 *   Desktop shows list + review side by side, so it covers everything in one go. On phone the
 *   review is a separate view, so the recording / transcript steps are skipped there and
 * - HISTORY_DETAIL_TOUR covers them the first time a review is opened on a phone.
 */

const STEPS: Record<TourLang, Record<string, TourCopy>> = {
  en: {
    search: {
      title: 'Find a conversation',
      body: 'Search by a word or topic, or use the mode button to show only one kind of practice.',
      bodyDesktop: 'Type a word or topic to quickly find a past conversation.',
    },
    session: {
      title: 'Your conversations',
      body: 'Tap a conversation to open its full review. Use ▶ to listen to it right here.',
      bodyDesktop: 'Click a conversation to see its review on the right. Use ▶ to listen to it straight away.',
    },
    recording: {
      title: 'Voice recording',
      body: 'Listen to the whole call again. Tap the wave to jump to any point and change the speed. Recordings are removed after 7 days.',
      bodyDesktop: 'Listen to the whole call again. Click the wave to jump to any point and change the speed. Recordings are removed after 7 days.',
    },
    transcript: {
      title: 'Transcript & corrections',
      body: 'Read everything you and Maya said. Corrections show under your sentences, and Jump to Next Correction takes you straight to each one.',
    },
  },
  si: {
    search: {
      title: 'Conversation එකක් හොයන්න',
      body: 'වචනයක් හරි topic එකක් හරි type කරලා හොයන්න. Mode button එකෙන් එක වර්ගයක ඒවා විතරක් බලාගන්නත් පුළුවන්.',
      bodyDesktop: 'කලින් කරපු conversation එකක් ඉක්මනට හොයාගන්න වචනයක් හරි topic එකක් හරි type කරන්න.',
    },
    session: {
      title: 'ඔයාගේ conversations',
      body: 'Conversation එකක් tap කරලා full review එක බලන්න. ▶ ඔබලා මෙතනම අහන්නත් පුළුවන්.',
      bodyDesktop: 'Conversation එකක් click කරාම review එක දකුණු පැත්තේ පේනවා. ▶ ඔබලා එතනම අහන්නත් පුළුවන්.',
    },
    recording: {
      title: 'Voice recording',
      body: 'මුළු call එකම ආයේ අහන්න. Wave එක tap කරලා ඕන තැනකට යන්න, speed එකත් මාරු කරන්න පුළුවන්. Recordings දවස් 7කින් delete වෙනවා.',
      bodyDesktop: 'මුළු call එකම ආයේ අහන්න. Wave එක click කරලා ඕන තැනකට යන්න, speed එකත් මාරු කරන්න පුළුවන්. Recordings දවස් 7කින් delete වෙනවා.',
    },
    transcript: {
      title: 'Transcript එකයි corrections ටිකයි',
      body: 'ඔයයි Maya යි කියපු ඔක්කොම මෙතන තියෙනවා. ඔයාගේ sentences යටින් corrections පේනවා, Jump to Next Correction ඔබලා එකින් එක බලන්න.',
    },
  },
  ta: {
    search: {
      title: 'உரையாடலைத் தேடுங்கள்',
      body: 'ஒரு சொல் அல்லது topic-ஐ type செய்து தேடுங்கள். Mode button மூலம் ஒரு வகை உரையாடல்களை மட்டும் பார்க்கலாம்.',
      bodyDesktop: 'முந்தைய உரையாடலை விரைவாகக் கண்டுபிடிக்க ஒரு சொல் அல்லது topic-ஐ type செய்யுங்கள்.',
    },
    session: {
      title: 'உங்கள் உரையாடல்கள்',
      body: 'முழு review-ஐப் பார்க்க ஒரு உரையாடலை tap செய்யுங்கள். ▶ அழுத்தி இங்கேயே கேட்கலாம்.',
      bodyDesktop: 'ஒரு உரையாடலை click செய்தால் அதன் review வலது பக்கம் தெரியும். ▶ அழுத்தி உடனே கேட்கலாம்.',
    },
    recording: {
      title: 'Voice recording',
      body: 'முழு call-ஐயும் மீண்டும் கேளுங்கள். Wave-ஐ tap செய்து எந்த இடத்துக்கும் செல்லலாம், speed-ஐயும் மாற்றலாம். Recordings 7 நாட்களில் நீக்கப்படும்.',
      bodyDesktop: 'முழு call-ஐயும் மீண்டும் கேளுங்கள். Wave-ஐ click செய்து எந்த இடத்துக்கும் செல்லலாம், speed-ஐயும் மாற்றலாம். Recordings 7 நாட்களில் நீக்கப்படும்.',
    },
    transcript: {
      title: 'Transcript & corrections',
      body: 'நீங்களும் Maya-வும் பேசிய அனைத்தும் இங்கே. திருத்தங்கள் உங்கள் வாக்கியங்களின் கீழ் தெரியும்; Jump to Next Correction ஒவ்வொன்றுக்கும் நேரடியாக அழைத்துச் செல்லும்.',
    },
  },
};

const copy = {
  en: { ui: TOUR_UI.en, steps: STEPS.en },
  si: { ui: TOUR_UI.si, steps: STEPS.si },
  ta: { ui: TOUR_UI.ta, steps: STEPS.ta },
};

export const HISTORY_TOUR: TourDefinition = {
  id: 'history:v1',
  steps: [
    { id: 'search', kind: 'spot', target: 'history.search', padding: 6, radius: 18 },
    { id: 'session', kind: 'spot', target: 'history.session', padding: 6, radius: 20 },
    { id: 'recording', kind: 'spot', target: 'history.recording', padding: 6, radius: 20 },
    { id: 'transcript', kind: 'spot', target: 'history.transcript', padding: 8, radius: 16 },
  ],
  copy,
};

export const HISTORY_DETAIL_TOUR: TourDefinition = {
  id: 'history-detail:v1',
  steps: [
    { id: 'recording', kind: 'spot', target: 'history.recording', padding: 6, radius: 20 },
    { id: 'transcript', kind: 'spot', target: 'history.transcript', padding: 8, radius: 16 },
  ],
  copy,
};
