import { useEffect } from 'react';
import { controller } from '../app/controller';
import { startLoop } from '../app/loop';
import { audio } from '../audio/AudioManager';
import { useController } from './common';
import { GameScreen } from './game/GameScreen';
import { EndScreen, MainMenu, SetupScreen } from './screens/MenuScreens';
import { CreditsScreen, Encyclopedia, RulesScreen, SettingsScreen } from './screens/InfoScreens';
import { TrainingScreen } from './screens/Training';

export function App(): JSX.Element {
  const c = useController();
  useEffect(() => {
    startLoop();
    audio.preload().catch((e) => console.warn('[audio] préchargement impossible', e));
    // politique d'autoplay : l'audio démarre au premier geste de l'utilisateur
    const unlock = () => {
      audio
        .unlock()
        .then(() => {
          if (controller.screen === 'menu') audio.playMusic('menu');
          audio.playAmbience(true);
        })
        .catch(() => undefined);
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
    return () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
  }, []);
  switch (c.screen) {
    case 'game':
      return <GameScreen />;
    case 'setup':
      return <SetupScreen />;
    case 'end':
      return <EndScreen />;
    case 'encyclopedia':
      return <Encyclopedia />;
    case 'rules':
      return <RulesScreen />;
    case 'settings':
      return <SettingsScreen />;
    case 'credits':
      return <CreditsScreen />;
    case 'training':
      return <TrainingScreen />;
    default:
      return <MainMenu />;
  }
}
