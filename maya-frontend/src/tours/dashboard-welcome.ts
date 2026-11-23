import type { TourDefinition } from '@/components/tour/tour-types';
import { TOUR_UI } from './tour-ui-copy';

/**
 * First-visit dashboard tour (design approved 2026-11-22, see docs/screens/tour.md).
 * Target ids are registered with useTourTarget() in the dashboard, top bars, sidebar and tab bar.
 * Sinhala and Tamil copy are drafts awaiting native-speaker review.
 */
export const DASHBOARD_WELCOME_TOUR: TourDefinition = {
  id: 'dashboard-welcome:v1',
  steps: [
    { id: 'intro', kind: 'sheet' },
    { id: 'start', kind: 'spot', target: 'dashboard.start', padding: 6 },
    { id: 'topics', kind: 'spot', target: 'dashboard.scenarios', padding: 8, radius: 22 },
    { id: 'talk', kind: 'spot', target: 'dashboard.talkTime', padding: 6, radius: 22 },
    { id: 'xp', kind: 'spot', target: 'nav.level', padding: 6 },
    { id: 'roadmap', kind: 'spot', target: 'nav.roadmap', padding: 4, radius: 16 },
    { id: 'history', kind: 'spot', target: 'nav.history', padding: 4, radius: 16 },
    { id: 'account', kind: 'spot', target: 'nav.account', padding: 4, radius: 16 },
    { id: 'done', kind: 'sheet' },
  ],
  copy: {
    en: {
      ui: TOUR_UI.en,
      steps: {
        intro: { title: "Hi {name}, I'm Maya", body: 'Let me show you around your home screen. It only takes a moment.' },
        start: {
          title: 'Start a conversation',
          body: 'Tap Start Talking to have a real-time voice chat with me. Just speak naturally.',
          bodyDesktop: 'Click Start Talking to have a real-time voice chat with me. Just speak naturally.',
        },
        topics: { title: 'Choose what to practice', body: "Pick a topic like Job Interview or Travel English, and I'll guide the conversation." },
        talk: { title: 'Your Talk Time', body: "See how many practice minutes you've used and when they reset." },
        xp: { title: 'Earn XP, level up', body: 'Every conversation earns XP. Your level grows right here.' },
        roadmap: { title: 'Roleplays', body: 'Practice real-life roleplays on a step-by-step path to become fluent.' },
        history: { title: 'Your History', body: 'Replay your past conversations, read the transcript and review every correction.' },
        account: { title: 'Your Account', body: 'Update your profile, practice settings and plan, or get help from support.' },
        done: { title: "You're all set!", body: 'Ready for your first conversation with me?' },
      },
    },
    si: {
      ui: TOUR_UI.si,
      steps: {
        intro: { title: 'Hi {name}, මම Maya', body: 'මම ඔයාට home screen එක පොඩ්ඩක් පෙන්නන්නම්. ගොඩක් වෙලා යන්නේ නෑ.' },
        start: {
          title: 'අපි කතා කරමු',
          body: 'මාත් එක්ක live කතා කරන්න Start Talking tap කරන්න. යාළුවෙක් එක්ක කතා කරනවා වගේ කතා කරන්න.',
          bodyDesktop: 'මාත් එක්ක live කතා කරන්න Start Talking click කරන්න. යාළුවෙක් එක්ක කතා කරනවා වගේ කතා කරන්න.',
        },
        topics: { title: 'මොකක්ද practice කරන්න ඕන?', body: 'Job Interview, Travel English වගේ topic එකක් select කරන්න. මම conversation එක අරන් යන්නම්.' },
        talk: { title: 'ඔයාගේ Talk Time', body: 'ඔයා practice minutes කීයක් use කරලද, ආයේ reset වෙන්නේ කවදද කියලා මෙතන බලාගන්න පුළුවන්.' },
        xp: { title: 'XP එකතු කරලා level up වෙන්න', body: 'හැම conversation එකකටම ඔයාට XP ලැබෙනවා. Level එක යන හැටි මෙතන බලාගන්න.' },
        roadmap: { title: 'Roleplays', body: 'Fluent වෙන්න step by step කරන්න පුළුවන් real-life roleplays මෙතන තියෙනවා.' },
        history: { title: 'ඔයාගේ History', body: 'කලින් කරපු conversations ආයේ අහන්න, transcript එක බලන්න, වැරදුණු තැන් හදපු හැටි බලාගන්න පුළුවන්.' },
        account: { title: 'ඔයාගේ Account', body: 'Profile එක, settings, plan එක මාරු කරන්න, නැත්නම් support එකෙන් help ගන්න මෙතනට එන්න.' },
        done: { title: 'ඔක්කොම ready!', body: 'එහෙනම් අපි පළවෙනි conversation එක පටන් ගමුද?' },
      },
    },
    ta: {
      ui: TOUR_UI.ta,
      steps: {
        intro: { title: 'வணக்கம் {name}, நான் Maya', body: 'உங்கள் home screen-ஐ சுற்றிக் காட்டுகிறேன். சிறிது நேரம் மட்டுமே ஆகும்.' },
        start: {
          title: 'உரையாடலைத் தொடங்குங்கள்',
          body: 'என்னுடன் live-ஆகப் பேச Start Talking-ஐ tap செய்யுங்கள். இயல்பாகப் பேசுங்கள்.',
          bodyDesktop: 'என்னுடன் live-ஆகப் பேச Start Talking-ஐ click செய்யுங்கள். இயல்பாகப் பேசுங்கள்.',
        },
        topics: { title: 'பயிற்சி செய்ய வேண்டியதைத் தேர்ந்தெடுங்கள்', body: 'Job Interview, Travel English போன்ற ஒரு topic-ஐத் தேர்ந்தெடுங்கள். நான் உரையாடலை வழிநடத்துவேன்.' },
        talk: { title: 'உங்கள் Talk Time', body: 'நீங்கள் எத்தனை practice நிமிடங்களைப் பயன்படுத்தினீர்கள், அவை எப்போது reset ஆகும் என்பது இங்கே தெரியும்.' },
        xp: { title: 'XP சேர்த்து level up ஆகுங்கள்', body: 'ஒவ்வொரு உரையாடலுக்கும் XP கிடைக்கும். உங்கள் level இங்கே வளரும்.' },
        roadmap: { title: 'Roleplays', body: 'Fluent ஆக படிப்படியான real-life roleplays இங்கே உள்ளன.' },
        history: { title: 'உங்கள் History', body: 'முந்தைய உரையாடல்களை மீண்டும் கேளுங்கள், transcript-ஐப் படியுங்கள், ஒவ்வொரு திருத்தத்தையும் பாருங்கள்.' },
        account: { title: 'உங்கள் Account', body: 'உங்கள் profile, practice settings, plan ஆகியவற்றை மாற்றலாம் அல்லது support-இடம் உதவி பெறலாம்.' },
        done: { title: 'எல்லாம் தயார்!', body: 'என்னுடன் முதல் உரையாடலைத் தொடங்கலாமா?' },
      },
    },
  },
};
