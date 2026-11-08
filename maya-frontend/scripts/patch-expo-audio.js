const fs = require('fs');
const path = require('path');

const targetFile = path.join(__dirname, '..', 'node_modules', 'expo-audio', 'build', 'ExpoAudio.js');
if (fs.existsSync(targetFile)) {
  let content = fs.readFileSync(targetFile, 'utf8');
  let changed = false;

  // 1. Patch createAudioPlayer constructor fallback (5 args -> 4 args for Expo Go)
  const oldCreate = 'const player = new AudioModule.AudioPlayer(initialSource, updateInterval, keepAudioSessionActive, preferredForwardBufferDuration, allowsExternalPlayback);';
  const newCreate = `let player;
    try {
        player = new AudioModule.AudioPlayer(initialSource, updateInterval, keepAudioSessionActive, preferredForwardBufferDuration, allowsExternalPlayback);
    } catch {
        player = new AudioModule.AudioPlayer(initialSource, updateInterval, keepAudioSessionActive, preferredForwardBufferDuration);
    }`;

  if (content.includes(oldCreate)) {
    content = content.replace(oldCreate, newCreate);
    changed = true;
  }

  // 2. Patch useAudioPlayer hook constructor fallback
  const oldHook = 'const player = useReleasingSharedObject(()=>new AudioModule.AudioPlayer(initialSource, updateInterval, keepAudioSessionActive, preferredForwardBufferDuration, allowsExternalPlayback), [';
  const newHook = `const player = useReleasingSharedObject(()=>{
        try {
            return new AudioModule.AudioPlayer(initialSource, updateInterval, keepAudioSessionActive, preferredForwardBufferDuration, allowsExternalPlayback);
        } catch {
            return new AudioModule.AudioPlayer(initialSource, updateInterval, keepAudioSessionActive, preferredForwardBufferDuration);
        }
    }, [`;

  if (content.includes(oldHook)) {
    content = content.replace(oldHook, newHook);
    changed = true;
  }

  if (changed) {
    fs.writeFileSync(targetFile, content, 'utf8');
    console.log('[patch-expo-audio] Successfully patched expo-audio for Expo Go compatibility!');
  }
}

