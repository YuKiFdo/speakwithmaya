import React, { useEffect, useState, useRef } from 'react';
import { Text, StyleSheet, TextStyle, StyleProp, Animated } from 'react-native';

interface TypewriterTextProps {
  text: string;
  isSpeaking?: boolean;
  style?: StyleProp<TextStyle>;
  fallbackText?: string;
  onTypingComplete?: () => void;
}

export function TypewriterText({
  text,
  isSpeaking = false,
  style,
  fallbackText = 'Listening to Maya...',
  onTypingComplete,
}: TypewriterTextProps) {
  const [displayedText, setDisplayedText] = useState<string>('');
  const cursorOpacity = useRef(new Animated.Value(1)).current;
  const targetTextRef = useRef<string>(text);
  const currentIndexRef = useRef<number>(0);
  const animFrameRef = useRef<any>(null);

  // Smooth blinking cursor animation while Maya is speaking
  useEffect(() => {
    let cursorAnim: Animated.CompositeAnimation | null = null;
    if (isSpeaking) {
      cursorAnim = Animated.loop(
        Animated.sequence([
          Animated.timing(cursorOpacity, {
            toValue: 0.15,
            duration: 350,
            useNativeDriver: true,
          }),
          Animated.timing(cursorOpacity, {
            toValue: 1,
            duration: 350,
            useNativeDriver: true,
          }),
        ])
      );
      cursorAnim.start();
    } else {
      Animated.timing(cursorOpacity, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true,
      }).start();
    }

    return () => {
      if (cursorAnim) cursorAnim.stop();
    };
  }, [isSpeaking]);

  // Adaptive typing tick synchronized with audio stream arrival
  useEffect(() => {
    targetTextRef.current = text;

    if (!text) {
      currentIndexRef.current = 0;
      setDisplayedText('');
      return;
    }

    // If new text does not start with current prefix, a brand new turn has started
    if (
      currentIndexRef.current > 5 &&
      !text.startsWith(targetTextRef.current.slice(0, 5))
    ) {
      currentIndexRef.current = 0;
      setDisplayedText('');
    }

    let lastTime = typeof performance !== 'undefined' ? performance.now() : Date.now();

    const tick = (now: number) => {
      const target = targetTextRef.current;
      const current = currentIndexRef.current;
      const remaining = target.length - current;

      if (remaining <= 0) {
        onTypingComplete?.();
        return;
      }

      const elapsed = now - lastTime;

      // Adaptive speech tempo:
      // If backlog is small (< 15 chars): natural speaking cadence (~28ms per char)
      // If backlog is medium (15-40 chars): faster typing (~15ms per char)
      // If backlog is large (> 40 chars): fast catch-up (~8ms per char)
      let charInterval = 28;
      if (remaining > 50) {
        charInterval = 8;
      } else if (remaining > 25) {
        charInterval = 14;
      } else if (remaining > 12) {
        charInterval = 20;
      }

      if (elapsed >= charInterval) {
        const step = remaining > 60 ? 3 : remaining > 30 ? 2 : 1;
        const nextIndex = Math.min(target.length, current + step);
        currentIndexRef.current = nextIndex;
        setDisplayedText(target.slice(0, nextIndex));
        lastTime = now;
      }

      if (currentIndexRef.current < target.length) {
        animFrameRef.current = requestAnimationFrame(tick);
      }
    };

    animFrameRef.current = requestAnimationFrame(tick);

    return () => {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, [text]);

  const isEmpty = !displayedText && !text;

  return (
    <Text style={style}>
      {isEmpty ? (
        fallbackText
      ) : (
        <>
          {displayedText}
          {isSpeaking && (
            <Animated.Text style={[styles.cursor, { opacity: cursorOpacity }]}>
              {' '}▌
            </Animated.Text>
          )}
        </>
      )}
    </Text>
  );
}

const styles = StyleSheet.create({
  cursor: {
    color: '#0ea5e9',
    fontWeight: '900',
    fontSize: 20,
  },
});
