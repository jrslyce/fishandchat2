import '@fontsource/baloo-2/latin-500.css';
import '@fontsource/baloo-2/latin-600.css';
import '@fontsource/baloo-2/latin-700.css';
import '@fontsource/baloo-2/latin-800.css';
import './styles.css';
import { Game } from './game/Game';

const canvas = document.querySelector<HTMLCanvasElement>('#game-canvas');

if (!canvas) {
  throw new Error('Missing #game-canvas element.');
}

try {
  const game = new Game(canvas);
  game.start();

  if (import.meta.hot) {
    import.meta.hot.dispose(() => {
      game.dispose();
    });
  }
} catch (error) {
  // A silently frozen page (game construction throwing before the render
  // loop starts) is much harder to diagnose than a visible failure message.
  console.error('[Game] failed to start', error);
  const message = document.createElement('div');
  message.id = 'fatal-error';
  message.textContent = `Fish and Chat failed to start: ${error instanceof Error ? error.message : String(error)}`;
  document.querySelector('#app')?.appendChild(message);
  throw error;
}
