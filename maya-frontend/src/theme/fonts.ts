import { Platform, TextStyle } from 'react-native';

/**
 * ROOT CAUSE OF THE FONT BUG ON ANDROID
 * ======================================
 * On Web: the browser uses CSS font matching. `fontFamily: 'Outfit'` + `fontWeight: '700'`
 * works because Google Fonts serves the correct weight via @font-face CSS rules.
 *
 * On Android: React Native does NOT synthesise font weights for custom fonts.
 * If you set `fontFamily: 'Outfit_700Bold'` AND `fontWeight: '700'`, Android's native
 * font resolver tries to find a "bold variant of the font family named Outfit_700Bold"
 * — which doesn't exist — and SILENTLY FALLS BACK TO ROBOTO (the system font).
 *
 * THE FIX: On native, set only `fontFamily` (pointing to the exact weight file) and
 * REMOVE `fontWeight` entirely. On web, keep both `fontFamily` and `fontWeight` so the
 * browser's CSS engine can match correctly.
 *
 * Usage:
 *   import { fontStyle } from '@/theme/fonts';
 *   const styles = StyleSheet.create({
 *     title: {
 *       ...fontStyle('outfit', 'bold'),
 *       fontSize: 20,
 *     },
 *   });
 */

type FontFamily = 'outfit' | 'inter';
type FontWeight = 'regular' | 'medium' | 'semiBold' | 'bold' | 'extraBold';

const FONT_MAP: Record<FontFamily, Record<FontWeight, { native: string; web: string; weight: TextStyle['fontWeight'] }>> = {
  outfit: {
    regular:   { native: 'Outfit_400Regular',   web: 'Outfit', weight: '400' },
    medium:    { native: 'Outfit_500Medium',     web: 'Outfit', weight: '500' },
    semiBold:  { native: 'Outfit_600SemiBold',   web: 'Outfit', weight: '600' },
    bold:      { native: 'Outfit_700Bold',       web: 'Outfit', weight: '700' },
    extraBold: { native: 'Outfit_800ExtraBold',  web: 'Outfit', weight: '800' },
  },
  inter: {
    regular:   { native: 'Inter_400Regular',     web: 'Inter', weight: '400' },
    medium:    { native: 'Inter_500Medium',       web: 'Inter', weight: '500' },
    semiBold:  { native: 'Inter_600SemiBold',     web: 'Inter', weight: '600' },
    bold:      { native: 'Inter_700Bold',         web: 'Inter', weight: '700' },
    extraBold: { native: 'Inter_800ExtraBold',    web: 'Inter', weight: '800' },
  },
};

/**
 * Returns a platform-safe { fontFamily, fontWeight? } object.
 *
 * On web  → { fontFamily: 'Outfit', fontWeight: '700' }
 * On native → { fontFamily: 'Outfit_700Bold' }  (NO fontWeight!)
 */
export function fontStyle(family: FontFamily, weight: FontWeight): Pick<TextStyle, 'fontFamily' | 'fontWeight'> {
  const entry = FONT_MAP[family][weight];
  if (Platform.OS === 'web') {
    return { fontFamily: entry.web, fontWeight: entry.weight };
  }
  // Android/iOS: only fontFamily, NO fontWeight
  return { fontFamily: entry.native };
}

/**
 * Legacy Fonts object for backward compat (font family names only).
 * WARNING: If you use these, you MUST NOT set fontWeight on native.
 */
export const Fonts = {
  outfit: {
    regular:   Platform.select({ web: 'Outfit', default: 'Outfit_400Regular' })!,
    medium:    Platform.select({ web: 'Outfit', default: 'Outfit_500Medium' })!,
    semiBold:  Platform.select({ web: 'Outfit', default: 'Outfit_600SemiBold' })!,
    bold:      Platform.select({ web: 'Outfit', default: 'Outfit_700Bold' })!,
    extraBold: Platform.select({ web: 'Outfit', default: 'Outfit_800ExtraBold' })!,
  },
  inter: {
    regular:   Platform.select({ web: 'Inter', default: 'Inter_400Regular' })!,
    medium:    Platform.select({ web: 'Inter', default: 'Inter_500Medium' })!,
    semiBold:  Platform.select({ web: 'Inter', default: 'Inter_600SemiBold' })!,
    bold:      Platform.select({ web: 'Inter', default: 'Inter_700Bold' })!,
    extraBold: Platform.select({ web: 'Inter', default: 'Inter_800ExtraBold' })!,
  },
};
