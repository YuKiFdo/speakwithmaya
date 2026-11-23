import type { TourDefinition } from '@/components/tour/tour-types';
import { TOUR_UI } from './tour-ui-copy';

/**
 * First time the learner opens "Create New Session" (Start Talking / New Conversation / a topic).
 * Explains each setting. Drawn inside the modal (host 'create-session').
 * Sinhala and Tamil copy are drafts awaiting native-speaker review.
 */
export const CREATE_SESSION_TOUR: TourDefinition = {
  id: 'create-session:v1',
  host: 'create-session',
  steps: [
    { id: 'time', kind: 'spot', target: 'session.time', padding: 6, radius: 20 },
    { id: 'language', kind: 'spot', target: 'session.language', padding: 6, radius: 20 },
    { id: 'corrections', kind: 'spot', target: 'session.corrections', padding: 6, radius: 20 },
    { id: 'start', kind: 'spot', target: 'session.start', padding: 6 },
  ],
  copy: {
    en: {
      ui: TOUR_UI.en,
      steps: {
        time: {
          title: 'Practice time',
          body: 'Choose how long this conversation lasts. Longer sessions open up on higher plans.',
        },
        language: {
          title: 'Language help',
          body:
            '• English only: Maya speaks only English.\n' +
            '• Sinhala Support: she mixes in Sinhala when you get stuck.\n' +
            '• Deep Guidance: she uses both languages in every turn.',
        },
        corrections: {
          title: 'AI corrections',
          body:
            '• Let me speak: no interruptions, review at the end.\n' +
            '• Keep me on track: an occasional correction.\n' +
            '• Correct me instantly: Maya fixes every mistake as it happens.',
        },
        start: {
          title: 'Start Session',
          body: "When you're ready, tap Start Session and Maya joins the call. Cancel takes you back.",
          bodyDesktop: "When you're ready, click Start Session and Maya joins the call. Cancel takes you back.",
        },
      },
    },
    si: {
      ui: TOUR_UI.si,
      steps: {
        time: {
          title: 'Practice time',
          body: 'මේ conversation එක කොච්චර වෙලා කරන්නද කියලා select කරන්න. වැඩි වෙලාවක් ඕන නම් plan එක upgrade කරන්න වෙනවා.',
        },
        language: {
          title: 'Language help',
          body:
            '• English only: Maya කතා කරන්නේ English විතරයි.\n' +
            '• Sinhala Support: ඔයාට අමාරු වුණොත් Maya සිංහලෙනුත් කියලා දෙනවා.\n' +
            '• Deep Guidance: Maya හැම වෙලාවෙම සිංහලයි English දෙකම mix කරලා කතා කරනවා.',
        },
        corrections: {
          title: 'AI corrections',
          body:
            '• Let me speak: මැදින් නවත්තන්නේ නෑ, අන්තිමට review එකක් දෙනවා.\n' +
            '• Keep me on track: වෙලාවකට සැරයක් correct කරනවා.\n' +
            '• Correct me instantly: වැරද්දක් කරපු ගමන්ම Maya ඒක හදලා දෙනවා.',
        },
        start: {
          title: 'Start Session',
          body: 'Ready නම් Start Session tap කරන්න, එතකොට Maya call එකට එනවා. ආපහු යන්න ඕන නම් Cancel ඔබන්න.',
          bodyDesktop: 'Ready නම් Start Session click කරන්න, එතකොට Maya call එකට එනවා. ආපහු යන්න ඕන නම් Cancel ඔබන්න.',
        },
      },
    },
    ta: {
      ui: TOUR_UI.ta,
      steps: {
        time: {
          title: 'Practice time',
          body: 'இந்த உரையாடல் எவ்வளவு நேரம் என்பதைத் தேர்ந்தெடுங்கள். நீண்ட நேரத்துக்கு உயர்ந்த plan தேவை.',
        },
        language: {
          title: 'Language help',
          body:
            '• English only: Maya ஆங்கிலத்தில் மட்டுமே பேசுவார்.\n' +
            '• Sinhala Support: நீங்கள் தடுமாறும்போது சிங்களத்திலும் உதவுவார்.\n' +
            '• Deep Guidance: ஒவ்வொரு முறையும் இரண்டு மொழிகளையும் பயன்படுத்துவார்.',
        },
        corrections: {
          title: 'AI corrections',
          body:
            '• Let me speak: இடையூறு இல்லை, முடிவில் review.\n' +
            '• Keep me on track: அவ்வப்போது ஒரு திருத்தம்.\n' +
            '• Correct me instantly: ஒவ்வொரு தவறையும் உடனே திருத்துவார்.',
        },
        start: {
          title: 'Start Session',
          body: 'தயாரானதும் Start Session-ஐ tap செய்யுங்கள், Maya call-இல் இணைவார். திரும்பிச் செல்ல Cancel.',
          bodyDesktop: 'தயாரானதும் Start Session-ஐ click செய்யுங்கள், Maya call-இல் இணைவார். திரும்பிச் செல்ல Cancel.',
        },
      },
    },
  },
};
