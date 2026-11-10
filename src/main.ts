import { Game } from './Game';

declare global {
  interface Window {
    __DINO_GAME__?: Game;
  }
}

function bootstrap(): void {
  const canvas = document.getElementById('game-canvas') as HTMLCanvasElement | null;
  if (!canvas) {
    throw new Error('Could not find #game-canvas');
  }
  const game = new Game(canvas);
  window.__DINO_GAME__ = game;
  game.start();
}

bootstrap();
