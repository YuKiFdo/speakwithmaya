import type { TourLang, TourUiCopy } from '@/components/tour/tour-types';

/** Button labels shared by every tour. */
export const TOUR_UI: Record<TourLang, TourUiCopy> = {
  en: { next: 'Next', back: 'Back', skip: 'Skip', done: 'Done', start: 'Show me around', later: 'Skip tour', cta: 'Start Talking', explore: 'Explore on my own' },
  si: { next: 'ඊළඟට', back: 'ආපහු', skip: 'Skip', done: 'හරි', start: 'පෙන්නන්න', later: 'පස්සේ බලමු', cta: 'Start Talking', explore: 'මම තනියම බලන්නම්' },
  ta: { next: 'அடுத்து', back: 'பின்', skip: 'Skip', done: 'சரி', start: 'காட்டுங்கள்', later: 'Tour-ஐ skip செய்', cta: 'Start Talking', explore: 'நானே பார்க்கிறேன்' },
};
